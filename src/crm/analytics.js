// ─── KPI'S: ÉÉN CENTRALE DEFINITIE ──────────────────────────────────────────
// Alle KPI-logica staat hier; componenten tonen alleen. Twee soorten cijfers:
//
// 1. GEBEURTENISSEN IN DE PERIODE ("wat is er deze maand gebeurd?")
//    Telt leads waarvan de mijlpaaldatum in de periode valt. Leads zonder
//    bekende mijlpaaldatum (oude data) tellen hier niet mee: liever te laag
//    dan verzonnen.
//
// 2. COHORT-CONVERSIE ("hoe goed zijn de leads van deze maand?")
//    Basis = leads AANGEMAAKT in de periode. Per stap: welk deel heeft die stap
//    (ooit) bereikt. Zo telt een lead uit juni die in september koopt niet mee
//    in de conversie van september.

import {
  LEAD_SOURCES,
  REGIONS,
  PURCHASE_GOALS,
  PURCHASE_TIMELINES,
  PROPERTY_TYPES,
  COMMISSION_OPEN_STATUSES,
  hasNextAction,
  isClosedStage,
  labelOf,
} from "./constants";
import { reached, reachedAt } from "./milestones";
import { getCreatedDate } from "./normalize";
import { getNextActionInfo } from "./signals";
import { toDate } from "./dates";

export const FUNNEL_STEPS = [
  { key: "contact", label: "Contact gelegd" },
  { key: "meeting", label: "Gesprek gevoerd" },
  { key: "forwarded", label: "Doorgestuurd" },
  { key: "reserved", label: "Gereserveerd" },
  { key: "purchased", label: "Aankoop afgerond" },
];

// ─── PERIODES ────────────────────────────────────────────────────────────────
export const PERIODS = [
  { value: "week", label: "Deze week" },
  { value: "month", label: "Deze maand" },
  { value: "quarter", label: "Dit kwartaal" },
  { value: "year", label: "Dit jaar" },
  { value: "custom", label: "Aangepaste periode" },
];

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** @returns {{start: Date, end: Date}} end is exclusief */
export function getPeriod(key, now = new Date(), custom = {}) {
  const d = startOfDay(now);
  if (key === "week") {
    const day = (d.getDay() + 6) % 7; // maandag = 0
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) };
  }
  if (key === "quarter") {
    const q = Math.floor(d.getMonth() / 3) * 3;
    return { start: new Date(d.getFullYear(), q, 1), end: new Date(d.getFullYear(), q + 3, 1) };
  }
  if (key === "year") return { start: new Date(d.getFullYear(), 0, 1), end: new Date(d.getFullYear() + 1, 0, 1) };
  if (key === "custom" && custom.from && custom.to) {
    const [fy, fm, fd] = custom.from.split("-").map(Number);
    const [ty, tm, td] = custom.to.split("-").map(Number);
    return { start: new Date(fy, fm - 1, fd), end: new Date(ty, tm - 1, td + 1) };
  }
  return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
}

/** Even lange periode direct ervoor (voor "vergelijk met vorige periode"). */
export function previousPeriod({ start, end }, key) {
  if (key === "month") return { start: new Date(start.getFullYear(), start.getMonth() - 1, 1), end: start };
  if (key === "quarter") return { start: new Date(start.getFullYear(), start.getMonth() - 3, 1), end: start };
  if (key === "year") return { start: new Date(start.getFullYear() - 1, 0, 1), end: start };
  const len = end - start;
  return { start: new Date(start - len), end: start };
}

function inRange(date, { start, end }) {
  const d = toDate(date);
  return Boolean(d) && d >= start && d < end;
}

// ─── HOOFDCIJFERS ────────────────────────────────────────────────────────────
/** Gebeurtenissen in een periode. */
export function periodCounts(leads, period) {
  const out = { newLeads: 0 };
  FUNNEL_STEPS.forEach((s) => (out[s.key] = 0));
  leads.forEach((l) => {
    if (inRange(getCreatedDate(l), period)) out.newLeads += 1;
    FUNNEL_STEPS.forEach((s) => {
      if (inRange(reachedAt(l, s.key), period)) out[s.key] += 1;
    });
  });
  return out;
}

