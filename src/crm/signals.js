// ─── SIGNALEN & DASHBOARDLOGICA ──────────────────────────────────────────────
// Alles werkt op de (gedenormaliseerde) velden van het leaddocument, zodat het
// dashboard nooit per lead subcollections hoeft op te halen.

import {
  THRESHOLDS,
  STAGES_REQUIRING_NEXT_ACTION,
  STAGES_REQUIRING_SEARCH_PROFILE,
  STAGES_REQUIRING_CLOSURE_REASON,
  isClosedStage,
  hasNextAction,
  nextActionText,
} from "./constants";
import { diffInDays, daysSince, hoursSince, todayISO, toDate, formatDate } from "./dates";
import { getCreatedDate } from "./normalize";

export function isOpenLead(lead) {
  return !lead.archived && !isClosedStage(lead.pipelineStage);
}

/** Status van de volgende actie, voor kleuren en sortering. */
export function getNextActionInfo(lead, now = new Date()) {
  if (!hasNextAction(lead)) {
    return { state: "none", label: "Geen actie gepland", color: "#636d78", bg: "#f3f2ef", sort: 99999 };
  }
  if (!lead.nextActionDate) {
    return { state: "nodate", label: "Datum ontbreekt", color: "#97581a", bg: "#fbefe3", sort: -99999 };
  }
  const diff = diffInDays(lead.nextActionDate, now);
  if (diff < 0) {
    const d = Math.abs(diff);
    return { state: "overdue", label: `${d} ${d === 1 ? "dag" : "dagen"} te laat`, color: "#b3453a", bg: "#fbedeb", sort: diff };
  }
  if (diff === 0) return { state: "today", label: "Vandaag", color: "#8c6010", bg: "#fbefd2", sort: 0 };
  if (diff === 1) return { state: "soon", label: "Morgen", color: "#3a6788", bg: "#eaf1f6", sort: 1 };
  if (diff <= THRESHOLDS.UPCOMING_DAYS) return { state: "soon", label: `Over ${diff} dagen`, color: "#3a6788", bg: "#eaf1f6", sort: diff };
  return { state: "later", label: formatDate(lead.nextActionDate), color: "#5f6e80", bg: "#f3f2ef", sort: diff };
}

/** Welke kernvelden van het zoekprofiel ontbreken. */
export function getMissingProfileFields(lead) {
  const missing = [];
  if (lead.budgetMin === null && lead.budgetMax === null) missing.push("budget");
  if (!lead.regions?.length && !lead.places?.length) missing.push("regio/plaats");
  if (!lead.purchaseGoal) missing.push("aankoopdoel");
  if (!lead.purchaseTimeline || lead.purchaseTimeline === "unknown") missing.push("aankooptermijn");
  if (!lead.financingType || lead.financingType === "unknown") missing.push("financiering");
  return missing;
}

function lastActivityDate(lead) {
  return toDate(lead.lastActivityAt) || toDate(lead.lastContactAt) || toDate(lead.updatedAt) || getCreatedDate(lead);
}

/**
 * Automatische aandachtssignalen voor één lead.
 * @returns {{key:string,label:string,severity:"high"|"medium"|"low"}[]}
 */
export function getLeadSignals(lead, now = new Date()) {
  const signals = [];
  if (lead.archived) return signals;

  // Afsluitreden ontbreekt (vaak oude "Niet doorgegaan"-leads)
  if (STAGES_REQUIRING_CLOSURE_REASON.includes(lead.pipelineStage) && !lead.closureReason) {
    signals.push({ key: "missing_closure_reason", label: "Afsluitreden ontbreekt", severity: "low" });
  }
  if (!isOpenLead(lead)) return signals;

  // Nieuwe lead zonder klantcontact
  const created = getCreatedDate(lead);
  if (!lead.lastContactAt && created && hoursSince(created, now) > THRESHOLDS.NEW_LEAD_NO_CONTACT_HOURS) {
    signals.push({
      key: "no_contact",
      label: lead.lastContactAttemptAt
        ? `Nog geen klantcontact (alleen pogingen)`
        : `Nog geen klantcontact na ${THRESHOLDS.NEW_LEAD_NO_CONTACT_HOURS} uur`,
      severity: "high",
    });
  }

  // Volgende actie
  const na = getNextActionInfo(lead, now);
  if (na.state === "overdue") signals.push({ key: "overdue_action", label: `Actie verlopen: ${nextActionText(lead)} (${na.label})`, severity: "high" });
  if (na.state === "nodate") signals.push({ key: "action_no_date", label: `Actie zonder datum: ${nextActionText(lead)}`, severity: "medium" });
  if (na.state === "none" && STAGES_REQUIRING_NEXT_ACTION.includes(lead.pipelineStage)) {
    signals.push({ key: "no_next_action", label: "Actieve lead zonder volgende actie", severity: "high" });
  }

  // Taken
  if (lead.openTaskCount > 0 && lead.nextTaskDueDate && diffInDays(lead.nextTaskDueDate, now) < 0) {
    signals.push({ key: "overdue_task", label: `Taak verlopen: ${lead.nextTaskTitle || "open taak"}`, severity: "high" });
  }

  // Kennismaking in het verleden maar nog "gepland"
  if (lead.appointmentStatus === "scheduled" && lead.appointmentDate && diffInDays(lead.appointmentDate, now) < 0) {
    signals.push({ key: "appointment_unresolved", label: "Kennismaking geweest? Status nog niet bijgewerkt", severity: "medium" });
  }

  // Partnerkoppelingen
  const ps = lead.partnerSummary || {};
  if (ps.waitingCount > 0) {
    const waitingDays = daysSince(ps.waitingSince, now);
    const followUpOverdue = ps.nextFollowUpAt && diffInDays(ps.nextFollowUpAt, now) < 0;
    if (followUpOverdue) {
      signals.push({ key: "partner_follow_up_overdue", label: "Partneropvolging verlopen", severity: "high" });
    } else if (waitingDays !== null && waitingDays >= THRESHOLDS.PARTNER_FOLLOW_UP_DAYS) {
      signals.push({ key: "partner_waiting", label: `Partner al ${waitingDays} dagen zonder terugkoppeling`, severity: "medium" });
    }
  }

  // Lang geen activiteit
  const last = lastActivityDate(lead);
  const idle = daysSince(last, now);
  if (idle !== null && idle >= THRESHOLDS.INACTIVITY_DAYS) {
    signals.push({ key: "inactive", label: `${idle} dagen geen activiteit`, severity: "medium" });
  }

  // Incompleet zoekprofiel
  if (STAGES_REQUIRING_SEARCH_PROFILE.includes(lead.pipelineStage)) {
    const missing = getMissingProfileFields(lead);
    if (missing.length) signals.push({ key: "incomplete_profile", label: `Zoekprofiel mist: ${missing.join(", ")}`, severity: "low" });
  }

  return signals;
}

