// ─── VALIDATIE ───────────────────────────────────────────────────────────────
// errors   = blokkeren opslaan
// warnings = gebruiker moet bevestigen, maar mag doorgaan

import {
  STAGES_REQUIRING_CLOSURE_REASON,
  STAGES_REQUIRING_NEXT_ACTION,
  hasNextAction,
  labelOf,
  PIPELINE_STAGES,
} from "./constants";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {Object} lead  formulierwaarden
 * @param {{partnerCount?: number}} ctx
 * @returns {{errors: Object<string,string>, warnings: string[], valid: boolean}}
 */
export function validateLead(lead, ctx = {}) {
  const errors = {};
  const warnings = [];
  const stage = lead.pipelineStage;
  const stageLabel = labelOf(PIPELINE_STAGES, stage);

  if (!String(lead.name || "").trim()) errors.name = "Vul een naam in.";

  const email = String(lead.email || "").trim();
  const phone = String(lead.phone || "").trim();
  if (!email && !phone) errors.email = "Vul minimaal een e-mailadres of telefoonnummer in.";
  if (email && !EMAIL_RE.test(email)) errors.email = "Dit e-mailadres lijkt niet te kloppen.";
  if (phone && phone.replace(/\D/g, "").length < 6) errors.phone = "Dit telefoonnummer lijkt te kort.";

  if (stage === "appointment_scheduled" && !lead.appointmentDate) {
    errors.appointmentDate = "Bij 'Kennismaking gepland' hoort een afspraakdatum (tabblad Opvolging).";
  }
  if (lead.appointmentStatus && !lead.appointmentDate) {
    errors.appointmentDate = "Vul een afspraakdatum in of maak de afspraakstatus leeg.";
  }

  if (STAGES_REQUIRING_CLOSURE_REASON.includes(stage) && !lead.closureReason) {
    errors.closureReason = `Kies een afsluitreden bij fase '${stageLabel}'.`;
  }
  if (lead.closureReason === "other" && STAGES_REQUIRING_CLOSURE_REASON.includes(stage) && !String(lead.closureNotes || "").trim()) {
    errors.closureNotes = "Licht de afsluitreden 'Anders' kort toe.";
  }

  if (hasNextAction(lead)) {
    if (!lead.nextActionDate) errors.nextActionDate = "Kies een datum voor de volgende actie, of kies 'Geen actie gepland'.";
    if (lead.nextActionType === "other" && !String(lead.nextActionLabel || "").trim()) {
      errors.nextActionLabel = "Omschrijf de volgende actie.";
    }
  }

  const min = lead.budgetMin;
  const max = lead.budgetMax;
  if (min !== null && min !== undefined && max !== null && max !== undefined && Number(min) > Number(max)) {
    errors.budgetMax = "Het maximale budget is lager dan het minimale budget.";
  }

  if (stage === "partner_connected" && !(ctx.partnerCount > 0)) {
    warnings.push("Deze lead staat op 'Gekoppeld aan partner', maar er is nog geen partnerkoppeling vastgelegd.");
  }
  if (STAGES_REQUIRING_NEXT_ACTION.includes(stage) && !hasNextAction(lead) && !lead.archived) {
    warnings.push("Deze actieve lead heeft geen volgende actie. Zo raakt hij makkelijk uit beeld.");
  }

  return { errors, warnings, valid: Object.keys(errors).length === 0 };
}

/** Welke tab hoort bij een foutveld (om de gebruiker er direct heen te sturen). */
export const FIELD_TABS = {
  name: "overview",
  email: "overview",
  phone: "overview",
  closureReason: "overview",
  closureNotes: "overview",
  appointmentDate: "followup",
  nextActionDate: "followup",
  nextActionLabel: "followup",
  budgetMax: "profile",
};
