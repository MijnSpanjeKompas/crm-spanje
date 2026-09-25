import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Let op: de Firebase web-config is geen geheim (hij staat altijd in de browser).
// De echte beveiliging zit in Firebase Auth + Firestore/Storage security rules.
// Via REACT_APP_FIREBASE_* kun je de waarden in Vercel overschrijven; zonder
// env vars blijft de bestaande configuratie werken, zodat de deploy niet breekt.
const env = process.env;

const firebaseConfig = {
  apiKey: env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDHMmyfSA8rY_NnQ3dhwU-_ahGmNl8r4Tg",
  authDomain: env.REACT_APP_FIREBASE_AUTH_DOMAIN || "mijn-spanje-kompas-crm.firebaseapp.com",
  projectId: env.REACT_APP_FIREBASE_PROJECT_ID || "mijn-spanje-kompas-crm",
  storageBucket: env.REACT_APP_FIREBASE_STORAGE_BUCKET || "mijn-spanje-kompas-crm.firebasestorage.app",
  messagingSenderId: env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "1000916840815",
  appId: env.REACT_APP_FIREBASE_APP_ID || "1:1000916840815:web:c6c2bd29052cc7f6ee389a",
  measurementId: env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-KHTNK22WFQ",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
