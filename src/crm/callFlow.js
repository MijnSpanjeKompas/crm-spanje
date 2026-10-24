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

const MIC_CONSTRAINTS = {
  // Geen ruisonderdrukking: de lead praat via de speaker van de andere telefoon.
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 },
};
const RESUME_INTERVAL_MS = 2500;

function micError(e) {
  return e?.name === "NotAllowedError"
    ? "Geen toegang tot de microfoon. Sta de microfoon toe voor deze site (Instellingen → Safari → Microfoon) en probeer opnieuw."
    : `Microfoon starten mislukt: ${e?.message || e}`;
}

function patchRecording(patch) {
  if (state.recording) emit({ recording: { ...state.recording, ...patch } });
}

/**
 * Start één deel van de opname. Na een onderbreking (bijv. een inkomend
 * telefoontje dat de microfoon overneemt) begint automatisch een nieuw deel.
 */
async function startSegment() {
  const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
  const mimeType = rt.mimeType;
  let recorder;
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined);
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw e;
  }
  const seg = rt.segments.length;
  rt.segments.push([]);
  rt.stream = stream;
  rt.recorder = recorder;
  const recId = rt.meta.id;

  recorder.ondataavailable = (e) => {
    if (!e.data || !e.data.size || !rt) return;
    const i = rt.idx;
    rt.idx += 1;
    rt.segments[seg].push(e.data);
    if (rt.backup) {
      local.addChunk(recId, i, e.data, seg).catch(() => {
        if (rt) rt.backup = false;
        patchRecording({ backup: false, warning: "Lokale backup werkt niet (opslag vol?). De opname loopt wel door." });
      });
      local.patchMeta(recId, { durationMs: Date.now() - rt.meta.startedAt, parts: seg + 1 }).catch(() => {});
    }
  };
  recorder.onstop = () => {
    if (!rt || rt.recorder !== recorder) return;
    if (rt.stopping) {
      rt.stopResolvers.forEach((r) => r());
    } else {
      interrupted("De opname werd onderbroken");
    }
  };
  recorder.onerror = () => {
    if (rt && rt.recorder === recorder && !rt.stopping) interrupted("De opname gaf een fout");
  };
  // iOS pauzeert soms in plaats van te stoppen (bijv. tijdens een telefoontje).
  recorder.onpause = () => {
    if (rt && rt.recorder === recorder && !rt.stopping) {
      patchRecording({ status: "interrupted", warning: "Opname gepauzeerd door het toestel (telefoontje?). Wordt automatisch hervat zodra het kan." });
      scheduleResume();
    }
  };
  stream.getAudioTracks().forEach((t) => {
    t.onended = () => {
      if (rt && rt.stream === stream && !rt.stopping) interrupted("De microfoon werd overgenomen (telefoontje of andere app)");
    };
    t.onmute = () => {
      if (rt && rt.stream === stream && !rt.stopping) patchRecording({ warning: "Microfoon tijdelijk stil (telefoontje?). De opname loopt door zodra het geluid terug is." });
    };
    t.onunmute = () => {
      if (rt && rt.stream === stream && state.recording?.status === "recording") patchRecording({ warning: "" });
    };
  });
  recorder.start(TIMESLICE_MS);
  return seg;
}

function interrupted(reason) {
  if (!rt || rt.stopping) return;
  try {
    rt.stream.getTracks().forEach((t) => t.stop());
  } catch (e) {
    /* al gestopt */
  }
  rt.recorder = null;
  rt.interruptions += 1;
  patchRecording({ status: "interrupted", warning: `${reason}. Alles tot nu toe is bewaard; de opname wordt automatisch hervat.` });
  scheduleResume();
}

function scheduleResume() {
  if (!rt || rt.resumeTimer) return;
  rt.resumeTimer = setTimeout(async () => {
    if (!rt) return;
    rt.resumeTimer = null;
    if (rt.stopping) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      scheduleResume();
      return;
    }
    try {
      await resumeRecording();
    } catch (e) {
      patchRecording({ warning: "Hervatten lukt nog niet (is het telefoontje voorbij?). Klik op Opname hervatten, of op Stop & verwerken.", canResume: true });
      scheduleResume();
    }
  }, RESUME_INTERVAL_MS);
}

