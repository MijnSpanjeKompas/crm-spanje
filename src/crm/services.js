// ─── FIRESTORE / STORAGE SERVICES ────────────────────────────────────────────
// Alle schrijfacties naar Firebase lopen via dit bestand, zodat:
//  - systeemactiviteiten altijd consequent worden gelogd;
//  - gedenormaliseerde velden (lastActivityAt, partnerSummary, ...) kloppen;
//  - de UI-componenten geen Firestore-details hoeven te kennen.

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, getBlob } from "firebase/storage";
import { db, storage } from "../firebase";
import {
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  PARTNER_LINK_STATUSES,
  PARTNER_WAITING_STATUSES,
  PARTNER_TYPES,
  FILE_CATEGORIES,
  optionOf,
  labelOf,
  isClosedStage,
  isCustomerContactType,
  isSuccessfulContact,
  SCHEMA_VERSION,
} from "./constants";
import { buildLeadPayload, buildMigrationFields } from "./normalize";
import { changedKeys, describeLeadChanges } from "./changes";
import { toDate, toMillis } from "./dates";

const SUBCOLLECTIONS = ["activities", "files", "partnerLinks", "tasks"];
const CONTACT_METHOD_BY_ACTIVITY = { phone_call: "phone", whatsapp: "whatsapp", email: "email", appointment: "appointment" };

// ─── HULPEN ──────────────────────────────────────────────────────────────────
/** Firestore accepteert geen `undefined`; dit haalt die (diep) weg. */
export function clean(value) {
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

function leadRef(leadId) {
  return doc(db, "leads", leadId);
}

function subCol(leadId, name) {
  return collection(db, "leads", leadId, name);
}

function userFields(user) {
  return { id: user?.id || "", name: user?.displayName || user?.email || "Onbekend" };
}

function maxDate(a, b) {
  const ma = toMillis(a);
  const mb = toMillis(b);
  if (ma === null) return mb === null ? null : toDate(b);
  if (mb === null) return toDate(a);
  return ma >= mb ? toDate(a) : toDate(b);
}

/**
 * Berekent de lead-updates die bij een activiteit horen
 * (lastActivityAt, lastContactAt, lastContactAttemptAt). Gaat nooit terug in de tijd.
 * @param {Object} current  huidige (gedeeltelijke) leadwaarden
 */
export function activityLeadPatch(current, { type, outcome, occurredAt }) {
  const when = toDate(occurredAt) || new Date();
  const patch = {
    lastActivityAt: maxDate(current.lastActivityAt, when),
    lastActivityType: type,
  };
  if (isCustomerContactType(type)) {
    patch.lastContactAttemptAt = maxDate(current.lastContactAttemptAt, when);
    if (isSuccessfulContact(type, outcome)) {
      const newest = maxDate(current.lastContactAt, when);
      patch.lastContactAt = newest;
      if (toMillis(newest) === when.getTime()) {
        patch.lastContactMethod = CONTACT_METHOD_BY_ACTIVITY[type] || "";
      }
    }
  }
  return patch;
}

function buildActivityDoc(activity, user) {
  const u = userFields(user);
  return clean({
    type: activity.type || "system",
    title: activity.title || "",
    description: activity.description || "",
    outcome: activity.outcome || "",
    contactMethod: activity.contactMethod || "",
    occurredAt: toDate(activity.occurredAt) || new Date(),
    createdAt: serverTimestamp(),
    createdByUserId: u.id,
    createdByName: u.name,
    performedByUserId: activity.performedByUserId || u.id,
    performedByName: activity.performedByName || u.name,
    metadata: activity.metadata || {},
  });
}

/** Voegt activiteiten + lead-patch toe aan een batch. Geeft de lead-patch terug. */
function queueActivities(batch, leadId, currentLead, activities, user) {
  let running = { ...currentLead };
  let patch = {};
  activities.forEach((a) => {
    const occurredAt = toDate(a.occurredAt) || new Date();
    const aDoc = buildActivityDoc({ ...a, occurredAt }, user);
    batch.set(doc(subCol(leadId, "activities")), aDoc);
    const p = activityLeadPatch(running, { type: aDoc.type, outcome: aDoc.outcome, occurredAt });
    running = { ...running, ...p };
    patch = { ...patch, ...p };
  });
  return patch;
}

// ─── ABONNEMENTEN ────────────────────────────────────────────────────────────
export function subscribeLeads(onData, onError) {
  return onSnapshot(
    collection(db, "leads"),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))),
    onError
  );
}

