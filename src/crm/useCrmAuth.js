// ─── AUTHENTICATIE ───────────────────────────────────────────────────────────
// Toegang = succesvol ingelogd met Firebase Authentication.
// Een optioneel users/{uid}-profiel verrijkt de gebruiker met naam/rol, maar
// bepaalt NIET of iemand het CRM in mag. Dit herstelt de oorspronkelijke,
// eenvoudige login-flow en voorkomt dat een ontbrekend profiel toegang blokkeert.

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
 * @returns {{status:"loading"|"signed_out"|"ready", authUser:any, user:any, signIn:Function, signOut:Function, resetPassword:Function}}
 */
export function useCrmAuth() {
  const [authUser, setAuthUser] = useState(undefined);
  const [profile, setProfile] = useState(undefined);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setAuthUser(u || null);
    setProfile(undefined);
  }), []);

  // Het profiel is optioneel. Als het ontbreekt of niet leesbaar is, gebruiken
  // we gewoon de gegevens uit Firebase Authentication als veilige fallback.
  useEffect(() => {
    if (!authUser) return undefined;
    return onSnapshot(
      doc(db, "users", authUser.uid),
      (snap) => setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setProfile(null)
    );
  }, [authUser]);

  let status = "loading";
  if (authUser === null) status = "signed_out";
  else if (authUser) status = "ready";

  const fallbackName = authUser?.displayName || authUser?.email || "Gebruiker";
  const user = status === "ready"
    ? {
        id: authUser.uid,
        email: profile?.email || authUser.email || "",
        displayName: profile?.displayName || fallbackName,
        role: profile?.role || "member",
        isAdmin: profile?.role === "admin",
      }
    : null;

  const signIn = useCallback((email, password) => signInWithEmailAndPassword(auth, email.trim(), password), []);
  const signOut = useCallback(() => fbSignOut(auth), []);
  const resetPassword = useCallback((email) => sendPasswordResetEmail(auth, email.trim()), []);

  return { status, authUser, user, signIn, signOut, resetPassword };
}
