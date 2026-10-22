
import { auth, db, authReady } from "./firebase.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const allowedRoles = ["principal", "teacher", "student"];

export async function registerStudent(name, email, password) {
  await authReady;
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (cleanName.length < 2) throw new Error("Enter your full name.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  try {
    await setDoc(doc(db, "users", credential.user.uid), {
      uid: credential.user.uid,
      name: cleanName,
      email: cleanEmail,
      role: "student",
      status: "active",
      studentId: "",
      program: "",
      semester: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
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
    auth, String(email).trim().toLowerCase(), password
  );

  try {
    const snap = await getDoc(doc(db, "users", credential.user.uid));
    if (!snap.exists()) throw new Error("Your campus profile is not configured. Contact the Principal.");
    const profile = snap.data();

    if (!allowedRoles.includes(profile.role)) throw new Error("This account has an invalid role.");
    if (profile.status !== "active") throw new Error("Your account is inactive. Contact the Principal.");

    return { user: credential.user, profile };
  } catch (error) {
    await signOut(auth);
    throw error;
  }
}

export async function resetPassword(email) {
  await authReady;
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) throw new Error("Enter your email address first.");
  await sendPasswordResetEmail(auth, cleanEmail);
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
        callback(user, null, "Your profile is not configured. Contact the Principal.");
        return;
      }
      const profile = snap.data();
      if (!allowedRoles.includes(profile.role) || profile.status !== "active") {
        callback(user, profile, "Your account is inactive or has an invalid role.");
        return;
      }
      callback(user, profile);
    } catch {
      callback(user, null, "Unable to load your profile. Check your connection and Firestore rules.");
    }
  });
}
