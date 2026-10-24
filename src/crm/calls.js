// ─── GESPREKKEN: upload, verwerken, goedkeuren, instellingen ────────────────
// Firestore: leads/{leadId}/calls/{callId}
//   status: "uploading" → "uploaded" → "processing" → "done" | "error" → "approved"
//   result: { uitgebreid, kort, appje, checks[], leadtemperatuur, leadtype }
// Storage:  leads/{leadId}/gesprekken/{callId}.{ext}
// Settings: settings/gesprekken  (tegoed, model, woordenlijst)

import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { ref, uploadBytesResumable, deleteObject, getDownloadURL } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db, storage } from "../firebase";
import { addActivity, clean } from "./services";
import { stripChecks } from "./gesprekPrompt";

export const AUDIO_DELETE_DAYS = 14;
export const MAX_AUDIO_BYTES = 500 * 1024 * 1024;
export const STALE_PROCESSING_MS = 12 * 60 * 1000;
export const DEFAULT_WARN_USD = 3;

const EXT_BY_MIME = { "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/webm": "webm", "audio/ogg": "ogg", "video/mp4": "mp4", "audio/x-caf": "caf", "audio/3gpp": "3gp" };
const MIME_BY_EXT = { m4a: "audio/mp4", aac: "audio/aac", mp3: "audio/mpeg", wav: "audio/wav", webm: "audio/webm", ogg: "audio/ogg", mp4: "video/mp4", caf: "audio/x-caf", "3gp": "audio/3gpp", opus: "audio/ogg", flac: "audio/flac", amr: "audio/amr" };

export function audioMeta(mimeType, fileName) {
  const base = String(mimeType || "").split(";")[0].trim().toLowerCase();
  const extFromName = /\.([a-z0-9]+)$/i.exec(String(fileName || ""))?.[1]?.toLowerCase();
  const ext = EXT_BY_MIME[base] || (extFromName && MIME_BY_EXT[extFromName] ? extFromName : "") || "m4a";
  const contentType = base.startsWith("audio/") || base.startsWith("video/") ? base : MIME_BY_EXT[ext] || "application/octet-stream";
  return { ext, contentType };
}

export function newCallId(leadId) {
  return doc(collection(db, "leads", leadId, "calls")).id;
}

function callRef(leadId, callId) {
  return doc(db, "leads", leadId, "calls", callId);
}

/**
 * Stap 1: audio veilig in Firebase Storage zetten. Pas als dit gelukt is,
 * mag de lokale kopie op het toestel weg.
 */
export async function uploadCallAudio({ leadId, callId, blobs, blob, mimeType, fileName, source, durationSec, zekerWeten, user, onProgress }) {
  const parts = (blobs || (blob ? [blob] : [])).filter((b) => b && b.size);
  if (!parts.length) throw new Error("De opname is leeg.");
  const total = parts.reduce((n, b) => n + b.size, 0);
  if (total > MAX_AUDIO_BYTES) throw new Error("Dit audiobestand is groter dan 500 MB.");
  const { ext, contentType } = audioMeta(mimeType, fileName);
  await setDoc(
    callRef(leadId, callId),
    clean({
      status: "uploading",
      source: source || "opname",
      fileName: fileName || "",
      size: total,
      parts: parts.length,
      durationSec: durationSec || null,
      zekerWeten: zekerWeten || {},
      createdAt: serverTimestamp(),
      createdByUserId: user?.id || "",
      createdByName: user?.displayName || user?.email || "",
    }),
    { merge: true }
  );
  const paths = [];
  let done = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const offset = done;
    const storagePath = `leads/${leadId}/gesprekken/${callId}${i ? `_deel${i + 1}` : ""}.${ext}`;
    const report = (bytes) => onProgress && total && onProgress((offset + bytes) / total);
    await new Promise((resolve, reject) => {
      const task = uploadBytesResumable(ref(storage, storagePath), part, { contentType, customMetadata: { leadId, callId, deel: String(i + 1) } });
      task.on("state_changed", (s) => report(s.bytesTransferred), reject, resolve);
    });
    done += part.size;
    paths.push(storagePath);
  }
  await updateDoc(callRef(leadId, callId), { status: "uploaded", audioPath: paths[0], audioPaths: paths, audioContentType: contentType, uploadedAt: serverTimestamp() });
  return paths;
}

/** Alle audiobestanden van een gesprek (oude gesprekken hebben er één). */
export function callAudioPaths(call) {
  if (Array.isArray(call?.audioPaths) && call.audioPaths.length) return call.audioPaths;
  return call?.audioPath ? [call.audioPath] : [];
}

let callable = null;
/**
 * Stap 2: de server laten transcriberen en samenvatten. De voortgang en het
 * resultaat komen via het Firestore-document binnen (ook als deze aanroep
 * wegvalt doordat je de app sluit; de server werkt gewoon door).
 */
export async function processCall(leadId, callId) {
  if (!callable) callable = httpsCallable(getFunctions(app, "europe-west1"), "processCall", { timeout: 560000 });
  const res = await callable({ leadId, callId });
  return res.data;
}

