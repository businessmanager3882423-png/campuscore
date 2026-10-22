

import { auth, db, authReady } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export async function registerUser(name, email, password) {
  await authReady;

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanName.length < 2) throw new Error("Enter your full name.");

  const credential = await createUserWithEmailAndPassword(
    auth, cleanEmail, password
  );

  try {
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
    await signOut(auth);
    throw error;
  }
}

export async function loginUser(email, password) {
  await authReady;

  const credential = await signInWithEmailAndPassword(
    auth, email.trim().toLowerCase(), password
  );

  try {
    const snap = await getDoc(doc(db, "users", credential.user.uid));

    if (!snap.exists()) {
      throw new Error("Profile not configured. Contact the Principal.");
    }

    const profile = snap.data();

    if (profile.status !== "active") {
      throw new Error("Account is inactive. Contact the Principal.");
    }

    if (!["principal", "teacher", "student"].includes(profile.role)) {
      throw new Error("Invalid account role.");
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
      const snap = await getDoc(doc(db, "users", user.uid));

      if (!snap.exists()) {
        callback(user, null, "Profile not configured.");
        return;
      }

      const profile = snap.data();

      if (profile.status !== "active") {
        callback(user, profile, "Account is inactive.");
        return;
      }

      callback(user, profile);
    } catch {
      callback(user, null, "Could not load your profile.");
    }
  });
}
