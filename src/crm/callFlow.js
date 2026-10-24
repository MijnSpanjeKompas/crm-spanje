// ─── OPNEMEN + UPLOADEN (los van de schermen) ───────────────────────────────
// Deze module leeft buiten React. Daardoor loopt een opname gewoon door als je
// tijdens het gesprek van tabblad wisselt (bijv. naar Zoekprofiel om de lead
// sheet in te vullen) of het leaddossier sluit. Ook een upload loopt door.
//
// Veiligheid:
//  - elke 4 seconden gaat een stukje audio naar IndexedDB op dit toestel;
//  - de lokale kopie wordt pas verwijderd als de server de upload bevestigt;
//  - mislukt iets, dan blijft de opname staan en kun je het opnieuw proberen.

import * as local from "./recordingStore";
import { newCallId, uploadCallAudio, processCall } from "./calls";

const TIMESLICE_MS = 4000;

let state = { recording: null, jobs: {}, localRecs: [], backupAvailable: local.available() };
const listeners = new Set();

function emit(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

function setJob(callId, patch) {
  const jobs = { ...state.jobs };
  if (patch === null) delete jobs[callId];
  else jobs[callId] = { ...(jobs[callId] || {}), ...patch };
  emit({ jobs });
}

export async function refreshLocalRecs() {
  const recs = await local.listRecs();
  const activeId = state.recording?.recId;
  const next = recs.filter((r) => r.id !== activeId);
  const key = (list) => list.map((r) => `${r.id}:${r.state}:${r.chunkCount || 0}`).join("|");
  if (key(next) !== key(state.localRecs)) emit({ localRecs: next });
  return recs;
}

// ─── OPNEMEN ─────────────────────────────────────────────────────────────────
let rt = null; // runtime: { recorder, stream, chunks, idx, timer, wakeLock, onVisibility, onBeforeUnload }

function pickMimeType() {
  if (typeof window === "undefined" || !window.MediaRecorder) return "";
  const options = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return options.find((t) => window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(t)) || "";
}

export function recordingSupported() {
  return typeof window !== "undefined" && Boolean(window.MediaRecorder) && Boolean(navigator.mediaDevices?.getUserMedia);
}

async function requestWakeLock() {
  try {
    if (rt && navigator.wakeLock && document.visibilityState === "visible") rt.wakeLock = await navigator.wakeLock.request("screen");
  } catch (e) {
    /* niet elke browser ondersteunt dit */
  }
}

export async function startRecording({ lead, zekerWeten, user }) {
  if (state.recording) throw new Error("Er loopt al een opname.");
  if (!recordingSupported()) throw new Error("Opnemen wordt in deze browser niet ondersteund. Gebruik Safari of Chrome, of upload een audiobestand.");
  emit({ recording: { status: "starting", leadId: lead.id, leadName: lead.name || "" } });
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      // Geen ruisonderdrukking: de lead praat via de speaker van de andere telefoon.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 },
    });
  } catch (e) {
    emit({ recording: null });
    throw new Error(e?.name === "NotAllowedError" ? "Geen toegang tot de microfoon. Sta de microfoon toe voor deze site (Instellingen → Safari → Microfoon) en probeer opnieuw." : `Microfoon starten mislukt: ${e?.message || e}`);
  }
  const mimeType = pickMimeType();
  let recorder;
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined);
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    emit({ recording: null });
    throw new Error(`Opnemen starten mislukt: ${e?.message || e}`);
  }
  const recId = `rec-${Date.now()}`;
  const callId = newCallId(lead.id);
  const startedAt = Date.now();
  const meta = {
    id: recId,
    callId,
    leadId: lead.id,
    leadName: lead.name || "",
    mimeType: recorder.mimeType || mimeType || "audio/mp4",
    source: "opname",
    startedAt,
    state: "recording",
    zekerWeten: zekerWeten || {},
    userId: user?.id || "",
  };
  let backup = local.available();
  if (backup) {
    await local.requestPersistence();
    await local.putMeta(meta).catch(() => {
      backup = false;
    });
  }

  rt = { recorder, stream, chunks: [], idx: 0, meta, backup, stopResolvers: [] };
  recorder.ondataavailable = (e) => {
    if (!e.data || !e.data.size || !rt) return;
    const i = rt.idx;
    rt.idx += 1;
    rt.chunks.push(e.data);
    if (rt.backup) {
      local.addChunk(recId, i, e.data).catch(() => {
        if (rt) rt.backup = false;
        emit({ recording: { ...state.recording, backup: false, warning: "Lokale backup werkt niet (opslag vol?). De opname loopt wel door." } });
      });
      local.patchMeta(recId, { durationMs: Date.now() - startedAt }).catch(() => {});
    }
  };
  recorder.onstop = () => {
    const resolvers = rt?.stopResolvers || [];
    resolvers.forEach((r) => r());
  };
  // Microfoon valt weg (bijv. telefoon gaat op slot of een ander app pakt de mic).
  stream.getAudioTracks().forEach((t) => {
    t.onended = () => {
      if (state.recording?.status === "recording") {
        emit({ recording: { ...state.recording, warning: "De microfoon is gestopt (scherm op slot of andere app?). Wat is opgenomen, is bewaard. Klik op Stop & verwerken." } });
      }
    };
  });

  rt.onVisibility = () => {
    if (document.visibilityState === "visible") requestWakeLock();
  };
  rt.onBeforeUnload = (e) => {
    e.preventDefault();
    e.returnValue = "Er loopt nog een opname.";
    return e.returnValue;
  };
  document.addEventListener("visibilitychange", rt.onVisibility);
  window.addEventListener("beforeunload", rt.onBeforeUnload);
  rt.timer = setInterval(() => {
    if (state.recording?.status === "recording") emit({ recording: { ...state.recording, elapsedMs: Date.now() - startedAt } });
  }, 1000);

  recorder.start(TIMESLICE_MS);
  await requestWakeLock();
  emit({ recording: { status: "recording", leadId: lead.id, leadName: lead.name || "", recId, callId, startedAt, elapsedMs: 0, backup: rt.backup, zekerWeten: meta.zekerWeten } });
  return { recId, callId };
}

