
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAHKEYT6TbqHPzdmjgCwgei_McLcnpL27w",
  authDomain: "campuscore-9a901.firebaseapp.com",
  projectId: "campuscore-9a901",
  storageBucket: "campuscore-9a901.firebasestorage.app",
  messagingSenderId: "14569888878",
  appId: "1:14569888878:web:a794fefd0b25cdb6a85a7f"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const authReady = setPersistence(
  auth,
  browserLocalPersistence
);

export default app;