export function subscribeUsers(onData, onError) {
  return onSnapshot(
    collection(db, "users"),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export function subscribePartners(onData, onError) {
  return onSnapshot(
    collection(db, "partners"),
    (snap) =>
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "nl"))
      ),
    onError
  );
}

/** Live subcollection van één lead (activities/files/partnerLinks/tasks). */
export function subscribeLeadSub(leadId, name, onData, onError) {
  return onSnapshot(
    subCol(leadId, name),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))),
    onError
  );
}

// ─── LEADS ───────────────────────────────────────────────────────────────────
/** Nieuwe lead aanmaken + systeemactiviteit. Geeft het nieuwe id terug. */
export async function createLead(form, user) {
  const u = userFields(user);
  const payload = buildLeadPayload(form);
  const batch = writeBatch(db);
  const newRef = doc(collection(db, "leads"));
  const activities = [
    { type: "system", title: "Lead aangemaakt", metadata: { event: "lead_created", source: payload.leadSource } },
  ];
  if (payload.nextActionType !== "none") {
    activities.push(...describeLeadChanges({}, payload).filter((a) => a.metadata?.field === "nextAction"));
  }
  const actPatch = queueActivities(batch, newRef.id, {}, activities, user);
  batch.set(
    newRef,
    clean({
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
      ...actPatch,
      createdAt: serverTimestamp(),
      createdBy: u.id,
      createdByName: u.name,
      updatedAt: serverTimestamp(),
      updatedBy: u.id,
    })
  );
  await batch.commit();
  return newRef.id;
}

/**
 * Lead opslaan. Schrijft alleen gewijzigde velden (minder kans op overschrijven
 * van wijzigingen van een collega). Oude leads worden bij de eerste opslag
 * volledig naar het nieuwe schema uitgebreid; oude velden blijven staan.
 * @param {Object} before  genormaliseerde lead zoals hij nu in Firestore staat
 * @param {Object} after   formulierwaarden
 * @param {Object} user
 * @param {{extraActivities?: Array}} [opts]
 */
export async function updateLead(before, after, user, opts = {}) {
  const u = userFields(user);
  const beforePayload = buildLeadPayload(before);
  const afterPayload = buildLeadPayload(after);
  const keys = changedKeys(beforePayload, afterPayload);
  const isMigration = Boolean(before._isLegacy);

  if (!keys.length && !isMigration && !opts.extraActivities?.length) return { changed: false };

  const patch = {};
  if (isMigration) Object.assign(patch, afterPayload, buildMigrationFields(before));
  else keys.forEach((k) => (patch[k] = afterPayload[k]));

  const wasClosed = isClosedStage(beforePayload.pipelineStage);
  const nowClosed = isClosedStage(afterPayload.pipelineStage);
  if (!wasClosed && nowClosed) {
    patch.closedAt = serverTimestamp();
    patch.closedBy = u.id;
  }
  if (wasClosed && !nowClosed) patch.reopenedAt = serverTimestamp();

  const activities = [
    ...describeLeadChanges(beforePayload, afterPayload).map((a) => ({ type: "system", ...a })),
    ...(opts.extraActivities || []),
  ];

  const batch = writeBatch(db);
  const actPatch = queueActivities(batch, before.id, before, activities, user);
  batch.update(
    leadRef(before.id),
    clean({ ...patch, ...actPatch, schemaVersion: SCHEMA_VERSION, updatedAt: serverTimestamp(), updatedBy: u.id })
  );
  await batch.commit();
  return { changed: true, activities: activities.length };
}

/** Pinnen is geen inhoudelijke wijziging: geen activiteit, geen validatie. */
export async function setPinned(lead, pinned) {
  await updateDoc(leadRef(lead.id), { pinned: Boolean(pinned) });
}

