// ─── AUTOMATISCHE LEAD-IMPORT (Google Sheets → CRM) ─────────────────────────
// HTTPS-endpoint: POST https://<regio>-<project>.cloudfunctions.net/importLeads
// Header:  x-import-secret: <LEAD_IMPORT_SECRET>
// Body:    { "rows": [ { "Submission ID": "...", "name": "...", ... } ] }
//
// - Het secret staat in Google Secret Manager (nooit in de client of de Sheet-code
//   zichtbaar voor bezoekers).
// - De mapping komt uit src/crm/sheetImport.js (zelfde code als de import in de app);
//   esbuild bundelt die mee bij `npm run build`.
// - Idempotent: document-id = "sheet-<Submission ID>", aangemaakt met create().
//   Bestaat die al → "already_exists" met de bestaande lead-id.

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { mapSheetRow, importActivity, sheetLeadId } = require("../../src/crm/sheetImport");
const { buildLeadPayload, normalizeEmail, normalizePhone } = require("../../src/crm/normalize");

admin.initializeApp();
const db = admin.firestore();
const LEAD_IMPORT_SECRET = defineSecret("LEAD_IMPORT_SECRET");

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

/** Firestore accepteert geen undefined; Dates blijven Dates. */
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object" && value.constructor === Object) {
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      if (v !== undefined) out[k] = clean(v);
    });
    return out;
  }
  return value;
}

async function findPossibleDuplicates(form) {
  const ids = new Set();
  const email = normalizeEmail(form.email);
  const phone = normalizePhone(form.phone);
  if (email) (await db.collection("leads").where("emailNormalized", "==", email).limit(5).get()).forEach((d) => ids.add(d.id));
  if (phone) (await db.collection("leads").where("phoneNormalized", "==", phone).limit(5).get()).forEach((d) => ids.add(d.id));
  return [...ids];
}

async function importRow(row) {
  const mapped = mapSheetRow(row);
  if (!mapped.valid) return { submissionId: mapped.submissionId || null, status: "invalid", problems: mapped.problems };

  // Ook leads die eerder via de app (of met een andere id) zijn geïmporteerd.
  const existing = await db.collection("leads").where("sourceSubmissionId", "==", mapped.submissionId).limit(1).get();
  if (!existing.empty) return { submissionId: mapped.submissionId, status: "already_exists", leadId: existing.docs[0].id };

  const duplicates = await findPossibleDuplicates(mapped.form);
  const status = duplicates.length ? "possible_duplicate" : "new";
  const ref = db.collection("leads").doc(sheetLeadId(mapped.submissionId));
  const now = admin.firestore.FieldValue.serverTimestamp();
  const activity = importActivity(mapped, status);

  const payload = buildLeadPayload(mapped.form);
  const leadDoc = clean({
    ...payload,
    archived: false,
    partnerIds: [],
    partnerNames: [],
    partnerStatus: "none",
    partnerSummary: { count: 0, waitingCount: 0, waitingSince: null, nextFollowUpAt: "" },
    openTaskCount: 0,
    nextTaskDueDate: "",
    nextTaskTitle: "",
    fileCount: 0,
    lastContactAt: null,
    lastContactAttemptAt: null,
    ...mapped.extra,
    possibleDuplicateOf: duplicates,
    lastActivityAt: activity.occurredAt,
    importedAt: now,
    importedBy: "sheets_import",
    createdAt: now,
    createdBy: "sheets_import",
    createdByName: "Google Sheets-import",
    updatedAt: now,
    updatedBy: "sheets_import",
  });
  const activityDoc = clean({
    type: activity.type,
    actorType: "system",
    actorId: "sheets_import",
    actionType: activity.actionType,
    title: activity.title,
    description: activity.description,
    outcome: "",
    contactMethod: "",
    occurredAt: activity.occurredAt,
    createdAt: now,
    createdByUserId: "sheets_import",
    createdByName: "Google Sheets-import",
    performedByUserId: "sheets_import",
    performedByName: "Google Sheets-import",
    metadata: activity.metadata,
  });

  const batch = db.batch();
  batch.create(ref, leadDoc); // faalt als de lead al bestaat → idempotent
  batch.create(ref.collection("activities").doc(), activityDoc);
  try {
    await batch.commit();
  } catch (e) {
    if (e.code === 6 || /already exists/i.test(e.message)) return { submissionId: mapped.submissionId, status: "already_exists", leadId: ref.id };
    throw e;
  }
  return { submissionId: mapped.submissionId, status, leadId: ref.id, possibleDuplicateOf: duplicates };
}

exports.importLeads = onRequest({ region: "europe-west1", secrets: [LEAD_IMPORT_SECRET], cors: false, maxInstances: 3 }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Alleen POST" });
  if (!safeEqual(req.get("x-import-secret"), LEAD_IMPORT_SECRET.value())) {
    logger.warn("Import geweigerd: ongeldig secret");
    return res.status(401).json({ error: "Niet geautoriseerd" });
  }
  const body = req.body || {};
  const rows = Array.isArray(body.rows) ? body.rows : body.row ? [body.row] : [];
  if (!rows.length || rows.length > 200) return res.status(400).json({ error: "Stuur 1 tot 200 rijen in 'rows'." });

  const results = [];
  for (const row of rows) {
    try {
      results.push(await importRow(row));
    } catch (e) {
      logger.error("Import van rij mislukt", e);
      results.push({ submissionId: row?.["Submission ID"] || null, status: "error", error: "Import mislukt" });
    }
  }
  const failed = results.some((r) => r.status === "error");
  return res.status(failed ? 207 : 200).json({ results });
});
