// ─── MIJLPALEN ───────────────────────────────────────────────────────────────
// De huidige fase zegt niet waar een lead allemaal geweest is. Daarom leggen we
// per lead de EERSTE keer vast dat een stap bereikt werd. Regels:
// - een mijlpaal wordt alleen gezet als hij nog leeg is (nooit overschreven);
// - nooit een datum verzinnen: onbekend = null;
// - de tijdlijn (activities) blijft de volledige audittrail.

import { MILESTONES, FORWARDED_OR_LATER } from "./constants";
import { toDate } from "./dates";

export const MILESTONE_KEYS = MILESTONES.map((m) => m.key);

function isEmpty(v) {
  return v === null || v === undefined || v === "";
}

/** "2026-10-02" → Date om 12:00 lokale tijd (geen tijdzoneverschuiving). */
function dateFromISO(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Mijlpalen die een wijziging (before → after) oplevert.
 * @param {Object} before lead vóór de wijziging (genormaliseerd)
 * @param {Object} after  lead na de wijziging
 * @param {Date} now
 * @returns {Object} alleen nieuwe mijlpaalvelden
 */
export function milestonePatch(before, after, now = new Date()) {
  const patch = {};
  const set = (key, value) => {
    if (isEmpty(before?.[key]) && isEmpty(after?.[key]) && value) patch[key] = value;
  };
  const stageChanged = (before?.pipelineStage || "") !== after.pipelineStage;

  // Gesprek gepland / gevoerd (één afspraak per lead in het datamodel).
  if (after.appointmentStatus === "scheduled" && before?.appointmentStatus !== "scheduled") set("firstMeetingScheduledAt", now);
  if (after.appointmentStatus === "completed" && before?.appointmentStatus !== "completed") {
    set("firstMeetingScheduledAt", dateFromISO(after.appointmentDate) || now);
    set("firstMeetingCompletedAt", dateFromISO(after.appointmentDate) || now);
  }

  if (stageChanged) {
    if (FORWARDED_OR_LATER.includes(after.pipelineStage)) set("firstForwardedAt", now);
    if (after.pipelineStage === "purchase_process" || after.pipelineStage === "completed") {
      // Reserveringsdatum mag door de gebruiker gecorrigeerd zijn (reservedAt).
      set("firstReservedAt", dateFromISO(after.reservedAt) || now);
    }
    if (after.pipelineStage === "completed") set("purchaseCompletedAt", dateFromISO(after.saleDate) || now);
    if (after.pipelineStage === "stopped") set("stoppedAt", now);
  }
  // Aankoopdatum gecorrigeerd na afronden → mijlpaal volgt de opgegeven datum.
  if (!stageChanged && after.pipelineStage === "completed" && after.saleDate && before?.saleDate !== after.saleDate && before?.purchaseCompletedAt) {
    patch.purchaseCompletedAt = dateFromISO(after.saleDate);
  }
  if (!stageChanged && after.pipelineStage === "purchase_process" && after.reservedAt && before?.reservedAt !== after.reservedAt) {
    patch.firstReservedAt = dateFromISO(after.reservedAt);
  }
  return patch;
}

/** Eerste geslaagde contact (vanuit activiteiten). */
export function contactMilestonePatch(current, when) {
  const existing = toDate(current?.firstContactAt);
  // Een later vastgelegd, maar eerder plaatsgevonden contact maakt de mijlpaal vroeger.
  if (existing && existing <= when) return {};
  return { firstContactAt: when };
}

/**
 * Mijlpalen afleiden uit bestaande activiteiten van één lead (voor oude leads).
 * Gebruikt alleen betrouwbare bronnen:
 * - statuswijzigingen met metadata { field: "pipelineStage", to } en een tijdstip;
 * - geslaagde klantcontacten (outcome = spoken/reached of type zonder uitkomst);
 * - "Lead aangemaakt"/import met fase.
 * Wat niet zeker is, blijft null.
 */
export function deriveMilestones(lead, activities, isSuccessfulContact) {
  const sorted = [...(activities || [])]
    .map((a) => ({ ...a, at: toDate(a.occurredAt) || toDate(a.createdAt) }))
    .filter((a) => a.at)
    .sort((a, b) => a.at - b.at);
  const found = {};
  const first = (key, at) => {
    if (!found[key]) found[key] = at;
  };
  sorted.forEach((a) => {
    if (isSuccessfulContact && isSuccessfulContact(a.type, a.outcome)) first("firstContactAt", a.at);
    const to = a.metadata?.field === "pipelineStage" ? a.metadata.to : null;
    if (to) {
      if (FORWARDED_OR_LATER.includes(to)) first("firstForwardedAt", a.at);
      if (to === "purchase_process" || to === "completed") first("firstReservedAt", a.at);
      if (to === "completed") first("purchaseCompletedAt", a.at);
      if (to === "stopped") first("stoppedAt", a.at);
      if (to === "appointment_scheduled") first("firstMeetingScheduledAt", a.at);
    }
    if (a.metadata?.event === "partner_linked") first("firstForwardedAt", a.at);
    if (a.metadata?.event === "sold") first("purchaseCompletedAt", a.at);
    if (a.metadata?.event === "appointment_completed") first("firstMeetingCompletedAt", a.at);
    if (a.metadata?.field === "appointment" && a.metadata?.status === "scheduled") first("firstMeetingScheduledAt", a.at);
  });
  // Aankoopdatum is door een mens ingevuld → betrouwbaarder dan het logmoment.
  if (lead.pipelineStage === "completed" && dateFromISO(lead.saleDate)) found.purchaseCompletedAt = dateFromISO(lead.saleDate);

  const patch = {};
  MILESTONE_KEYS.forEach((k) => {
    if (isEmpty(lead[k]) && found[k]) patch[k] = found[k];
  });
  return patch;
}

/**
 * Heeft de lead een stap bereikt? Voor KPI's. Mijlpaal eerst; anders alleen
 * zekere afleidingen uit de huidige staat (geen datum, alleen ja/nee).
 */
export function reached(lead, step) {
  switch (step) {
    case "contact":
      return Boolean(lead.firstContactAt || lead.lastContactAt);
    case "meeting":
      return Boolean(lead.firstMeetingCompletedAt || lead.appointmentStatus === "completed");
    case "forwarded":
      return Boolean(lead.firstForwardedAt || FORWARDED_OR_LATER.includes(lead.pipelineStage) || (lead.partnerSummary?.count || 0) > 0);
    case "reserved":
      return Boolean(lead.firstReservedAt || lead.pipelineStage === "purchase_process" || lead.pipelineStage === "completed");
    case "purchased":
      return Boolean(lead.purchaseCompletedAt || lead.pipelineStage === "completed");
    default:
      return false;
  }
}

/** Datum waarop een stap bereikt werd, of null als dat niet bekend is. */
export function reachedAt(lead, step) {
  switch (step) {
    case "contact":
      return toDate(lead.firstContactAt);
    case "meeting":
      return toDate(lead.firstMeetingCompletedAt) || (lead.appointmentStatus === "completed" ? dateFromISO(lead.appointmentDate) : null);
    case "forwarded":
      return toDate(lead.firstForwardedAt);
    case "reserved":
      return toDate(lead.firstReservedAt) || dateFromISO(lead.reservedAt);
    case "purchased":
      return toDate(lead.purchaseCompletedAt) || (lead.pipelineStage === "completed" ? dateFromISO(lead.saleDate) : null);
    default:
      return null;
  }
}