/** "Zeker weten"-notitie bijwerken terwijl je opneemt (wordt meegestuurd bij stoppen). */
export function updateRecordingNotes(zekerWeten) {
  if (!state.recording || !rt) return;
  rt.meta.zekerWeten = zekerWeten;
  emit({ recording: { ...state.recording, zekerWeten } });
  if (rt.backup) local.patchMeta(rt.meta.id, { zekerWeten }).catch(() => {});
}

function teardown() {
  if (!rt) return;
  clearInterval(rt.timer);
  document.removeEventListener("visibilitychange", rt.onVisibility);
  window.removeEventListener("beforeunload", rt.onBeforeUnload);
  try {
    if (rt.wakeLock) rt.wakeLock.release();
  } catch (e) {
    /* al vrijgegeven */
  }
  rt.stream.getTracks().forEach((t) => t.stop());
}

/** Stopt de opname en start direct upload + verwerking. */
export async function stopRecording({ user } = {}) {
  if (!rt || !state.recording) return null;
  const current = rt;
  emit({ recording: { ...state.recording, status: "stopping" } });
  await new Promise((resolve) => {
    current.stopResolvers.push(resolve);
    if (current.recorder.state !== "inactive") current.recorder.stop();
    else resolve();
    setTimeout(resolve, 4000); // vangnet als onstop niet komt
  });
  teardown();
  const durationMs = Date.now() - current.meta.startedAt;
  const blob = new Blob(current.chunks, { type: current.meta.mimeType });
  const meta = { ...current.meta, state: "stopped", durationMs };
  if (current.backup) await local.patchMeta(meta.id, { state: "stopped", durationMs }).catch(() => {});
  rt = null;
  emit({ recording: null });
  uploadAndProcess({ meta, blob, user });
  return meta;
}

