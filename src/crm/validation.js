// ─── VALIDATIE ───────────────────────────────────────────────────────────────
// errors   = blokkeren opslaan
// warnings = gebruiker moet bevestigen, maar mag doorgaan

import {
  STAGES_REQUIRING_CLOSURE_REASON,
  STAGES_REQUIRING_NEXT_ACTION,
  hasNextAction,
  labelOf,
  PIPELINE_STAGES,
  FORWARDED_OR_LATER,
} from "./constants";

/**
 * Wat moet er minimaal bekend zijn voordat een lead naar een partner mag?
 * Geeft de ontbrekende onderdelen terug (leeg = klaar om door te sturen).
 */
export function forwardingGaps(lead, partnerCount = 0) {
  const gaps = [];
  if (!lead.purchaseGoal) gaps.push("aankoopdoel");
  if (!lead.purchaseTimeline) gaps.push("aankooptermijn");
  if (lead.budgetMax === null || lead.budgetMax === undefined || lead.budgetMax === "") gaps.push("budget maximaal");
  const realRegions = (lead.regions || []).filter((r) => r !== "unknown");
  if (!realRegions.length && !(lead.places || []).length) gaps.push("regio");
  if (!(lead.propertyTypes || []).length) gaps.push("woningtype (of 'Geen voorkeur')");
  if (!lead.buildPreference) gaps.push("nieuwbouw/bestaande bouw (of 'Geen voorkeur')");
  if (!lead.financingType) gaps.push("financiering");
  if (!String(lead.leadSummary || "").trim()) gaps.push("interne samenvatting");
  if (!(partnerCount > 0)) gaps.push("gekoppelde partner");
  if (lead.consentStatus !== "yes") gaps.push("toestemming voor contact = Ja");
  return gaps;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {Object} lead  formulierwaarden
 * Progressieve validatie: bij aanmaken weinig verplicht; extra eisen pas bij
 * de OVERGANG naar een fase die ze nodig heeft (bestaande leads in die fase
 * worden niet ineens geblokkeerd).
 * @param {{partnerCount?: number, previousStage?: string, isCreate?: boolean}} ctx
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
    errors.appointmentDate = "Bij 'Gesprek gepland' hoort een afspraakdatum (tabblad Opvolging).";
  }
  if (lead.appointmentStatus && !lead.appointmentDate) {
    errors.appointmentDate = "Vul een afspraakdatum in of maak de afspraakstatus leeg.";
  }

  // Fase A — aanmaken
  if (ctx.isCreate) {
    if (!lead.leadSource) errors.leadSource = "Kies via welke weg de lead binnenkwam.";
    if (!lead.consentStatus) errors.consentStatus = "Kies of er toestemming is voor contact (Ja, Nee of Onbekend).";
  }

  const entering = (stages) => stages.includes(stage) && (ctx.isCreate || !stages.includes(ctx.previousStage));
  // Fase B — doorsturen (ook bij overslaan naar Gereserveerd)
  if (entering(FORWARDED_OR_LATER) && stage !== "completed") {
    const gaps = forwardingGaps(lead, ctx.partnerCount || 0);
    if (gaps.length) errors.forwarding = `Vul eerst deze gegevens aan voordat de lead kan worden doorgestuurd: ${gaps.join(", ")}.`;
  }
  // Fase E — gereserveerd: partner verplicht
  if (stage === "purchase_process" && ctx.previousStage !== "purchase_process" && !(ctx.partnerCount > 0) && !errors.forwarding) {
    errors.forwarding = "Koppel eerst een partner voordat de lead op 'Gereserveerd' kan.";
  }
  // Fase C — later opvolgen: opvolgdatum verplicht
  if (stage === "follow_up_later" && ctx.previousStage !== "follow_up_later" && (!hasNextAction(lead) || !lead.nextActionDate)) {
    errors.nextActionDate = "Bij 'Later opvolgen' hoort een volgende actie met opvolgdatum (tabblad Opvolging).";
  }

  // Fase D — gestopt: gestructureerde reden
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
  forwarding: "profile",
  leadSource: "overview",
  consentStatus: "overview",
};