export const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };
export const SEVERITY_STYLE = {
  high: { color: "#b3453a", bg: "#fbedeb" },
  medium: { color: "#8c6010", bg: "#fbefd2" },
  low: { color: "#5f6e80", bg: "#f3f2ef" },
};

/** Items voor de sectie "Vandaag": acties, taken en kennismakingen van vandaag. */
export function getTodayItems(leads, now = new Date()) {
  const today = todayISO(now);
  const items = [];
  leads.filter(isOpenLead).forEach((lead) => {
    if (hasNextAction(lead) && lead.nextActionDate === today) {
      items.push({ lead, kind: "action", label: nextActionText(lead), who: lead.nextActionAssignedToName, sort: 1 });
    }
    if (lead.appointmentStatus === "scheduled" && lead.appointmentDate === today) {
      items.push({ lead, kind: "appointment", label: `Kennismaking${lead.appointmentTime ? ` om ${lead.appointmentTime}` : ""}`, who: lead.appointmentAssignedToName, sort: 0, time: lead.appointmentTime });
    }
    if (lead.openTaskCount > 0 && lead.nextTaskDueDate === today) {
      items.push({ lead, kind: "task", label: `Taak: ${lead.nextTaskTitle || "open taak"}`, who: "", sort: 2 });
    }
    const ps = lead.partnerSummary || {};
    if (ps.waitingCount > 0 && ps.nextFollowUpAt === today) {
      items.push({ lead, kind: "partner", label: "Partner opvolgen", who: "", sort: 3 });
    }
  });
  return items.sort((a, b) => a.sort - b.sort || String(a.time || "").localeCompare(String(b.time || "")));
}

/** Leads met minimaal één signaal, gesorteerd op ernst. */
export function getAttentionList(leads, now = new Date()) {
  return leads
    .map((lead) => ({ lead, signals: getLeadSignals(lead, now) }))
    .filter((x) => x.signals.length)
    .sort((a, b) => {
      const sa = Math.min(...a.signals.map((s) => SEVERITY_RANK[s.severity]));
      const sb = Math.min(...b.signals.map((s) => SEVERITY_RANK[s.severity]));
      return sa - sb || b.signals.length - a.signals.length;
    });
}

/** Snelle KPI-filters. Worden ook gebruikt door de lijst (klik op KPI). */
export const QUICK_FILTERS = {
  new: {
    label: "Nieuwe leads",
    test: (l) => isOpenLead(l) && l.pipelineStage === "new_lead",
  },
  today: {
    label: "Vandaag opvolgen",
    test: (l, now) => {
      const t = todayISO(now);
      return (
        isOpenLead(l) &&
        ((hasNextAction(l) && l.nextActionDate === t) ||
          (l.appointmentStatus === "scheduled" && l.appointmentDate === t) ||
          (l.openTaskCount > 0 && l.nextTaskDueDate === t) ||
          (l.partnerSummary?.waitingCount > 0 && l.partnerSummary?.nextFollowUpAt === t))
      );
    },
  },
  overdue: {
    label: "Achterstallige acties",
    test: (l, now) =>
      isOpenLead(l) &&
      (["overdue", "nodate"].includes(getNextActionInfo(l, now).state) ||
        (l.openTaskCount > 0 && l.nextTaskDueDate && diffInDays(l.nextTaskDueDate, now) < 0)),
  },
  appointments: {
    label: "Kennismakingen gepland",
    test: (l, now) => isOpenLead(l) && l.appointmentStatus === "scheduled" && l.appointmentDate && diffInDays(l.appointmentDate, now) >= 0,
  },
  waiting_partner: {
    label: "Wacht op partner",
    test: (l) => isOpenLead(l) && (l.partnerSummary?.waitingCount || 0) > 0,
  },
  active_search: {
    label: "Actieve zoektrajecten",
    test: (l) => isOpenLead(l) && ["active_search", "purchase_process"].includes(l.pipelineStage),
  },
  attention: {
    label: "Aandacht nodig",
    test: (l, now) => getLeadSignals(l, now).length > 0,
  },
};

export function computeKpis(leads, now = new Date()) {
  const out = {};
  Object.entries(QUICK_FILTERS).forEach(([key, f]) => {
    out[key] = leads.filter((l) => f.test(l, now)).length;
  });
  return out;
}