// ─── UPLOADEN + VERWERKEN ────────────────────────────────────────────────────
/**
 * Upload naar Firebase en start de verwerking. De lokale kopie wordt pas
 * verwijderd als de upload bevestigd is. Gooit nooit: fouten komen in jobs.
 */
export async function uploadAndProcess({ meta, blob, user }) {
  const { callId, leadId } = meta;
  setJob(callId, { leadId, leadName: meta.leadName, recId: meta.id, phase: "uploading", progress: 0, error: "" });
  try {
    let audio = blob;
    if (!audio && meta.id) audio = await local.getBlob(meta);
    if (!audio || !audio.size) throw new Error("De opname op dit toestel is leeg of niet meer leesbaar.");
    await uploadCallAudio({
      leadId,
      callId,
      blob: audio,
      mimeType: meta.mimeType || audio.type,
      fileName: meta.fileName,
      source: meta.source,
      durationSec: meta.durationMs ? Math.round(meta.durationMs / 1000) : null,
      zekerWeten: meta.zekerWeten,
      user,
      onProgress: (p) => setJob(callId, { progress: p }),
    });
  } catch (e) {
    console.error(e);
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    setJob(callId, {
      phase: "upload_error",
      retry: () => uploadAndProcess({ meta, blob, user }),
      error: `${offline ? "Geen internet. " : ""}Uploaden mislukt${e?.message && !offline ? ` (${e.message})` : ""}. De opname staat veilig op dit toestel; probeer het opnieuw zodra je verbinding hebt.`,
    });
    refreshLocalRecs();
    return;
  }
  // Upload bevestigd → lokale kopie mag weg.
  if (meta.id) await local.deleteRec(meta.id).catch(() => {});
  setJob(callId, null);
  refreshLocalRecs();
  startProcessing(leadId, callId);
}

/** Server laten verwerken. Status en fouten komen via Firestore binnen. */
export function startProcessing(leadId, callId) {
  return processCall(leadId, callId).catch((e) => {
    // Wegvallen van de verbinding of time-out van de app: de server werkt door.
    console.warn("processCall", e?.code, e?.message);
    return null;
  });
}

/** Audiobestand (bijv. uit Dictafoon) toevoegen: eerst lokaal bewaren, dan uploaden. */
export async function addAudioFile({ lead, file, zekerWeten, user }) {
  const callId = newCallId(lead.id);
  const meta = {
    id: `file-${Date.now()}`,
    callId,
    leadId: lead.id,
    leadName: lead.name || "",
    mimeType: file.type || "",
    fileName: file.name || "",
    source: "bestand",
    startedAt: Date.now(),
    state: "stopped",
    zekerWeten: zekerWeten || {},
  };
  let stored = false;
  if (local.available()) {
    try {
      await local.putMeta(meta);
      await local.addChunk(meta.id, 0, file);
      stored = true;
    } catch (e) {
      stored = false;
    }
  }
  await uploadAndProcess({ meta: stored ? meta : { ...meta, id: null }, blob: file, user });
  return callId;
}

/** Een eerder lokaal bewaarde opname (na een crash of mislukte upload) alsnog uploaden. */
export async function retryLocalRec(rec, user) {
  return uploadAndProcess({ meta: rec, blob: null, user });
}

export async function discardLocalRec(rec) {
  await local.deleteRec(rec.id);
  return refreshLocalRecs();
}

export async function downloadLocalRec(rec) {
  const blob = await local.getBlob(rec);
  if (!blob) throw new Error("Geen audio gevonden.");
  const ext = /mp4|m4a|aac/.test(blob.type) ? "m4a" : /webm/.test(blob.type) ? "webm" : /ogg/.test(blob.type) ? "ogg" : "m4a";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gesprek-${(rec.leadName || "lead").replace(/[^a-z0-9]+/gi, "-")}-${new Date(rec.startedAt).toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function clearJob(callId) {
  setJob(callId, null);
}