/** Leads aangemaakt in de periode. */
export function cohort(leads, period) {
  return leads.filter((l) => inRange(getCreatedDate(l), period));
}

/** Cohort-conversie per stap: { total, steps: { contact: {count, pct}, ... } } */
export function cohortFunnel(cohortLeads) {
  const total = cohortLeads.length;
  const steps = {};
  FUNNEL_STEPS.forEach((s) => {
    const count = cohortLeads.filter((l) => reached(l, s.key)).length;
    steps[s.key] = { count, pct: total ? count / total : null };
  });
  return { total, steps };
}

// ─── UITSPLITSINGEN (allemaal op het cohort) ────────────────────────────────
function breakdown(cohortLeads, keysOf, labelOfKey) {
  const groups = new Map();
  cohortLeads.forEach((l) => {
    const keys = keysOf(l);
    (keys.length ? keys : ["__none"]).forEach((k) => {
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(l);
    });
  });
  return Array.from(groups.entries())
    .map(([key, list]) => {
      const f = cohortFunnel(list);
      return {
        key,
        label: key === "__none" ? "Onbekend" : labelOfKey(key),
        leads: list.length,
        contact: f.steps.contact.count,
        meeting: f.steps.meeting.count,
        forwarded: f.steps.forwarded.count,
        reserved: f.steps.reserved.count,
        purchased: f.steps.purchased.count,
        conversion: f.steps.forwarded.pct,
      };
    })
    .sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label, "nl"));
}

export const BUDGET_SEGMENTS = [
  { key: "lt200", label: "Tot € 200.000", test: (v) => v < 200000 },
  { key: "200_300", label: "€ 200.000 – 300.000", test: (v) => v >= 200000 && v < 300000 },
  { key: "300_400", label: "€ 300.000 – 400.000", test: (v) => v >= 300000 && v < 400000 },
  { key: "400_600", label: "€ 400.000 – 600.000", test: (v) => v >= 400000 && v < 600000 },
  { key: "600plus", label: "€ 600.000 of meer", test: (v) => v >= 600000 },
];

export function budgetSegment(lead) {
  const v = lead.budgetMax ?? lead.budgetMin;
  if (v === null || v === undefined || v === "") return null;
  return BUDGET_SEGMENTS.find((s) => s.test(Number(v)))?.key || null;
}

export const BREAKDOWNS = {
  source: (c) => breakdown(c, (l) => [l.leadSource || "other"], (k) => labelOf(LEAD_SOURCES, k)),
  campaign: (c) => breakdown(c, (l) => (l.utmCampaign ? [l.utmCampaign] : []), (k) => k),
  content: (c) => breakdown(c, (l) => (l.utmContent ? [`${l.utmCampaign || "–"} · ${l.utmContent}`] : []), (k) => k),
  region: (c) => breakdown(c, (l) => (l.regions || []).filter((r) => r !== "unknown"), (k) => labelOf(REGIONS, k)),
  goal: (c) => breakdown(c, (l) => (l.purchaseGoal ? [l.purchaseGoal] : []), (k) => labelOf(PURCHASE_GOALS, k)),
  timeline: (c) => breakdown(c, (l) => (l.purchaseTimeline ? [l.purchaseTimeline] : []), (k) => labelOf(PURCHASE_TIMELINES, k)),
  budget: (c) => breakdown(c, (l) => (budgetSegment(l) ? [budgetSegment(l)] : []), (k) => BUDGET_SEGMENTS.find((s) => s.key === k)?.label || k),
  propertyType: (c) => breakdown(c, (l) => l.propertyTypes || [], (k) => labelOf(PROPERTY_TYPES, k)),
};