/** Opname na een onderbreking verder laten gaan (automatisch of via de knop). */
export async function resumeRecording() {
  if (!rt || rt.stopping) return;
  const rec = rt.recorder;
  if (rec && rec.state === "paused") {
    rec.resume();
    if (rec.state === "recording") {
      patchRecording({ status: "recording", warning: "", canResume: false });
      return;
    }
  }
  if (rec && rec.state === "recording" && rt.stream.getAudioTracks().every((t) => t.readyState === "live")) {
    patchRecording({ status: "recording", warning: "", canResume: false });
    return;
  }
  if (rec) {
    // Oude recorder netjes afsluiten; wat er nog in zat komt in het oude deel.
    rt.recorder = null;
    try {
      if (rec.state !== "inactive") rec.stop();
    } catch (e) {
      /* negeren */
    }
    rt.stream.getTracks().forEach((t) => t.stop());
  }
  const seg = await startSegment();
  await requestWakeLock();
  patchRecording({ status: "recording", parts: seg + 1, canResume: false, warning: `Opname hervat (deel ${seg + 1}). Het stuk tijdens de onderbreking ontbreekt.` });
  setTimeout(() => {
    if (state.recording?.warning?.startsWith("Opname hervat")) patchRecording({ warning: "" });
  }, 8000);
}

export async function startRecording({ lead, zekerWeten, user }) {
  if (state.recording) throw new Error("Er loopt al een opname.");
  if (!recordingSupported()) throw new Error("Opnemen wordt in deze browser niet ondersteund. Gebruik Safari of Chrome, of upload een audiobestand.");
  emit({ recording: { status: "starting", leadId: lead.id, leadName: lead.name || "" } });
  const mimeType = pickMimeType();
  const recId = `rec-${Date.now()}`;
  const callId = newCallId(lead.id);
  const startedAt = Date.now();
  const meta = {
    id: recId,
    callId,
    leadId: lead.id,
    leadName: lead.name || "",
    mimeType: mimeType || "audio/mp4",
    source: "opname",
    startedAt,
    state: "recording",
    zekerWeten: zekerWeten || {},
    userId: user?.id || "",
  };
  rt = { meta, mimeType, backup: local.available(), segments: [], idx: 0, stopResolvers: [], stopping: false, interruptions: 0, resumeTimer: null };
  try {
    await startSegment();
  } catch (e) {
    rt = null;
    emit({ recording: null });
    throw new Error(micError(e));
  }
  if (rt.recorder.mimeType) meta.mimeType = rt.recorder.mimeType;
  if (rt.backup) {
    await local.requestPersistence();
    await local.putMeta(meta).catch(() => {
      if (rt) rt.backup = false;
    });
  }

  rt.onVisibility = () => {
    if (document.visibilityState !== "visible" || !rt) return;
    requestWakeLock();
    // Terug in de app na een telefoontje: meteen proberen te hervatten.
    if (state.recording?.status === "interrupted") {
      clearTimeout(rt.resumeTimer);
      rt.resumeTimer = null;
      resumeRecording().catch(() => scheduleResume());
    }
  };
  rt.onBeforeUnload = (e) => {
    e.preventDefault();
    e.returnValue = "Er loopt nog een opname.";
    return e.returnValue;
  };
  document.addEventListener("visibilitychange", rt.onVisibility);
  window.addEventListener("focus", rt.onVisibility);
  window.addEventListener("beforeunload", rt.onBeforeUnload);
  rt.timer = setInterval(() => {
    if (state.recording && state.recording.status !== "stopping") emit({ recording: { ...state.recording, elapsedMs: Date.now() - startedAt } });
  }, 1000);

  await requestWakeLock();
  emit({ recording: { status: "recording", leadId: lead.id, leadName: lead.name || "", recId, callId, startedAt, elapsedMs: 0, parts: 1, backup: rt.backup, zekerWeten: meta.zekerWeten } });
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
  clearTimeout(rt.resumeTimer);
  document.removeEventListener("visibilitychange", rt.onVisibility);
  window.removeEventListener("focus", rt.onVisibility);
  window.removeEventListener("beforeunload", rt.onBeforeUnload);
  try {
    if (rt.wakeLock) rt.wakeLock.release();
  } catch (e) {
    /* al vrijgegeven */
  }
  if (rt.stream) rt.stream.getTracks().forEach((t) => t.stop());
}

