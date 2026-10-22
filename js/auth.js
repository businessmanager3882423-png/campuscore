
import { auth, db, authReady } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export async function registerUser(name, email, password) {
  await authReady;

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanName.length < 2) {
    throw new Error("Please enter your full name.");
  }

  const credential = await createUserWithEmailAndPassword(
    auth,
    cleanEmail,
    password
  );

  try {
    // Public signup can create only a student profile.
    // Teacher and Principal roles must be granted securely.
    await setDoc(doc(db, "users", credential.user.uid), {
      uid: credential.user.uid,
      name: cleanName,
      email: cleanEmail,
      role: "student",
      status: "active",
      createdAt: serverTimestamp()
    });

    return credential.user;
  } catch (error) {
    // Avoid leaving an authenticated account with no profile
    // when profile creation is rejected.
    try {
      await signOut(auth);
    } catch {
      // Preserve the original error.
    }

    throw new Error(
      "Account was created, but its profile could not be saved. " +
      "Check Firestore Rules before trying again."
    );
  }
}

export async function loginUser(email, password) {
  await authReady;

  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password
  );

  try {
    const snapshot = await getDoc(
      doc(db, "users", credential.user.uid)
    );

    if (!snapshot.exists()) {
      throw new Error(
        "Your profile is not configured. Contact the Principal."
      );
    }

    const profile = snapshot.data();

    if (profile.status !== "active") {
      throw new Error(
        "Your account is not active. Contact the Principal."
      );
    }

    if (!["principal", "teacher", "student"].includes(profile.role)) {
      throw new Error("Your account role is not valid.");
    }

    return { user: credential.user, profile };
  } catch (error) {
    await signOut(auth);
    throw error;
  }
}

export async function logoutUser() {
  await signOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, async user => {
    if (!user) {
      callback(null, null);
      return;
    }

    try {
      await authReady;

      const snapshot = await getDoc(doc(db, "users", user.uid));

      if (!snapshot.exists()) {
        callback(user, null, "Your profile is not configured.");
        return;
      }

      const profile = snapshot.data();

      if (profile.status !== "active") {
        callback(user, profile, "Your account is not active.");
        return;
      }

      callback(user, profile);
    } catch {
      callback(
        user,
        null,
        "Unable to load your profile. Check your connection and permissions."
      );
    }
  });
}

