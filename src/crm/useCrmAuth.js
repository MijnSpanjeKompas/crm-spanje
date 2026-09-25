// ─── AUTHENTICATIE ───────────────────────────────────────────────────────────
// Toegang = ingelogd bij Firebase Auth ÉN een actief document in users/{uid}.
// Dat document maak je handmatig aan in de Firebase Console (zie README).

import { useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

const AUTH_ERRORS = {
  "auth/invalid-credential": "E-mailadres of wachtwoord klopt niet.",
  "auth/wrong-password": "E-mailadres of wachtwoord klopt niet.",
  "auth/user-not-found": "E-mailadres of wachtwoord klopt niet.",
  "auth/invalid-email": "Dit e-mailadres is ongeldig.",
  "auth/too-many-requests": "Te veel pogingen. Probeer het over een paar minuten opnieuw.",
  "auth/network-request-failed": "Geen verbinding. Controleer je internet.",
  "auth/operation-not-allowed": "Inloggen met e-mail/wachtwoord staat nog uit in Firebase.",
};

export function authErrorMessage(e) {
  return AUTH_ERRORS[e?.code] || "Inloggen lukte niet. Probeer het opnieuw.";
}

/**
 * @returns {{status:"loading"|"signed_out"|"no_access"|"ready", authUser:any, user:any, signIn:Function, signOut:Function, resetPassword:Function}}
 */
export function useCrmAuth() {
  const [authUser, setAuthUser] = useState(undefined);
  const [profile, setProfile] = useState(undefined);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setAuthUser(u || null);
    setProfile(undefined);
  }), []);

  useEffect(() => {
    if (!authUser) return undefined;
    return onSnapshot(
      doc(db, "users", authUser.uid),
      (snap) => setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setProfile(null) // geen leesrechten = geen toegang
    );
  }, [authUser]);

  let status = "loading";
  if (authUser === null) status = "signed_out";
  else if (authUser && profile === null) status = "no_access";
  else if (authUser && profile && profile.active === false) status = "no_access";
  else if (authUser && profile) status = "ready";

  const user = status === "ready"
    ? {
        id: authUser.uid,
        email: profile.email || authUser.email || "",
        displayName: profile.displayName || authUser.displayName || authUser.email || "Onbekend",
        role: profile.role || "member",
        isAdmin: profile.role === "admin",
      }
    : null;

  const signIn = useCallback((email, password) => signInWithEmailAndPassword(auth, email.trim(), password), []);
  const signOut = useCallback(() => fbSignOut(auth), []);
  const resetPassword = useCallback((email) => sendPasswordResetEmail(auth, email.trim()), []);

  return { status, authUser, user, signIn, signOut, resetPassword };
}
