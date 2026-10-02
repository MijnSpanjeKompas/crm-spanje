// ─── SIGNALEN & DASHBOARDLOGICA ──────────────────────────────────────────────
// Alles werkt op de (gedenormaliseerde) velden van het leaddocument, zodat het
// dashboard nooit per lead subcollections hoeft op te halen.

import { THRESHOLDS, isClosedStage, hasNextAction, nextActionText } from "./constants";
import { diffInDays, todayISO, formatDate } from "./dates";

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

/**
 * Meldingen voor één lead. Bewust beperkt tot de volgende actie: een verlopen
 * actie of een actie zonder datum. Overige automatische signalen (geen contact,
 * inactiviteit, zoekprofiel, partneropvolging, ...) worden niet meer getoond.
 * @returns {{key:string,label:string,severity:"high"|"medium"|"low"}[]}
 */
export function getLeadSignals(lead, now = new Date()) {
  const signals = [];
  if (!isOpenLead(lead)) return signals;

  const na = getNextActionInfo(lead, now);
  if (na.state === "overdue") signals.push({ key: "overdue_action", label: `Actie verlopen: ${nextActionText(lead)} (${na.label})`, severity: "high" });
  if (na.state === "nodate") signals.push({ key: "action_no_date", label: `Actie zonder datum: ${nextActionText(lead)}`, severity: "medium" });

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
      items.push({ lead, kind: "appointment", label: `Gesprek${lead.appointmentTime ? ` om ${lead.appointmentTime}` : ""}`, who: lead.appointmentAssignedToName, sort: 0, time: lead.appointmentTime });
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
    label: "Gesprekken gepland",
    test: (l, now) => isOpenLead(l) && l.appointmentStatus === "scheduled" && l.appointmentDate && diffInDays(l.appointmentDate, now) >= 0,
  },
  waiting_partner: {
    label: "Wacht op partner",
    test: (l) => isOpenLead(l) && (l.partnerSummary?.waitingCount || 0) > 0,
  },
  active_search: {
    label: "Doorgestuurd & gereserveerd",
    test: (l) => isOpenLead(l) && ["partner_connected", "purchase_process"].includes(l.pipelineStage),
  },
  attention: {
    label: "Verlopen acties",
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
