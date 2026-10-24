// ─── GESPREK VERWERKEN (audio → transcript → 3 teksten) ─────────────────────
// Callable: processCall({ leadId, callId })
//
// Volgorde (veilig):
//  1. De app uploadt de audio eerst naar Storage en zet de status op "uploaded".
//  2. Deze functie zet de status op "processing" (nooit twee keer tegelijk).
//  3. Audio → mono 16 kHz mp3 → stukken van 10 minuten (ffmpeg).
//  4. Elk stuk → Groq Whisper (gratis). Transcript wordt tijdelijk bewaard, zodat
//     een nieuwe poging na een AI-fout niet opnieuw hoeft te transcriberen.
//  5. Transcript + notitie → Claude (één call, vaste output via tool).
//  6. Resultaat + kosten in het call-document, status "done".
// Bij elke fout: status "error" met een Nederlandse uitleg. De audio wordt NOOIT
// door deze functie verwijderd; dat gebeurt pas 14 dagen na goedkeuren.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const {
  DEFAULT_MODEL,
  DEFAULT_WHISPER_HINT,
  MAX_OUTPUT_TOKENS,
  MODEL_PRICES,
  OUTPUT_TOOL,
  buildSystemPrompt,
  buildUserMessage,
  costUsd,
} = require("../../src/crm/gesprekPrompt");

const GROQ_API_KEY = defineSecret("GROQ_API_KEY");
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const SEGMENT_SECONDS = 600; // 10 minuten per stuk (~2,4 MB, ruim onder de 25 MB van Groq)
const STALE_PROCESSING_MS = 12 * 60 * 1000; // daarna mag een "vastgelopen" verwerking opnieuw
const WHISPER_MODEL = "whisper-large-v3";

function db() {
  return admin.firestore();
}