export async function archiveLead(lead, user) {
  const u = userFields(user);
  const batch = writeBatch(db);
  const actPatch = queueActivities(batch, lead.id, lead, [{ type: "system", title: "Lead gearchiveerd", metadata: { event: "archived" } }], user);
  batch.update(leadRef(lead.id), clean({ archived: true, archivedAt: serverTimestamp(), archivedBy: u.id, archivedByName: u.name, ...actPatch, updatedAt: serverTimestamp(), updatedBy: u.id }));
  await batch.commit();
}

export async function restoreLead(lead, user) {
  const u = userFields(user);
  const batch = writeBatch(db);
  const actPatch = queueActivities(batch, lead.id, lead, [{ type: "system", title: "Lead teruggezet uit archief", metadata: { event: "unarchived" } }], user);
  batch.update(leadRef(lead.id), clean({ archived: false, restoredAt: serverTimestamp(), ...actPatch, updatedAt: serverTimestamp(), updatedBy: u.id }));
  await batch.commit();
}

/** Definitief verwijderen (alleen beheerders). Ruimt subcollections en bestanden op. */
export async function deleteLeadPermanently(lead) {
  for (const name of SUBCOLLECTIONS) {
    const snap = await getDocs(subCol(lead.id, name));
    if (name === "files") {
      for (const d of snap.docs) {
        const path = d.data().storagePath;
        if (path) await deleteObject(ref(storage, path)).catch(() => {});
      }
    }
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await deleteDoc(leadRef(lead.id));
}

// ─── ACTIVITEITEN ────────────────────────────────────────────────────────────
/**
 * Handmatige activiteit toevoegen, optioneel met direct een nieuwe volgende actie
 * en/of fasewijziging.
 * @param {Object} lead
 * @param {Object} activity  {type,title,description,outcome,occurredAt,performedByUserId,performedByName}
 * @param {Object} user
 * @param {{nextAction?: Object, pipelineStage?: string}} [opts]
 */
export async function addActivity(lead, activity, user, opts = {}) {
  const type = activity.type;
  const contactMethod = CONTACT_METHOD_BY_ACTIVITY[type] || "";
  const activities = [{ ...activity, contactMethod, metadata: activity.metadata || {} }];

  const after = { ...lead };
  if (opts.nextAction) Object.assign(after, opts.nextAction);
  if (opts.pipelineStage) after.pipelineStage = opts.pipelineStage;

  if (opts.nextAction || opts.pipelineStage) {
    return updateLead(lead, after, user, { extraActivities: activities });
  }

  const batch = writeBatch(db);
  const actPatch = queueActivities(batch, lead.id, lead, activities, user);
  batch.update(leadRef(lead.id), clean({ ...actPatch, updatedAt: serverTimestamp(), updatedBy: userFields(user).id }));
  await batch.commit();
  return { changed: true };
}

// ─── PARTNERS ────────────────────────────────────────────────────────────────
export async function savePartner(partner, user) {
  const u = userFields(user);
  const data = clean({
    name: String(partner.name || "").trim(),
    type: partner.type || "other",
    contactPerson: String(partner.contactPerson || "").trim(),
    email: String(partner.email || "").trim(),
    phone: String(partner.phone || "").trim(),
    regions: Array.isArray(partner.regions) ? partner.regions : [],
    notes: String(partner.notes || "").trim(),
    active: partner.active !== false,
    updatedAt: serverTimestamp(),
    updatedBy: u.id,
  });
  if (!data.name) throw new Error("Vul een partnernaam in.");
  if (partner.id) {
    await updateDoc(doc(db, "partners", partner.id), data);
    return partner.id;
  }
  const newRef = doc(collection(db, "partners"));
  await setDoc(newRef, { ...data, createdAt: serverTimestamp(), createdBy: u.id });
  return newRef.id;
}

/** Samenvatting van partnerkoppelingen die op de lead wordt opgeslagen. */
export function summarizePartnerLinks(links) {
  const statusOrder = (s) => optionOf(PARTNER_LINK_STATUSES, s)?.order ?? -1;
  const openLinks = links.filter((l) => !["no_match", "completed"].includes(l.status));
  const waiting = links.filter((l) => PARTNER_WAITING_STATUSES.includes(l.status));
  let waitingSince = null;
  waiting.forEach((l) => {
    const d = toDate(l.lastFollowUpAt) || toDate(l.linkedAt);
    if (d && (!waitingSince || d < waitingSince)) waitingSince = d;
  });
  const nextFollowUpAt = openLinks
    .map((l) => l.nextFollowUpAt)
    .filter(Boolean)
    .sort()[0] || "";
  const best = [...links].sort((a, b) => statusOrder(b.status) - statusOrder(a.status))[0];
  return {
    partnerIds: Array.from(new Set(links.map((l) => l.partnerId).filter(Boolean))),
    partnerNames: Array.from(new Set(links.map((l) => l.partnerName).filter(Boolean))),
    partnerStatus: best ? best.status : "none",
    partnerSummary: { count: links.length, waitingCount: waiting.length, waitingSince, nextFollowUpAt },
  };
}

export async function recomputePartnerSummary(leadId) {
  const snap = await getDocs(subCol(leadId, "partnerLinks"));
  const summary = summarizePartnerLinks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  await updateDoc(leadRef(leadId), clean(summary));
  return summary;
}

export async function addPartnerLink(lead, partner, data, user) {
  const u = userFields(user);
  const batch = writeBatch(db);
  const linkRef = doc(subCol(lead.id, "partnerLinks"));
  const status = data.status || "not_sent";
  batch.set(
    linkRef,
    clean({
      partnerId: partner.id,
      partnerName: partner.name,
      partnerType: partner.type || "other",
      contactPerson: data.contactPerson || partner.contactPerson || "",
      linkedAt: serverTimestamp(),
      linkedByUserId: u.id,
      linkedByName: u.name,
      status,
      notes: data.notes || "",
      lastFollowUpAt: null,
      nextFollowUpAt: data.nextFollowUpAt || "",
    })
  );
  const actPatch = queueActivities(
    batch,
    lead.id,
    lead,
    [
      {
        type: "system",
        title: `Gekoppeld aan partner: ${partner.name} (${labelOf(PARTNER_TYPES, partner.type)})`,
        description: `Status: ${labelOf(PARTNER_LINK_STATUSES, status)}${data.notes ? `\n${data.notes}` : ""}`,
        metadata: { event: "partner_linked", partnerId: partner.id, partnerLinkId: linkRef.id },
      },
    ],
    user
  );
  batch.update(leadRef(lead.id), clean({ ...actPatch, updatedAt: serverTimestamp(), updatedBy: u.id }));
  await batch.commit();
  await recomputePartnerSummary(lead.id);
  return linkRef.id;
}

/**
 * Partnerkoppeling bijwerken.
 * @param {{logFollowUp?: boolean, followUpNote?: string}} [opts]  logFollowUp = "opvolging vastleggen"
 */
export async function updatePartnerLink(lead, link, patch, user, opts = {}) {
  const u = userFields(user);
  const batch = writeBatch(db);
  const linkPatch = clean({ ...patch });
  const activities = [];
  if (patch.status && patch.status !== link.status) {
    activities.push({
      type: "system",
      title: `Partnerkoppeling ${link.partnerName}: ${labelOf(PARTNER_LINK_STATUSES, link.status)} → ${labelOf(PARTNER_LINK_STATUSES, patch.status)}`,
      metadata: { event: "partner_status_changed", partnerLinkId: link.id, from: link.status, to: patch.status },
    });
  }
  if (opts.logFollowUp) {
    linkPatch.lastFollowUpAt = new Date();
    activities.push({
      type: "partner_contact",
      title: `Partner opgevolgd: ${link.partnerName}`,
      description: opts.followUpNote || "",
      metadata: { partnerId: link.partnerId, partnerLinkId: link.id },
    });
  }
  batch.update(doc(subCol(lead.id, "partnerLinks"), link.id), linkPatch);
  if (activities.length) {
    const actPatch = queueActivities(batch, lead.id, lead, activities, user);
    batch.update(leadRef(lead.id), clean({ ...actPatch, updatedAt: serverTimestamp(), updatedBy: u.id }));
  }
  await batch.commit();
  await recomputePartnerSummary(lead.id);
}

export async function removePartnerLink(lead, link, user) {
  const batch = writeBatch(db);
  batch.delete(doc(subCol(lead.id, "partnerLinks"), link.id));
  const actPatch = queueActivities(batch, lead.id, lead, [{ type: "system", title: `Partnerkoppeling verwijderd: ${link.partnerName}`, metadata: { event: "partner_unlinked", partnerId: link.partnerId } }], user);
  batch.update(leadRef(lead.id), clean({ ...actPatch, updatedAt: serverTimestamp() }));
  await batch.commit();
  await recomputePartnerSummary(lead.id);
}

// ─── TAKEN ───────────────────────────────────────────────────────────────────
export function summarizeTasks(tasks) {
  const open = tasks
    .filter((t) => t.status === "open")
    .sort((a, b) => String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999")));
  return {
    openTaskCount: open.length,
    nextTaskDueDate: open[0]?.dueDate || "",
    nextTaskTitle: open[0]?.title || "",
  };
}

export async function recomputeTaskSummary(leadId) {
  const snap = await getDocs(subCol(leadId, "tasks"));
  const summary = summarizeTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  await updateDoc(leadRef(leadId), summary);
  return summary;
}

export async function addTask(lead, task, user) {
  const u = userFields(user);
  if (!String(task.title || "").trim()) throw new Error("Geef de taak een titel.");
  const taskRef = doc(subCol(lead.id, "tasks"));
  await setDoc(
    taskRef,
    clean({
      title: String(task.title).trim(),
      description: String(task.description || "").trim(),
      assignedToUserId: task.assignedToUserId || "",
      assignedToName: task.assignedToName || "",
      dueDate: task.dueDate || "",
      status: "open",
      priority: task.priority || "normal",
      createdAt: serverTimestamp(),
      completedAt: null,
      createdBy: u.id,
      createdByName: u.name,
    })
  );
  await recomputeTaskSummary(lead.id);
  return taskRef.id;
}

export async function setTaskStatus(lead, task, status, user) {
  const batch = writeBatch(db);
  batch.update(doc(subCol(lead.id, "tasks"), task.id), {
    status,
    completedAt: status === "completed" ? serverTimestamp() : null,
    completedBy: status === "completed" ? userFields(user).id : "",
  });
  if (status === "completed") {
    const actPatch = queueActivities(batch, lead.id, lead, [{ type: "system", title: `Taak afgerond: ${task.title}`, metadata: { event: "task_completed", taskId: task.id } }], user);
    batch.update(leadRef(lead.id), clean(actPatch));
  }
  await batch.commit();
  await recomputeTaskSummary(lead.id);
}

// ─── BESTANDEN ───────────────────────────────────────────────────────────────
export function getFileExtension(name) {
  const m = /\.([a-z0-9]+)$/i.exec(String(name || ""));
  return m ? m[1].toLowerCase() : "";
}

/** Geeft een Nederlandse foutmelding terug, of null als het bestand OK is. */
export function validateFile(file) {
  if (!file) return "Kies een bestand.";
  const ext = getFileExtension(file.name);
  if (!ALLOWED_FILE_TYPES[ext]) return `Dit bestandstype is niet toegestaan. Toegestaan: ${Object.keys(ALLOWED_FILE_TYPES).map((e) => e.toUpperCase()).join(", ")}.`;
  if (!file.size) return "Dit bestand is leeg.";
  if (file.size > MAX_FILE_SIZE_BYTES) return `Dit bestand is groter dan ${MAX_FILE_SIZE_MB} MB.`;
  return null;
}

export function sanitizeFileName(name) {
  const ext = getFileExtension(name);
  const base = String(name || "bestand")
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "bestand";
  return ext ? `${base}.${ext}` : base;
}

/**
 * Upload naar Firebase Storage + metadata in Firestore.
 * Er wordt bewust GEEN downloadUrl opgeslagen: zo'n URL werkt voor iedereen die
 * hem heeft. We halen hem alleen op als een ingelogde gebruiker het bestand opent.
 */
export async function uploadLeadFile(lead, file, category, user, onProgress) {
  const error = validateFile(file);
  if (error) throw new Error(error);
  const u = userFields(user);
  const ext = getFileExtension(file.name);
  const contentType = ALLOWED_FILE_TYPES[ext];
  const fileDocRef = doc(subCol(lead.id, "files"));
  const storagePath = `leads/${lead.id}/${fileDocRef.id}_${sanitizeFileName(file.name)}`;
  const storageRef = ref(storage, storagePath);

  await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType,
      contentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      customMetadata: { leadId: lead.id, uploadedBy: u.id },
    });
    task.on(
      "state_changed",
      (s) => onProgress && s.totalBytes && onProgress(s.bytesTransferred / s.totalBytes),
      reject,
      resolve
    );
  });

  try {
    const batch = writeBatch(db);
    batch.set(
      fileDocRef,
      clean({
        fileName: file.name,
        originalFileName: file.name,
        storagePath,
        mimeType: contentType,
        size: file.size,
        category: category || "other",
        uploadedAt: serverTimestamp(),
        uploadedByUserId: u.id,
        uploadedByName: u.name,
      })
    );
    const actPatch = queueActivities(
      batch,
      lead.id,
      lead,
      [{ type: "system", title: `Bestand toegevoegd: ${file.name}`, description: `Categorie: ${labelOf(FILE_CATEGORIES, category || "other")}`, metadata: { event: "file_added", fileId: fileDocRef.id } }],
      user
    );
    batch.update(leadRef(lead.id), clean({ ...actPatch, fileCount: increment(1), updatedAt: serverTimestamp() }));
    await batch.commit();
  } catch (e) {
    // Metadata mislukt → geen wees-bestand in Storage achterlaten.
    await deleteObject(storageRef).catch(() => {});
    throw e;
  }
  return fileDocRef.id;
}

