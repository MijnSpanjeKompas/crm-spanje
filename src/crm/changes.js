// ─── BETEKENISVOLLE WIJZIGINGEN → SYSTEEMACTIVITEITEN ───────────────────────
// Wordt alleen bij opslaan aangeroepen (nooit per toetsaanslag).

import {
  PIPELINE_STAGES,
  PURCHASE_INTENTS,
  PRIORITIES,
  REGIONS,
  PROPERTY_TYPES,
  PURCHASE_GOALS,
  PURCHASE_TIMELINES,
  FINANCING_TYPES,
  BUILD_PREFERENCES,
  HOUSING_SITUATIONS,
  CLOSURE_REASONS,
  APPOINTMENT_STATUSES,
  labelOf,
  isClosedStage,
  nextActionText,
  hasNextAction,
} from "./constants";
import { formatDate } from "./dates";

function same(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const x = [...(a || [])].sort();
    const y = [...(b || [])].sort();
    return x.length === y.length && x.every((v, i) => v === y[i]);
  }
  const na = a === undefined || a === "" ? null : a;
  const nb = b === undefined || b === "" ? null : b;
  return na === nb;
}

/** Welke payloadvelden zijn gewijzigd (voor een minimale Firestore-update). */
export function changedKeys(before, after) {
  return Object.keys(after).filter((k) => !same(before[k], after[k]));
}

const euro = (n) => (n === null || n === undefined || n === "" ? "–" : `€ ${Number(n).toLocaleString("nl-NL")}`);

const PROFILE_FIELDS = [
  { key: "budgetMin", label: "Budget min.", fmt: euro },
  { key: "budgetMax", label: "Budget max.", fmt: euro },
  { key: "regions", label: "Regio's", fmt: (v) => (v || []).map((x) => labelOf(REGIONS, x)).join(", ") || "–" },
  { key: "places", label: "Plaatsen", fmt: (v) => (v || []).join(", ") || "–" },
  { key: "propertyTypes", label: "Woningtype", fmt: (v) => (v || []).map((x) => labelOf(PROPERTY_TYPES, x)).join(", ") || "–" },
  { key: "buildPreference", label: "Bouw", fmt: (v) => labelOf(BUILD_PREFERENCES, v) },
  { key: "purchaseGoal", label: "Aankoopdoel", fmt: (v) => labelOf(PURCHASE_GOALS, v) },
  { key: "purchaseTimeline", label: "Aankooptermijn", fmt: (v) => labelOf(PURCHASE_TIMELINES, v) },
  { key: "financingType", label: "Financiering", fmt: (v) => labelOf(FINANCING_TYPES, v) },
  { key: "currentHousingSituation", label: "Woonsituatie", fmt: (v) => labelOf(HOUSING_SITUATIONS, v) },
];

/**
 * Vergelijkt oude en nieuwe leadwaarden en geeft systeemactiviteiten terug.
 * @returns {{title:string, description?:string, type?:string, metadata:Object}[]}
 */
export function describeLeadChanges(before, after) {
  const out = [];
  const field = (key) => !same(before[key], after[key]);

  if (field("pipelineStage")) {
    const wasClosed = isClosedStage(before.pipelineStage);
    const isClosed = isClosedStage(after.pipelineStage);
    out.push({
      title: `Pipelinefase gewijzigd van ${labelOf(PIPELINE_STAGES, before.pipelineStage)} naar ${labelOf(PIPELINE_STAGES, after.pipelineStage)}`,
      metadata: { field: "pipelineStage", from: before.pipelineStage || null, to: after.pipelineStage },
    });
    if (!wasClosed && isClosed) {
      out.push({
        title: "Lead gesloten",
        description: after.closureReason
          ? `Reden: ${labelOf(CLOSURE_REASONS, after.closureReason)}${after.closureNotes ? ` – ${after.closureNotes}` : ""}`
          : "",
        metadata: { event: "lead_closed", closureReason: after.closureReason || null },
      });
    }
    if (wasClosed && !isClosed) {
      out.push({ title: "Lead heropend", metadata: { event: "lead_reopened" } });
    }
  } else if (field("closureReason") && after.closureReason) {
    out.push({
      title: `Afsluitreden vastgelegd: ${labelOf(CLOSURE_REASONS, after.closureReason)}`,
      metadata: { field: "closureReason", to: after.closureReason },
    });
  }

  if (field("priority")) {
    out.push({
      title: `Prioriteit gewijzigd van ${labelOf(PRIORITIES, before.priority)} naar ${labelOf(PRIORITIES, after.priority)}`,
      metadata: { field: "priority", from: before.priority || null, to: after.priority },
    });
  }
  if (field("purchaseIntent")) {
    out.push({
      title: `Koopintentie gewijzigd van ${labelOf(PURCHASE_INTENTS, before.purchaseIntent)} naar ${labelOf(PURCHASE_INTENTS, after.purchaseIntent)}`,
      metadata: { field: "purchaseIntent", from: before.purchaseIntent || null, to: after.purchaseIntent },
    });
  }
  if (field("ownerId")) {
    out.push({
      title: `Verantwoordelijke gewijzigd van ${before.ownerName || "niemand"} naar ${after.ownerName || "niemand"}`,
      metadata: { field: "ownerId", from: before.ownerId || null, to: after.ownerId || null },
    });
  }
  if (field("nextActionType") || field("nextActionDate") || field("nextActionAssignedTo")) {
    out.push({
      title: hasNextAction(after)
        ? `Volgende actie gepland: ${nextActionText(after)}${after.nextActionDate ? ` op ${formatDate(after.nextActionDate)}` : ""}${after.nextActionAssignedToName ? ` (${after.nextActionAssignedToName})` : ""}`
        : "Volgende actie verwijderd",
      metadata: { field: "nextAction", to: after.nextActionType, date: after.nextActionDate || null },
    });
  }
  if (field("appointmentDate") || field("appointmentTime") || field("appointmentStatus")) {
    if (after.appointmentStatus === "completed" && before.appointmentStatus !== "completed") {
      // Echte kennismaking = klantcontact → telt mee voor lastContactAt
      out.push({
        type: "appointment",
        title: "Kennismaking gehad",
        description: after.appointmentDate ? `Datum: ${formatDate(after.appointmentDate)}${after.appointmentTime ? ` ${after.appointmentTime}` : ""}` : "",
        metadata: { event: "appointment_completed", appointmentType: after.appointmentType || null },
      });
    } else if (after.appointmentDate) {
      out.push({
        title: `Kennismaking ${labelOf(APPOINTMENT_STATUSES, after.appointmentStatus || "scheduled").toLowerCase()}: ${formatDate(after.appointmentDate)}${after.appointmentTime ? ` ${after.appointmentTime}` : ""}`,
        metadata: { field: "appointment", status: after.appointmentStatus || null, date: after.appointmentDate },
      });
    }
  }

  const profileChanges = PROFILE_FIELDS.filter((f) => field(f.key));
  if (profileChanges.length) {
    out.push({
      title: "Zoekprofiel aangepast",
      description: profileChanges.map((f) => `${f.label}: ${f.fmt(before[f.key])} → ${f.fmt(after[f.key])}`).join("\n"),
      metadata: { event: "search_profile_updated", fields: profileChanges.map((f) => f.key) },
    });
  }

  return out;
}