// ─── TEAM (operationeel, géén score) ─────────────────────────────────────────
export function teamStats(leads, period, users, now = new Date()) {
  const rows = new Map();
  const row = (id, name) => {
    if (!rows.has(id)) rows.set(id, { id, name, openLeads: 0, newLeads: 0, contact: 0, meeting: 0, forwarded: 0, openFollowUps: 0, overdue: 0 });
    return rows.get(id);
  };
  users.forEach((u) => row(u.id, u.displayName));
  leads.forEach((l) => {
    if (l.archived) return;
    const r = row(l.ownerId || "__none", l.ownerName || "Geen verantwoordelijke");
    if (!isClosedStage(l.pipelineStage)) r.openLeads += 1;
    if (inRange(getCreatedDate(l), period)) r.newLeads += 1;
    if (inRange(reachedAt(l, "contact"), period)) r.contact += 1;
    if (inRange(reachedAt(l, "meeting"), period)) r.meeting += 1;
    if (inRange(reachedAt(l, "forwarded"), period)) r.forwarded += 1;
    if (!isClosedStage(l.pipelineStage) && hasNextAction(l)) {
      const st = getNextActionInfo(l, now).state;
      if (st === "overdue" || st === "nodate") r.overdue += 1;
      else r.openFollowUps += 1;
    }
  });
  return Array.from(rows.values()).filter((r) => r.openLeads || r.newLeads || r.contact || r.overdue || r.openFollowUps);
}

// ─── PARTNERS ────────────────────────────────────────────────────────────────
/** Per partner: doorgestuurd, gereserveerd, afgerond, open opvolgingen. */
export function partnerStats(partners, links, leads, now = new Date()) {
  const byLead = new Map(leads.map((l) => [l.id, l]));
  const today = startOfDay(now);
  return partners.map((p) => {
    const mine = links.filter((k) => k.partnerId === p.id);
    const leadList = mine.map((k) => byLead.get(k.leadId)).filter(Boolean);
    const active = leadList.filter((l) => !l.archived && !isClosedStage(l.pipelineStage));
    const reservedCount = leadList.filter((l) => reached(l, "reserved")).length;
    const purchasedCount = leadList.filter((l) => reached(l, "purchased")).length;
    const followUpDue = mine.filter((k) => k.nextFollowUpAt && toDate(k.nextFollowUpAt) && toDate(k.nextFollowUpAt) <= today && !["completed", "no_match"].includes(k.status)).length;
    const lastContact = mine.map((k) => toDate(k.lastFollowUpAt)).filter(Boolean).sort((a, b) => b - a)[0] || null;
    return {
      partner: p,
      forwarded: mine.length,
      activeLeads: active.length,
      reserved: reservedCount,
      purchased: purchasedCount,
      conversion: mine.length ? purchasedCount / mine.length : null,
      followUpDue,
      openFollowUps: mine.filter((k) => k.nextFollowUpAt && !["completed", "no_match"].includes(k.status)).length,
      lastContact,
    };
  });
}

// ─── COMMISSIE ───────────────────────────────────────────────────────────────
export function commissionAmountExpected(l) {
  return Number(l.commissionExpectedAmount ?? l.saleCommission) || 0;
}

/** Hoog niveau: verwacht (nog te ontvangen), ontvangen in periode, openstaand. */
export function commissionSummary(leads, period) {
  const sold = leads.filter((l) => l.pipelineStage === "completed");
  const open = sold.filter((l) => COMMISSION_OPEN_STATUSES.includes(l.commissionStatus));
  const receivedInPeriod = sold.filter((l) => l.commissionStatus === "received" && (!period || inRange(l.commissionReceivedAt ? `${l.commissionReceivedAt}T12:00:00` : null, period)));
  return {
    expected: sold.filter((l) => l.commissionStatus === "expected").reduce((s, l) => s + commissionAmountExpected(l), 0),
    outstanding: open.reduce((s, l) => s + Math.max(0, commissionAmountExpected(l) - (Number(l.commissionReceivedAmount) || 0)), 0),
    received: receivedInPeriod.reduce((s, l) => s + (Number(l.commissionReceivedAmount) || commissionAmountExpected(l)), 0),
    completedDeals: sold.length,
  };
}

export function pct(v) {
  return v === null || v === undefined ? "–" : `${Math.round(v * 100)}%`;
}

/** Verschil t.o.v. vorige periode als tekst (+3 / −2 / 0). */
export function delta(now, prev) {
  const d = now - prev;
  return d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : "0";
}
