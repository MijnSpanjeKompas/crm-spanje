import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDHMmyfSA8rY_NnQ3dhwU-_ahGmNl8r4Tg",
  authDomain: "mijn-spanje-kompas-crm.firebaseapp.com",
  projectId: "mijn-spanje-kompas-crm",
  storageBucket: "mijn-spanje-kompas-crm.firebasestorage.app",
  messagingSenderId: "1000916840815",
  appId: "1:1000916840815:web:c6c2bd29052cc7f6ee389a",
  measurementId: "G-KHTNK22WFQ",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);