export async function updateLeadFile(lead, file, patch) {
  const data = {};
  if (patch.fileName !== undefined) {
    const name = String(patch.fileName).trim();
    if (!name) throw new Error("Bestandsnaam mag niet leeg zijn.");
    data.fileName = name;
  }
  if (patch.category !== undefined) data.category = patch.category;
  await updateDoc(doc(subCol(lead.id, "files"), file.id), data);
}

export async function deleteLeadFile(lead, file, user) {
  await deleteObject(ref(storage, file.storagePath)).catch((e) => {
    // Bestaat het bestand al niet meer in Storage? Dan alleen metadata opruimen.
    if (e?.code !== "storage/object-not-found") throw e;
  });
  const batch = writeBatch(db);
  batch.delete(doc(subCol(lead.id, "files"), file.id));
  const actPatch = queueActivities(batch, lead.id, lead, [{ type: "system", title: `Bestand verwijderd: ${file.fileName}`, metadata: { event: "file_deleted" } }], user);
  batch.update(leadRef(lead.id), clean({ ...actPatch, fileCount: increment(-1) }));
  await batch.commit();
}

export function getFileUrl(file) {
  return getDownloadURL(ref(storage, file.storagePath));
}

/** Bekijken in een nieuw tabblad (PDF's en afbeeldingen openen direct in de browser). */
export async function openLeadFile(file) {
  // Venster direct (synchroon) openen, anders blokkeert de browser de pop-up.
  const win = window.open("", "_blank");
  if (!win) throw new Error("Je browser blokkeert pop-ups. Sta pop-ups toe voor deze site.");
  try {
    win.location.href = await getFileUrl(file);
  } catch (e) {
    win.close();
    throw e;
  }
}

/** Downloaden met de juiste bestandsnaam; valt terug op openen in nieuw tabblad. */
export async function downloadLeadFile(file) {
  try {
    // getBlob werkt alleen als CORS op de bucket is ingesteld (zie README).
    const blob = await getBlob(ref(storage, file.storagePath));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.fileName || file.originalFileName || "bestand";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return "downloaded";
  } catch (e) {
    const url = await getFileUrl(file);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return "opened";
  }
}
