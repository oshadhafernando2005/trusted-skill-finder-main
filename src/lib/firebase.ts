import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDU4WaHJM27AE7iadeJZhUH87Qai2iIKQU",
  authDomain: "professional-c3cfc.firebaseapp.com",
  projectId: "professional-c3cfc",
  storageBucket: "professional-c3cfc.firebasestorage.app",
  messagingSenderId: "905665299151",
  appId: "1:905665299151:web:702f9c0c07796d76c9edba",
  measurementId: "G-CTFG7Q1B1X",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