export async function saveCallResult(leadId, callId, patch) {
  const data = {};
  Object.entries(patch).forEach(([k, v]) => {
    data[`result.${k}`] = v;
  });
  data.editedAt = serverTimestamp();
  await updateDoc(callRef(leadId, callId), data);
}

export async function approveCall(lead, call, user) {
  const deleteAfter = new Date(Date.now() + AUDIO_DELETE_DAYS * 24 * 3600 * 1000);
  await updateDoc(callRef(lead.id, call.id), {
    status: "approved",
    approvedAt: serverTimestamp(),
    approvedByUserId: user?.id || "",
    approvedByName: user?.displayName || user?.email || "",
    audioDeleteAfter: deleteAfter,
    transcript: deleteField(),
    // Vangnet: nooit [check] in goedgekeurde teksten.
    "result.uitgebreid": stripChecks(call.result?.uitgebreid),
    "result.kort": stripChecks(call.result?.kort),
    "result.appje": stripChecks(call.result?.appje),
  });
  await addActivity(
    lead,
    {
      type: "system",
      title: "Gesprek verwerkt: samenvattingen goedgekeurd",
      description: stripChecks(call.result?.kort),
      metadata: { event: "call_approved", callId: call.id },
    },
    user
  ).catch(() => {});
}

export async function reopenCall(leadId, callId) {
  await updateDoc(callRef(leadId, callId), { status: "done", audioDeleteAfter: deleteField() });
}

export async function deleteCall(leadId, call) {
  for (const path of callAudioPaths(call)) {
    await deleteObject(ref(storage, path)).catch((e) => {
      if (e?.code !== "storage/object-not-found") throw e;
    });
  }
  await deleteDoc(callRef(leadId, call.id));
}

export function getCallAudioUrl(call, index = 0) {
  return getDownloadURL(ref(storage, callAudioPaths(call)[index]));
}

// ─── INSTELLINGEN & TEGOED ───────────────────────────────────────────────────
export function subscribeCallSettings(onData, onError) {
  return onSnapshot(
    doc(db, "settings", "gesprekken"),
    (snap) => onData(snap && snap.exists && snap.exists() ? snap.data() : {}),
    onError
  );
}

export async function saveCallSettings(patch) {
  await setDoc(doc(db, "settings", "gesprekken"), clean({ ...patch, updatedAt: serverTimestamp() }), { merge: true });
}

/** Tegoed bijwerken na opwaarderen: vanaf nu wordt het verbruik hiervan afgetrokken. */
export async function setCredit(settings, creditUsd) {
  await saveCallSettings({ creditUsd: Number(creditUsd) || 0, spentAtCreditSet: Number(settings?.spentUsd || 0), creditSetAt: serverTimestamp() });
}

export function creditStatus(settings) {
  const s = settings || {};
  const configured = typeof s.creditUsd === "number" && s.creditUsd > 0;
  const spentSince = Math.max(0, Number(s.spentUsd || 0) - Number(s.spentAtCreditSet || 0));
  const remainingUsd = configured ? s.creditUsd - spentSince : null;
  const avgUsd = s.processedCount ? Number(s.spentUsd || 0) / s.processedCount : 0.06;
  const warnUsd = typeof s.creditWarnUsd === "number" ? s.creditWarnUsd : DEFAULT_WARN_USD;
  return {
    configured,
    spentSince,
    remainingUsd,
    avgUsd,
    callsLeft: configured && avgUsd > 0 ? Math.max(0, Math.floor(remainingUsd / avgUsd)) : null,
    warnUsd,
    low: configured && remainingUsd < warnUsd,
    empty: configured && remainingUsd <= 0.05,
  };
}

export function formatUsd(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  return `$${Number(n).toFixed(n < 1 ? 3 : 2)}`;
}

// ─── TEKSTHULPEN ─────────────────────────────────────────────────────────────
/** Markdown → WhatsApp-opmaak (*vet*, • bullets). */
export function toWhatsApp(md) {
  return String(md || "")
    .replace(/^#{1,6}\s+(.*)$/gm, "*$1*")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(s) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[check\]/gi, '<mark class="check">[check]</mark>');
}

/** Eenvoudige, veilige Markdown → HTML (koppen, vet, bullets, genummerd, alinea's). */
export function markdownToHtml(md) {
  const lines = String(md || "").replace(/\r/g, "").split("\n");
  const out = [];
  let list = null;
  let para = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join("<br>")}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.type}>`);
    list = null;
  };
  lines.forEach((raw) => {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
      flushPara();
      flushList();
      const level = Math.min(m[1].length, 3);
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
    } else if ((m = /^\s*[-*•]\s+(.*)$/.exec(line))) {
      flushPara();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(m[1]);
    } else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      flushPara();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(m[1]);
    } else {
      flushList();
      para.push(line.replace(/^>\s?/, ""));
    }
  });
  flushPara();
  flushList();
  return out.join("\n");
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