class CallError extends Error {
  constructor(kind, message, detail) {
    super(message);
    this.kind = kind;
    this.detail = detail;
  }
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${err.message}\n${String(stderr).slice(-2000)}`));
      else resolve({ stdout, stderr });
    });
  });
}

function ffmpegPath() {
  // ffmpeg-static levert een kant-en-klaar ffmpeg-programma mee.
  // eslint-disable-next-line global-require
  return require("ffmpeg-static");
}

/** Converteert naar mono 16 kHz mp3 (32 kbps) en knipt in stukken van 10 minuten. */
async function splitAudio(inputFile, workDir) {
  const pattern = path.join(workDir, "deel_%03d.mp3");
  try {
    await run(ffmpegPath(), [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", inputFile,
      "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k",
      "-f", "segment", "-segment_time", String(SEGMENT_SECONDS), "-reset_timestamps", "1",
      pattern,
    ]);
  } catch (e) {
    throw new CallError("audio", "Het audiobestand kon niet worden gelezen. Is het een geldige opname? De audio is bewaard; je kunt hem downloaden en controleren.", e.message);
  }
  const parts = fs.readdirSync(workDir).filter((f) => /^deel_\d+\.mp3$/.test(f)).sort();
  if (!parts.length) throw new CallError("audio", "Er zat geen geluid in het audiobestand.");
  return parts.map((f) => path.join(workDir, f));
}

async function transcribePart(file, hint, apiKey) {
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(file)], { type: "audio/mpeg" }), path.basename(file));
  form.append("model", WHISPER_MODEL);
  form.append("language", "nl");
  form.append("temperature", "0");
  form.append("response_format", "json");
  if (hint) form.append("prompt", hint.slice(0, 800));

  let res;
  try {
    res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (e) {
    throw new CallError("network", "Geen verbinding met de transcriptiedienst (Groq). Probeer het zo opnieuw; de audio is veilig.", e.message);
  }
  const text = await res.text();
  if (res.ok) {
    try {
      return String(JSON.parse(text).text || "").trim();
    } catch (e) {
      throw new CallError("groq", "Onverwacht antwoord van de transcriptiedienst. Probeer het opnieuw.", text.slice(0, 500));
    }
  }
  if (res.status === 429) {
    const wait = Number(res.headers.get("retry-after")) || 0;
    const minutes = wait ? Math.max(1, Math.ceil(wait / 60)) : null;
    throw new CallError(
      "groq_limit",
      `De gratis transcriptielimiet van Groq is even bereikt.${minutes ? ` Probeer het over ongeveer ${minutes} minuten opnieuw.` : " Probeer het later opnieuw."} De audio is veilig bewaard.`,
      text.slice(0, 500)
    );
  }
  if (res.status === 401 || res.status === 403) throw new CallError("groq_key", "De Groq API-key klopt niet of is verlopen. Controleer GROQ_API_KEY.", text.slice(0, 300));
  if (res.status === 413) throw new CallError("groq", "Een audiodeel was te groot voor de transcriptie.", text.slice(0, 300));
  throw new CallError("groq", `Transcriptie mislukt (Groq, status ${res.status}). Probeer het opnieuw; de audio is veilig.`, text.slice(0, 500));
}

async function callClaude({ model, system, user, apiKey }) {
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        tools: [OUTPUT_TOOL],
        tool_choice: { type: "tool", name: OUTPUT_TOOL.name },
        messages: [{ role: "user", content: user }],
      }),
    });
  } catch (e) {
    throw new CallError("network", "Geen verbinding met Claude. Probeer het zo opnieuw; het transcript is bewaard.", e.message);
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    /* hieronder afgehandeld */
  }
  if (!res.ok) {
    const msg = json?.error?.message || text.slice(0, 300);
    if (/credit balance/i.test(msg)) throw new CallError("credit", "Het Claude-tegoed is op. Waardeer op in de Anthropic-console en klik daarna op 'Opnieuw verwerken'. Audio en transcript zijn bewaard.", msg);
    if (res.status === 401 || res.status === 403) throw new CallError("anthropic_key", "De Anthropic API-key klopt niet. Controleer ANTHROPIC_API_KEY.", msg);
    if (res.status === 429 || res.status === 529 || res.status >= 500) throw new CallError("busy", "Claude is even overbelast. Probeer het over een paar minuten opnieuw; het transcript is bewaard.", msg);
    if (/model/i.test(msg)) throw new CallError("model", `Het gekozen AI-model wordt niet herkend (${model}). Kies een ander model onder Instellingen.`, msg);
    throw new CallError("anthropic", `Claude gaf een fout (status ${res.status}). Probeer het opnieuw.`, msg);
  }
  const tool = (json?.content || []).find((c) => c.type === "tool_use");
  const usage = json?.usage || {};
  if (!tool || !tool.input) {
    throw Object.assign(new CallError("anthropic", "Claude gaf geen bruikbaar antwoord. Probeer het opnieuw.", text.slice(0, 500)), { usage });
  }
  if (json.stop_reason === "max_tokens") {
    throw Object.assign(new CallError("anthropic", "Het antwoord van Claude was te lang en is afgebroken. Probeer het opnieuw.", ""), { usage });
  }
  return { result: tool.input, usage };
}

function cleanResult(r) {
  const s = (v) => String(v || "").trim();
  return {
    uitgebreid: s(r.uitgebreid),
    kort: s(r.kort),
    appje: s(r.appje),
    checks: Array.isArray(r.checks) ? r.checks.map(s).filter(Boolean).slice(0, 20) : [],
    leadtemperatuur: s(r.leadtemperatuur),
    leadtype: s(r.leadtype),
  };
}

async function claimCall(callRef) {
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists) throw new HttpsError("not-found", "Dit gesprek bestaat niet (meer).");
    const call = snap.data();
    if (!call.audioPath) throw new HttpsError("failed-precondition", "De audio is nog niet (volledig) geüpload.");
    if (call.status === "approved") throw new HttpsError("failed-precondition", "Dit gesprek is al goedgekeurd.");
    const started = call.processingStartedAt?.toMillis?.() || 0;
    if (call.status === "processing" && Date.now() - started < STALE_PROCESSING_MS) {
      throw new HttpsError("already-exists", "Dit gesprek wordt al verwerkt.");
    }
    tx.update(callRef, {
      status: "processing",
      step: call.transcript ? "samenvatten" : "transcriberen",
      processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      errorKind: admin.firestore.FieldValue.delete(),
      errorMessage: admin.firestore.FieldValue.delete(),
      attempts: admin.firestore.FieldValue.increment(1),
    });
    return call;
  });
}

async function processCallImpl({ leadId, callId }) {
  const callRef = db().doc(`leads/${leadId}/calls/${callId}`);
  const call = await claimCall(callRef);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "gesprek-"));
  let anthropicUsage = null;
  let model = DEFAULT_MODEL;
  const settingsRef = db().doc("settings/gesprekken");

  try {
    const [leadSnap, settingsSnap] = await Promise.all([db().doc(`leads/${leadId}`).get(), settingsRef.get()]);
    const lead = leadSnap.exists ? leadSnap.data() : {};
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    if (MODEL_PRICES[settings.model]) model = settings.model;

    // 1. TRANSCRIPT (hergebruiken als dat er al is)
    let transcript = call.transcript || "";
    let audioSeconds = call.audioSeconds || 0;
    if (!transcript) {
      const input = path.join(workDir, "origineel");
      await admin.storage().bucket().file(call.audioPath).download({ destination: input });
      const parts = await splitAudio(input, workDir);
      const hint = String(settings.whisperHint || DEFAULT_WHISPER_HINT);
      const texts = [];
      for (let i = 0; i < parts.length; i += 1) {
        await callRef.update({ step: parts.length > 1 ? `transcriberen (deel ${i + 1} van ${parts.length})` : "transcriberen" });
        texts.push(await transcribePart(parts[i], hint, GROQ_API_KEY.value()));
      }
      transcript = texts.filter(Boolean).join("\n\n");
      audioSeconds = parts.length > 1 ? (parts.length - 1) * SEGMENT_SECONDS : 0; // grove schatting, alleen informatief
      if (!transcript.trim()) throw new CallError("empty", "In de opname is geen spraak gevonden. Controleer de audio (downloaden) en probeer eventueel een ander bestand.");
      await callRef.update({ transcript, transcriptAt: admin.firestore.FieldValue.serverTimestamp(), audioSeconds });
    }

    // 2. SAMENVATTEN
    await callRef.update({ step: "samenvatten" });
    const zeker = call.zekerWeten || {};
    const datum = call.createdAt?.toDate?.().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" });
    const { result, usage } = await callClaude({
      model,
      system: buildSystemPrompt({ extraVocab: settings.extraVocab }),
      user: buildUserMessage({
        naam: zeker.naam || lead.name,
        telefoon: zeker.telefoon || lead.phone,
        zekerWeten: zeker.notitie,
        transcript,
        datum,
      }),
      apiKey: ANTHROPIC_API_KEY.value(),
    });
    anthropicUsage = usage;
    const cost = costUsd(model, usage);
    const clean = cleanResult(result);

    await callRef.update({
      status: "done",
      step: admin.firestore.FieldValue.delete(),
      result: clean,
      original: clean, // ongewijzigde AI-versie, ter vergelijking
      model,
      usage: { input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0 },
      costUsd: admin.firestore.FieldValue.increment(cost),
      doneAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await settingsRef.set(
      { spentUsd: admin.firestore.FieldValue.increment(cost), processedCount: admin.firestore.FieldValue.increment(1), lastProcessedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    return { status: "done" };
  } catch (e) {
    const usage = anthropicUsage || e.usage;
    const kind = e instanceof CallError ? e.kind : "unknown";
    const message = e instanceof CallError ? e.message : "Er ging iets onverwachts mis. Probeer het opnieuw; de audio is veilig.";
    logger.error("Gesprek verwerken mislukt", { leadId, callId, kind, detail: e.detail || e.message });
    const patch = {
      status: "error",
      step: admin.firestore.FieldValue.delete(),
      errorKind: kind,
      errorMessage: message,
      errorAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (usage && (usage.input_tokens || usage.output_tokens)) {
      // Ook een mislukte AI-call kost geld: eerlijk meetellen.
      const cost = costUsd(model, usage);
      patch.costUsd = admin.firestore.FieldValue.increment(cost);
      await settingsRef.set({ spentUsd: admin.firestore.FieldValue.increment(cost) }, { merge: true }).catch(() => {});
    }
    await callRef.update(patch).catch((err) => logger.error("Status bijwerken mislukt", err));
    return { status: "error", kind, message };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

exports.processCall = onCall(
  {
    region: "europe-west1",
    secrets: [GROQ_API_KEY, ANTHROPIC_API_KEY],
    timeoutSeconds: 540,
    memory: "1GiB",
    maxInstances: 5,
  },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Log eerst in.");
    const { leadId, callId } = req.data || {};
    if (typeof leadId !== "string" || typeof callId !== "string" || !leadId || !callId || leadId.includes("/") || callId.includes("/")) {
      throw new HttpsError("invalid-argument", "leadId en callId zijn verplicht.");
    }
    return processCallImpl({ leadId, callId });
  }
);

// ─── OPRUIMEN: audio 14 dagen na goedkeuren verwijderen ─────────────────────
exports.cleanupCallAudio = onSchedule({ schedule: "every day 04:00", timeZone: "Europe/Amsterdam", region: "europe-west1" }, async () => {
  const now = admin.firestore.Timestamp.now();
  const snap = await db().collectionGroup("calls").where("audioDeleteAfter", "<=", now).limit(200).get();
  let removed = 0;
  for (const d of snap.docs) {
    const call = d.data();
    if (call.status !== "approved" || !call.audioPath) continue;
    try {
      await admin.storage().bucket().file(call.audioPath).delete({ ignoreNotFound: true });
      await d.ref.update({
        audioPath: null,
        audioDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
        audioDeleteAfter: admin.firestore.FieldValue.delete(),
        transcript: admin.firestore.FieldValue.delete(),
      });
      removed += 1;
    } catch (e) {
      logger.error("Audio opruimen mislukt", { path: d.ref.path, error: e.message });
    }
  }
  logger.info(`Audio opgeruimd: ${removed}`);
});
