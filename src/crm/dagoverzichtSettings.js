// ─── DAGELIJKS OVERZICHT: INSTELLINGEN (client) ─────────────────────────────
// settings/dagoverzicht — zie functions/src/dagoverzicht.js voor het versturen.

import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "../firebase";
import { DEFAULT_DIGEST_SETTINGS } from "./digest";

function ref() {
  return doc(db, "settings", "dagoverzicht");
}

export function withDefaults(s) {
  const data = s || {};
  return { ...DEFAULT_DIGEST_SETTINGS, ...data, recipients: { ...DEFAULT_DIGEST_SETTINGS.recipients, ...(data.recipients || {}) } };
}

export function subscribeDigestSettings(onData, onError) {
  return onSnapshot(ref(), (snap) => onData(withDefaults(snap && snap.exists && snap.exists() ? snap.data() : {})), onError);
}

export async function saveDigestSettings(settings) {
  const s = withDefaults(settings);
  await setDoc(ref(), { enabled: Boolean(s.enabled), weekend: Boolean(s.weekend), crmUrl: String(s.crmUrl || "").trim(), recipients: s.recipients, updatedAt: serverTimestamp() }, { merge: true });
}

export async function sendDigestTest(profileId) {
  const fn = httpsCallable(getFunctions(app, "europe-west1"), "dagoverzichtTest");
  const res = await fn({ profileId });
  return res.data;
}
