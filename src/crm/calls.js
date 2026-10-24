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
export async function uploadCallAudio({ leadId, callId, blob, mimeType, fileName, source, durationSec, zekerWeten, user, onProgress }) {
  if (!blob || !blob.size) throw new Error("De opname is leeg.");
  if (blob.size > MAX_AUDIO_BYTES) throw new Error("Dit audiobestand is groter dan 500 MB.");
  const { ext, contentType } = audioMeta(mimeType, fileName);
  const storagePath = `leads/${leadId}/gesprekken/${callId}.${ext}`;
  await setDoc(
    callRef(leadId, callId),
    clean({
      status: "uploading",
      source: source || "opname",
      fileName: fileName || "",
      size: blob.size,
      durationSec: durationSec || null,
      zekerWeten: zekerWeten || {},
      createdAt: serverTimestamp(),
      createdByUserId: user?.id || "",
      createdByName: user?.displayName || user?.email || "",
    }),
    { merge: true }
  );
  await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, storagePath), blob, { contentType, customMetadata: { leadId, callId } });
    task.on("state_changed", (s) => onProgress && s.totalBytes && onProgress(s.bytesTransferred / s.totalBytes), reject, resolve);
  });
  await updateDoc(callRef(leadId, callId), { status: "uploaded", audioPath: storagePath, audioContentType: contentType, uploadedAt: serverTimestamp() });
  return storagePath;
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
  });
  await addActivity(
    lead,
    {
      type: "system",
      title: "Gesprek verwerkt: samenvattingen goedgekeurd",
      description: call.result?.kort || "",
      metadata: { event: "call_approved", callId: call.id },
    },
    user
  ).catch(() => {});
}

export async function reopenCall(leadId, callId) {
  await updateDoc(callRef(leadId, callId), { status: "done", audioDeleteAfter: deleteField() });
}

export async function deleteCall(leadId, call) {
  if (call.audioPath) {
    await deleteObject(ref(storage, call.audioPath)).catch((e) => {
      if (e?.code !== "storage/object-not-found") throw e;
    });
  }
  await deleteDoc(callRef(leadId, call.id));
}

export function getCallAudioUrl(call) {
  return getDownloadURL(ref(storage, call.audioPath));
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

/** Opent een opgemaakte pagina en het printvenster (→ "Bewaar als PDF"). */
export function openSummaryPdf(markdown, leadName) {
  const win = window.open("", "_blank");
  if (!win) throw new Error("Je browser blokkeert pop-ups. Sta pop-ups toe voor deze site.");
  const title = `Leadsamenvatting ${leadName || ""}`.trim();
  const logo = `${window.location.origin}/msk-logo.png`;
  win.document.write(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { size: A4; margin: 18mm 18mm 20mm; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1d2a38; font-size: 11pt; line-height: 1.5; max-width: 760px; margin: 24px auto; padding: 0 16px; }
  header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #e5b13a; padding-bottom: 10px; margin-bottom: 18px; }
  header img { height: 34px; }
  header span { font-size: 9pt; color: #6b7785; }
  h1 { font-size: 18pt; color: #0d2b4a; margin: 0 0 14px; line-height: 1.2; }
  h2 { font-size: 12.5pt; color: #0d2b4a; margin: 18px 0 6px; break-after: avoid; }
  h3 { font-size: 11pt; color: #0d2b4a; margin: 12px 0 4px; }
  p { margin: 0 0 8px; }
  ul, ol { margin: 0 0 8px; padding-left: 20px; }
  li { margin: 2px 0; }
  mark.check { background: #fde7b0; color: #7d5710; padding: 0 3px; border-radius: 3px; }
  footer { margin-top: 26px; padding-top: 8px; border-top: 1px solid #e3ddd1; font-size: 9pt; color: #6b7785; }
  @media print { body { margin: 0 auto; } .noprint { display: none; } }
</style></head><body>
<header><img src="${logo}" alt="Mijn Spanje Kompas" onerror="this.style.display='none'"><span>Mijn Spanje Kompas – leadsamenvatting</span></header>
${markdownToHtml(markdown)}
<footer>Mijn Spanje Kompas – leadsamenvatting</footer>
<p class="noprint" style="margin-top:20px;font-size:10pt;color:#6b7785">Kies in het printvenster “Bewaar als PDF” (iPhone: Deel → Opslaan in Bestanden).</p>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
</body></html>`);
  win.document.close();
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
