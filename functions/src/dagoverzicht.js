// ─── DAGELIJKS OVERZICHT PER MAIL (08:00) + PRULLENBAK LEGEN ────────────────
// Elke ochtend om 08:00 (Nederlandse tijd) krijgen Luke en Indy een mail met
// wat er die dag op de planning staat, wat te laat is en welke leads nieuw zijn.
// Instellingen staan in Firestore: settings/dagoverzicht (aan te passen in het
// CRM onder Instellingen → Dagelijks overzicht).
//
// Versturen gaat via Gmail (SMTP) met een app-wachtwoord:
//   firebase functions:secrets:set GMAIL_USER          (bijv. jullie@gmail.com)
//   firebase functions:secrets:set GMAIL_APP_PASSWORD  (16 tekens, zie README)
//
// Zelfde run: leads die langer dan 30 dagen in de prullenbak liggen, worden
// definitief gewist (inclusief tijdlijn, bestanden en opnames).

process.env.TZ = "Europe/Amsterdam";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { buildDigest, DEFAULT_DIGEST_SETTINGS } = require("../../src/crm/digest");
const { normalizeLead } = require("../../src/crm/normalize");
const { PROFILES } = require("../../src/crm/profiles");

const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");
const TRASH_SUBCOLLECTIONS = ["activities", "files", "partnerLinks", "tasks", "calls"];

function db() {
  return admin.firestore();
}

async function loadSettings() {
  const snap = await db().doc("settings/dagoverzicht").get();
  const s = snap.exists ? snap.data() : {};
  return { ...DEFAULT_DIGEST_SETTINGS, ...s, recipients: { ...DEFAULT_DIGEST_SETTINGS.recipients, ...(s.recipients || {}) } };
}

async function loadData() {
  const [leadSnap, taskSnap, linkSnap] = await Promise.all([db().collection("leads").get(), db().collectionGroup("tasks").get(), db().collectionGroup("partnerLinks").get()]);
  const leads = leadSnap.docs.map((d) => normalizeLead({ id: d.id, ...d.data() }, { users: PROFILES }));
  const sub = (snap) => snap.docs.map((d) => ({ id: d.id, leadId: d.ref.parent.parent ? d.ref.parent.parent.id : "", ...d.data() }));
  return { leads, tasks: sub(taskSnap), links: sub(linkSnap) };
}

function transport() {
  return nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER.value(), pass: GMAIL_APP_PASSWORD.value() } });
}

async function sendTo(mailer, profileId, settings, data) {
  const rcpt = settings.recipients[profileId];
  const profile = PROFILES.find((p) => p.id === profileId);
  if (!profile || !rcpt || !rcpt.email) return { profileId, skipped: "geen e-mailadres" };
  const mail = buildDigest({ ...data, now: new Date(), profile, crmUrl: settings.crmUrl || "" });
  await mailer.sendMail({ from: `"MSK CRM" <${GMAIL_USER.value()}>`, to: rcpt.email, subject: mail.subject, text: mail.text, html: mail.html });
  return { profileId, sent: true, counts: mail.counts };
}

/** Verwijdert één lead met alles erop en eraan (admin). */
async function purgeLead(ref) {
  const bucket = admin.storage().bucket();
  for (const name of TRASH_SUBCOLLECTIONS) {
    const snap = await ref.collection(name).get();
    for (const d of snap.docs) {
      const data = d.data();
      const paths = [data.storagePath, data.audioPath, ...(Array.isArray(data.audioPaths) ? data.audioPaths : [])].filter(Boolean);
      for (const p of paths) await bucket.file(p).delete({ ignoreNotFound: true }).catch(() => {});
      await d.ref.delete();
    }
  }
  await ref.delete();
}

async function purgeTrash() {
  const now = admin.firestore.Timestamp.now();
  const snap = await db().collection("leads").where("purgeAfter", "<=", now).limit(100).get();
  let removed = 0;
  for (const d of snap.docs) {
    if (!d.data().deletedAt) continue; // teruggezet
    try {
      await purgeLead(d.ref);
      removed += 1;
    } catch (e) {
      logger.error("Prullenbak legen mislukt", { lead: d.id, error: e.message });
    }
  }
  return removed;
}

exports.dagoverzicht = onSchedule(
  { schedule: "every day 08:00", timeZone: "Europe/Amsterdam", region: "europe-west1", secrets: [GMAIL_USER, GMAIL_APP_PASSWORD] },
  async () => {
    const removed = await purgeTrash().catch((e) => {
      logger.error("Prullenbak", e);
      return 0;
    });
    if (removed) logger.info(`Prullenbak: ${removed} leads definitief verwijderd`);

    const settings = await loadSettings();
    const day = new Date().getDay();
    if (!settings.enabled) return logger.info("Dagoverzicht staat uit");
    if (!settings.weekend && (day === 0 || day === 6)) return logger.info("Weekend: geen dagoverzicht");
    const data = await loadData();
    const mailer = transport();
    for (const p of PROFILES) {
      if (settings.recipients[p.id]?.enabled === false) continue;
      try {
        logger.info("Dagoverzicht", await sendTo(mailer, p.id, settings, data));
      } catch (e) {
        logger.error("Dagoverzicht versturen mislukt", { profile: p.id, error: e.message });
      }
    }
    return null;
  }
);

/** Knop "Testmail sturen" in Instellingen. */
exports.dagoverzichtTest = onCall({ region: "europe-west1", secrets: [GMAIL_USER, GMAIL_APP_PASSWORD] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Log eerst in.");
  const profileId = String(req.data?.profileId || "");
  if (!PROFILES.some((p) => p.id === profileId)) throw new HttpsError("invalid-argument", "Onbekend profiel.");
  const settings = await loadSettings();
  if (!settings.recipients[profileId]?.email) throw new HttpsError("failed-precondition", "Vul eerst een e-mailadres in en sla op.");
  try {
    return await sendTo(transport(), profileId, settings, await loadData());
  } catch (e) {
    logger.error("Testmail mislukt", e);
    if (/Invalid login|Username and Password not accepted|EAUTH/i.test(e.message)) {
      throw new HttpsError("failed-precondition", "Gmail weigert de login. Controleer GMAIL_USER en het app-wachtwoord (GMAIL_APP_PASSWORD).");
    }
    throw new HttpsError("internal", `Versturen mislukt: ${e.message}`);
  }
});