/** Stopt de opname en start direct upload + verwerking. */
export async function stopRecording({ user } = {}) {
  if (!rt || !state.recording) return null;
  const current = rt;
  current.stopping = true;
  clearTimeout(current.resumeTimer);
  emit({ recording: { ...state.recording, status: "stopping" } });
  const rec = current.recorder;
  if (rec && rec.state !== "inactive") {
    await new Promise((resolve) => {
      current.stopResolvers.push(resolve);
      try {
        rec.stop();
      } catch (e) {
        resolve();
      }
      setTimeout(resolve, 4000); // vangnet als onstop niet komt
    });
  }
  teardown();
  const durationMs = Date.now() - current.meta.startedAt;
  const blobs = current.segments.filter((chunks) => chunks.length).map((chunks) => new Blob(chunks, { type: current.meta.mimeType }));
  const meta = { ...current.meta, state: "stopped", durationMs, parts: blobs.length };
  if (current.backup) await local.patchMeta(meta.id, { state: "stopped", durationMs, parts: blobs.length }).catch(() => {});
  rt = null;
  emit({ recording: null });
  uploadAndProcess({ meta, blobs, user });
  return meta;
}

// ─── UPLOADEN + VERWERKEN ────────────────────────────────────────────────────
/**
 * Upload naar Firebase en start de verwerking. De lokale kopie wordt pas
 * verwijderd als de upload bevestigd is. Gooit nooit: fouten komen in jobs.
 */
export async function uploadAndProcess({ meta, blobs, user }) {
  const { callId, leadId } = meta;
  setJob(callId, { leadId, leadName: meta.leadName, recId: meta.id, phase: "uploading", progress: 0, error: "" });
  try {
    let audio = (blobs || []).filter((b) => b && b.size);
    if (!audio.length && meta.id) audio = (await local.getBlobs(meta)).filter((b) => b.size);
    if (!audio.length) throw new Error("De opname op dit toestel is leeg of niet meer leesbaar.");
    await uploadCallAudio({
      leadId,
      callId,
      blobs: audio,
      mimeType: meta.mimeType || audio[0].type,
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
      retry: () => uploadAndProcess({ meta, blobs, user }),
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
  await uploadAndProcess({ meta: stored ? meta : { ...meta, id: null }, blobs: [file], user });
  return callId;
}

/** Een eerder lokaal bewaarde opname (na een crash of mislukte upload) alsnog uploaden. */
export async function retryLocalRec(rec, user) {
  return uploadAndProcess({ meta: rec, blobs: null, user });
}

export async function discardLocalRec(rec) {
  await local.deleteRec(rec.id);
  return refreshLocalRecs();
}

export async function downloadLocalRec(rec) {
  const blobs = (await local.getBlobs(rec)).filter((b) => b.size);
  if (!blobs.length) throw new Error("Geen audio gevonden.");
  blobs.forEach((blob, i) => {
    const ext = /mp4|m4a|aac/.test(blob.type) ? "m4a" : /webm/.test(blob.type) ? "webm" : /ogg/.test(blob.type) ? "ogg" : "m4a";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gesprek-${(rec.leadName || "lead").replace(/[^a-z0-9]+/gi, "-")}-${new Date(rec.startedAt).toISOString().slice(0, 16).replace(/[:T]/g, "-")}${blobs.length > 1 ? `-deel${i + 1}` : ""}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
}

export function clearJob(callId) {
  setJob(callId, null);
}

/** Alleen voor tests: interne opnamestatus. */
export function __runtime() {
  return rt;
}
