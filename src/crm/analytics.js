// ─── KPI'S: ÉÉN CENTRALE DEFINITIE PER CIJFER ───────────────────────────────
// Componenten tonen alleen; hier wordt alles berekend. Twee soorten cijfers:
//
// COHORT  — leads BINNENGEKOMEN in de periode. Welk deel bereikte (ooit) elke
//           funnelstap? Voor funnel, conversie, bronnen, kwaliteit.
//           Een aankoop van een lead uit juni telt niet mee in het cohort van september.
// EVENT   — wat GEBEURDE er in de periode (op mijlpaaldatum). Voor trends en
//           operationele/financiële tellingen. Zonder bekende datum telt een
//           gebeurtenis niet mee: liever te laag dan verzonnen.
//
// Funnelstappen zijn cumulatief (zie milestones.reached): een latere stap
// impliceert alle eerdere, zodat de funnel nooit "omhoog" kan lopen.

import { LEAD_SOURCES, REGIONS, PURCHASE_GOALS, COMMISSION_OPEN_STATUSES, STAGES_REQUIRING_NEXT_ACTION, hasNextAction, isClosedStage, labelOf } from "./constants";
import { reached, reachedAt, reachedImplicitly, leadArrivedAt, FUNNEL_ORDER } from "./milestones";
import { getNextActionInfo } from "./signals";
import { toDate, todayISO } from "./dates";

/**
 * @typedef {{start: Date, end: Date}} Period  end is exclusief
 * @typedef {{count: number, total: number, pct: number|null}} Ratio
 * @typedef {{key: string, label: string, info: string, count: number, pctOfCohort: number|null, fromPrevious: number|null, implied: number}} FunnelStage
 * @typedef {{key: string, label: string, leads: number, contact: Ratio, meeting: Ratio, qualified: number, forwarded: number, reserved: number, purchased: number, toForwarded: Ratio}} GroupStats
 */

// ─── HULPEN ──────────────────────────────────────────────────────────────────
/** @returns {Ratio} pct = null bij 0 in de noemer (nooit "NaN%"). */
export function ratio(count, total) {
  return { count, total, pct: total > 0 ? count / total : null };
}

export function pct(v) {
  return v === null || v === undefined || Number.isNaN(v) ? "–" : `${Math.round(v * 100)}%`;
}

/** "71% · 30 van 42" */
export function ratioText(r) {
  return r.total ? `${pct(r.pct)} · ${r.count} van ${r.total}` : "–";
}

/** Verandering t.o.v. vorige periode. Tellingen relatief (%), percentages in procentpunten. */
export function change(now, prev, { asRate = false } = {}) {
  if (now === null || now === undefined || prev === null || prev === undefined) return null;
  if (asRate) {
    const pp = Math.round((now - prev) * 100);
    return { dir: Math.sign(pp), text: pp === 0 ? "Geen verandering" : `${pp > 0 ? "↑" : "↓"} ${Math.abs(pp)} pp` };
  }
  if (prev === 0) return now === 0 ? { dir: 0, text: "Geen verandering" } : { dir: 1, text: "↑ was 0" };
  const p = Math.round(((now - prev) / prev) * 100);
  return { dir: Math.sign(p), text: p === 0 ? "Geen verandering" : `${p > 0 ? "↑" : "↓"} ${Math.abs(p)}%` };
}

function inRange(date, { start, end }) {
  const d = toDate(date);
  return Boolean(d) && d >= start && d < end;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ─── PERIODES ────────────────────────────────────────────────────────────────
export const PERIODS = [
  { value: "week", label: "Deze week" },
  { value: "month", label: "Deze maand" },
  { value: "quarter", label: "Dit kwartaal" },
  { value: "year", label: "Dit jaar" },
  { value: "custom", label: "Aangepaste periode" },
];

/** @returns {Period} */
export function getPeriod(key, now = new Date(), custom = {}) {
  const d = startOfDay(now);
  if (key === "week") {
    const day = (d.getDay() + 6) % 7;
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

/** Even lange periode direct ervoor (kalendermaand/-kwartaal/-jaar waar van toepassing). */
export function previousPeriod({ start, end }, key) {
  if (key === "month") return { start: new Date(start.getFullYear(), start.getMonth() - 1, 1), end: start };
  if (key === "quarter") return { start: new Date(start.getFullYear(), start.getMonth() - 3, 1), end: start };
  if (key === "year") return { start: new Date(start.getFullYear() - 1, 0, 1), end: start };
  const len = end - start;
  return { start: new Date(start - len), end: start };
}

// ─── COHORT & FUNNEL ─────────────────────────────────────────────────────────
/** Leads binnengekomen in de periode (formuliertijd gaat voor importmoment). */
export function cohort(leads, period) {
  return leads.filter((l) => inRange(leadArrivedAt(l), period));
}

export const FUNNEL_STEPS = [
  { key: "contact", label: "Contact gelegd", info: "Daadwerkelijk contact geregistreerd (niet alleen een poging), of een latere stap bereikt." },
  { key: "meeting", label: "Gesprek gevoerd", info: "Een gesprek is als afgerond geregistreerd, of een latere stap bereikt." },
  { key: "qualified", label: "Gekwalificeerd", info: "Kwalificatie staat op 'Gekwalificeerd', of de lead is al doorgestuurd." },
  { key: "forwarded", label: "Doorgestuurd", info: "Aan een partner doorgegeven." },
  { key: "reserved", label: "Gereserveerd", info: "De klant heeft gereserveerd of een bod gedaan." },
  { key: "purchased", label: "Aankoop afgerond", info: "De aankoop is afgerond." },
];

/**
 * Funnel van een cohort. Elke stap telt leads die die stap OF een latere
 * bereikten. `implied` = aantal dat alleen via een latere stap meetelt.
 * @returns {{total: number, stages: FunnelStage[]}}
 */
export function cohortFunnel(cohortLeads) {
  const total = cohortLeads.length;
  let prev = total;
  const stages = FUNNEL_STEPS.map((s) => {
    const count = cohortLeads.filter((l) => reached(l, s.key)).length;
    const st = {
      key: s.key,
      label: s.label,
      info: s.info,
      count,
      pctOfCohort: total ? count / total : null,
      fromPrevious: prev ? count / prev : null,
      implied: cohortLeads.filter((l) => reachedImplicitly(l, s.key)).length,
    };
    prev = count;
    return st;
  });
  return { total, stages };
}

/** Hoofdcijfers (cohort). Alle percentages met teller en noemer. */
export function kpiSummary(cohortLeads) {
  const n = cohortLeads.length;
  const count = (step) => cohortLeads.filter((l) => reached(l, step)).length;
  const forwarded = count("forwarded");
  return {
    newLeads: n,
    contact: ratio(count("contact"), n),
    meeting: ratio(count("meeting"), n),
    qualified: ratio(count("qualified"), n),
    forwarded: ratio(forwarded, n),
    reserved: ratio(count("reserved"), n),
    purchased: ratio(count("purchased"), n),
    forwardedToPurchase: ratio(cohortLeads.filter((l) => reached(l, "purchased")).length, forwarded),
  };
}

// ─── EVENTS & TREND ──────────────────────────────────────────────────────────
export const TREND_SERIES = [
  { key: "newLeads", label: "Nieuwe leads" },
  { key: "meeting", label: "Gesprekken" },
  { key: "forwarded", label: "Doorgestuurd" },
  { key: "purchased", label: "Aankopen" },
];

function eventDate(lead, key) {
  return key === "newLeads" ? leadArrivedAt(lead) : reachedAt(lead, key);
}

/** Gebeurtenissen per soort in een periode (op mijlpaaldatum). */
export function eventCounts(leads, period) {
  const out = {};
  TREND_SERIES.forEach((s) => (out[s.key] = leads.filter((l) => inRange(eventDate(l, s.key), period)).length));
  return out;
}

/** Bucketgrootte: dag (≤ 45 dagen), week (≤ ~6 maanden), anders maand. */
export function bucketsFor(period) {
  const days = Math.round((period.end - period.start) / 86400000);
  const out = [];
  if (days <= 45) {
    for (let d = new Date(period.start); d < period.end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      out.push({ start: d, end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), label: `${d.getDate()}/${d.getMonth() + 1}` });
    }
    return { unit: "dag", buckets: out };
  }
  if (days <= 190) {
    for (let d = new Date(period.start); d < period.end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
      const e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
      out.push({ start: d, end: e < period.end ? e : period.end, label: `${d.getDate()}/${d.getMonth() + 1}` });
    }
    return { unit: "week", buckets: out };
  }
  const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  for (let d = new Date(period.start.getFullYear(), period.start.getMonth(), 1); d < period.end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    out.push({ start: d, end: new Date(d.getFullYear(), d.getMonth() + 1, 1), label: MONTHS[d.getMonth()] });
  }
  return { unit: "maand", buckets: out };
}

/** Trend per bucket. De vorige periode ligt op dezelfde positie (dag 1 naast dag 1). */
export function trend(leads, period, prev) {
  const { unit, buckets } = bucketsFor(period);
  const prevBuckets = prev ? bucketsFor(prev).buckets : [];
  const series = {};
  const previous = {};
  TREND_SERIES.forEach((s) => {
    series[s.key] = buckets.map((b) => leads.filter((l) => inRange(eventDate(l, s.key), b)).length);
    previous[s.key] = buckets.map((_, i) => (prevBuckets[i] ? leads.filter((l) => inRange(eventDate(l, s.key), prevBuckets[i])).length : null));
  });
  return { unit, labels: buckets.map((b) => b.label), series, previous };
}

// ─── LEADKWALITEIT ───────────────────────────────────────────────────────────
const SHORT_TERM = ["immediate", "within_3_months", "3_to_6_months"];

export function leadQuality(cohortLeads) {
  const n = cohortLeads.length;
  const knownTerm = cohortLeads.filter((l) => l.purchaseTimeline && l.purchaseTimeline !== "unknown");
  const budgets = cohortLeads.map((l) => Number(l.budgetMax)).filter((v) => Number.isFinite(v) && v > 0);
  const assessed = cohortLeads.filter((l) => ["qualified", "unqualified"].includes(l.qualificationStatus) || reached(l, "qualified"));
  return {
    qualified: ratio(cohortLeads.filter((l) => reached(l, "qualified")).length, n),
    unqualified: cohortLeads.filter((l) => l.qualificationStatus === "unqualified" && !reached(l, "qualified")).length,
    assessed: ratio(assessed.length, n),
    shortTerm: ratio(knownTerm.filter((l) => SHORT_TERM.includes(l.purchaseTimeline)).length, knownTerm.length),
    avgBudgetMax: budgets.length ? Math.round(budgets.reduce((s, v) => s + v, 0) / budgets.length) : null,
    budgetSample: budgets.length,
  };
}

/** Redenen "niet gekwalificeerd" (gestructureerd, plus "Geen reden opgegeven"). */
export function unqualifiedReasons(cohortLeads, reasons) {
  const un = cohortLeads.filter((l) => l.qualificationStatus === "unqualified");
  const rows = reasons.map((r) => ({ key: r.value, label: r.label, value: un.filter((l) => l.unqualifiedReason === r.value).length }));
  const none = un.filter((l) => !l.unqualifiedReason).length;
  return [...rows, { key: "none", label: "Geen reden opgegeven", value: none }].filter((r) => r.value > 0);
}

// ─── OPVOLGING ───────────────────────────────────────────────────────────────
/**
 * Opvolgsnelheid (cohort) + huidige werkvoorraad (alle open leads).
 * Poging ≠ contact: een poging is bellen/appen/mailen, ook zonder gehoor.
 */
export function followUpStats(cohortLeads, allLeads, now = new Date()) {
  const dueBefore = new Date(now.getTime() - 24 * 3600 * 1000);
  const withTimes = cohortLeads.map((l) => ({ l, arrived: leadArrivedAt(l), attempt: reachedAt(l, "attempt") })).filter((x) => x.arrived);
  const measured = withTimes.filter((x) => x.attempt && x.attempt >= x.arrived);
  const durations = measured.map((x) => x.attempt - x.arrived);
  // Alleen leads die al 24 uur binnen zijn (of al opgevolgd) tellen voor de 24-uursnorm.
  const due = withTimes.filter((x) => x.arrived <= dueBefore || x.attempt);
  const within24 = due.filter((x) => x.attempt && x.attempt - x.arrived <= 24 * 3600 * 1000);
  const open = allLeads.filter((l) => !l.archived && !isClosedStage(l.pipelineStage));
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    avgFirstAttemptMs: durations.length ? durations.reduce((s, v) => s + v, 0) / durations.length : null,
    medianFirstAttemptMs: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
    sample: durations.length,
    within24h: ratio(within24.length, due.length),
    noAttempt: withTimes.filter((x) => !x.attempt && x.arrived <= dueBefore).length,
    // Wel geprobeerd, (nog) nooit bereikt
    notReached: cohortLeads.filter((l) => reachedAt(l, "attempt") && !reached(l, "contact")).length,
    withoutNextAction: open.filter((l) => STAGES_REQUIRING_NEXT_ACTION.includes(l.pipelineStage) && !hasNextAction(l)).length,
    overdue: open.filter((l) => hasNextAction(l) && ["overdue", "nodate"].includes(getNextActionInfo(l, now).state)).length,
  };
}

/** "1u 18m" / "2d 4u" / "35m" */
export function formatDuration(ms) {
  if (ms === null || ms === undefined) return "–";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}u ${min % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}u`;
}

/**
 * Show-up: gesprekken die in de periode hadden moeten plaatsvinden.
 * Het datamodel kent één (laatste) afspraak per lead, dus dit is een benadering.
 */
export function showUp(leads, period, now = new Date()) {
  const today = todayISO(now);
  const due = leads.filter((l) => {
    if (!l.appointmentDate || !inRange(`${l.appointmentDate}T12:00:00`, period)) return false;
    return l.appointmentStatus === "completed" || l.appointmentStatus === "no_show" || (l.appointmentStatus === "scheduled" && l.appointmentDate < today);
  });
  return {
    rate: ratio(due.filter((l) => l.appointmentStatus === "completed").length, due.length),
    noShow: due.filter((l) => l.appointmentStatus === "no_show").length,
    unresolved: due.filter((l) => l.appointmentStatus === "scheduled").length,
  };
}

// ─── BRONNEN / CAMPAGNES / ADVERTENTIES ──────────────────────────────────────
export const ATTRIBUTION = {
  source: { label: "Leadbron", col: "Bron", keyOf: (l) => l.leadSource || "", labelOf: (k) => labelOf(LEAD_SOURCES, k) },
  campaign: { label: "Campagne", col: "Campagne", keyOf: (l) => String(l.utmCampaign || "").trim(), labelOf: (k) => k },
  content: { label: "Advertentie", col: "Advertentie", keyOf: (l) => String(l.utmContent || "").trim(), labelOf: (k) => k },
};

/** @returns {GroupStats[]} met een "Onbekend"-rij voor leads zonder waarde (niets verdwijnt). */
export function groupStats(cohortLeads, dimension) {
  const dim = ATTRIBUTION[dimension];
  const groups = new Map();
  cohortLeads.forEach((l) => {
    const k = dim.keyOf(l) || "__unknown";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(l);
  });
  return Array.from(groups.entries())
    .map(([key, list]) => {
      const c = (step) => list.filter((l) => reached(l, step)).length;
      const forwarded = c("forwarded");
      return {
        key,
        label: key === "__unknown" ? "Onbekend" : dim.labelOf(key),
        leads: list.length,
        contact: ratio(c("contact"), list.length),
        meeting: ratio(c("meeting"), list.length),
        qualified: c("qualified"),
        forwarded,
        reserved: c("reserved"),
        purchased: c("purchased"),
        toForwarded: ratio(forwarded, list.length),
      };
    })
    .sort((a, b) => Number(a.key === "__unknown") - Number(b.key === "__unknown") || b.leads - a.leads || a.label.localeCompare(b.label, "nl"));
}

// ─── VERDELINGEN ─────────────────────────────────────────────────────────────
export const TIMELINE_BUCKETS = [
  { key: "0_3", label: "0–3 maanden", values: ["immediate", "within_3_months"] },
  { key: "3_6", label: "3–6 maanden", values: ["3_to_6_months"] },
  { key: "6_12", label: "6–12 maanden", values: ["6_to_12_months"] },
  { key: "12plus", label: "12+ maanden", values: ["over_12_months"] },
  { key: "unknown", label: "Nog onbekend", values: ["unknown", ""] },
];

export const BUDGET_SEGMENTS = [
  { key: "lt200", label: "Tot € 200.000", test: (v) => v < 200000 },
  { key: "200_300", label: "€ 200.000 – € 300.000", test: (v) => v >= 200000 && v < 300000 },
  { key: "300_400", label: "€ 300.000 – € 400.000", test: (v) => v >= 300000 && v < 400000 },
  { key: "400_500", label: "€ 400.000 – € 500.000", test: (v) => v >= 400000 && v < 500000 },
  { key: "500plus", label: "€ 500.000+", test: (v) => v >= 500000 },
];

/** Segment op budgetMax (valt terug op budgetMin). Geen budget → null (= Onbekend). */
export function budgetSegment(lead) {
  const raw = lead.budgetMax ?? lead.budgetMin;
  const v = Number(raw);
  if (raw === null || raw === undefined || raw === "" || !Number.isFinite(v) || v <= 0) return null;
  return BUDGET_SEGMENTS.find((s) => s.test(v))?.key || null;
}

/** Rijen voor een horizontale bar chart: {key, label, value}. */
export function distribution(cohortLeads, kind) {
  if (kind === "timeline") {
    return TIMELINE_BUCKETS.map((b) => ({ key: b.key, label: b.label, value: cohortLeads.filter((l) => b.values.includes(l.purchaseTimeline || "")).length }));
  }
  if (kind === "budget") {
    return [
      ...BUDGET_SEGMENTS.map((s) => ({ key: s.key, label: s.label, value: cohortLeads.filter((l) => budgetSegment(l) === s.key).length })),
      { key: "unknown", label: "Onbekend", value: cohortLeads.filter((l) => !budgetSegment(l)).length },
    ];
  }
  if (kind === "goal") {
    const rows = PURCHASE_GOALS.map((g) => ({ key: g.value, label: g.label, value: cohortLeads.filter((l) => l.purchaseGoal === g.value).length })).filter((r) => r.value > 0);
    const unknown = cohortLeads.filter((l) => !l.purchaseGoal).length;
    return [...rows.sort((a, b) => b.value - a.value), ...(unknown ? [{ key: "unknown", label: "Onbekend", value: unknown }] : [])];
  }
  if (kind === "region") {
    // Een lead kan meerdere regio's hebben: telt bij elke regio één keer.
    const rows = REGIONS.filter((r) => r.value !== "unknown").map((r) => ({
      key: r.value,
      label: r.label,
      value: cohortLeads.filter((l) => (l.regions || []).includes(r.value)).length,
    }));
    const unknown = cohortLeads.filter((l) => !(l.regions || []).some((r) => r !== "unknown")).length;
    return [...rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value), ...(unknown ? [{ key: "unknown", label: "Onbekend", value: unknown }] : [])];
  }
  return [];
}

// ─── PARTNERS ────────────────────────────────────────────────────────────────
/** Per partner: feitelijke aantallen (geen ranking/score). */
export function partnerStats(partners, links, leads, now = new Date()) {
  const byLead = new Map(leads.map((l) => [l.id, l]));
  const today = startOfDay(now);
  return partners.map((p) => {
    const mine = links.filter((k) => k.partnerId === p.id);
    const leadList = mine.map((k) => byLead.get(k.leadId)).filter(Boolean);
    const active = leadList.filter((l) => !l.archived && !isClosedStage(l.pipelineStage));
    const reservedCount = leadList.filter((l) => reached(l, "reserved")).length;
    const purchasedCount = leadList.filter((l) => reached(l, "purchased")).length;
    const openLinks = mine.filter((k) => !["completed", "no_match"].includes(k.status));
    const followUpDue = openLinks.filter((k) => k.nextFollowUpAt && toDate(k.nextFollowUpAt) && toDate(k.nextFollowUpAt) <= today).length;
    const lastContact =
      mine
        .map((k) => toDate(k.lastFollowUpAt))
        .filter(Boolean)
        .sort((a, b) => b - a)[0] || null;
    return {
      partner: p,
      forwarded: mine.length,
      activeLeads: active.length,
      reserved: reservedCount,
      purchased: purchasedCount,
      conversion: mine.length ? purchasedCount / mine.length : null,
      toPurchase: ratio(purchasedCount, mine.length),
      followUpDue,
      openFollowUps: openLinks.filter((k) => k.nextFollowUpAt).length,
      lastContact,
    };
  });
}

// ─── TEAM ────────────────────────────────────────────────────────────────────
/** Per verantwoordelijke (cohort + werkvoorraad). Geen score of ranking. */
export function teamStats(leads, period, users, now = new Date()) {
  const rows = new Map();
  const row = (id, name) => {
    if (!rows.has(id)) rows.set(id, { id, name, newLeads: 0, contact: 0, meeting: 0, forwarded: 0, openFollowUps: 0, overdue: 0 });
    return rows.get(id);
  };
  users.forEach((u) => row(u.id, u.displayName));
  leads.forEach((l) => {
    if (l.archived) return;
    const r = row(l.ownerId || "__none", l.ownerName || "Geen verantwoordelijke");
    if (inRange(leadArrivedAt(l), period)) {
      r.newLeads += 1;
      if (reached(l, "contact")) r.contact += 1;
      if (reached(l, "meeting")) r.meeting += 1;
      if (reached(l, "forwarded")) r.forwarded += 1;
    }
    if (!isClosedStage(l.pipelineStage) && hasNextAction(l)) {
      const st = getNextActionInfo(l, now).state;
      if (st === "overdue" || st === "nodate") r.overdue += 1;
      else r.openFollowUps += 1;
    }
  });
  return Array.from(rows.values()).filter((r) => r.newLeads || r.overdue || r.openFollowUps);
}

/** Aantal verschillende verantwoordelijken met (niet-gearchiveerde) leads. */
export function distinctOwners(leads) {
  return new Set(leads.filter((l) => !l.archived).map((l) => l.ownerId || "__none")).size;
}

// ─── FINANCIEEL ──────────────────────────────────────────────────────────────
export function commissionAmountExpected(l) {
  return Number(l.commissionExpectedAmount ?? l.saleCommission) || 0;
}

/** Verwacht + openstaand (huidige stand); ontvangen + aankopen (event, in de periode). */
export function commissionSummary(leads, period) {
  const sold = leads.filter((l) => l.pipelineStage === "completed");
  const open = sold.filter((l) => COMMISSION_OPEN_STATUSES.includes(l.commissionStatus));
  const receivedInPeriod = sold.filter(
    (l) => l.commissionStatus === "received" && (!period || inRange(l.commissionReceivedAt ? `${l.commissionReceivedAt}T12:00:00` : null, period)),
  );
  return {
    expected: sold.filter((l) => l.commissionStatus === "expected").reduce((s, l) => s + commissionAmountExpected(l), 0),
    outstanding: open.reduce((s, l) => s + Math.max(0, commissionAmountExpected(l) - (Number(l.commissionReceivedAmount) || 0)), 0),
    received: receivedInPeriod.reduce((s, l) => s + (Number(l.commissionReceivedAmount) || commissionAmountExpected(l)), 0),
    completedDeals: sold.length,
    purchasesInPeriod: period ? leads.filter((l) => inRange(reachedAt(l, "purchased"), period)).length : sold.length,
  };
}

/** Datakwaliteit van een cohort: wat ontbreekt er (zodat niets stil verdwijnt). */
export function dataQuality(cohortLeads) {
  return {
    total: cohortLeads.length,
    unknownSource: cohortLeads.filter((l) => !l.leadSource || l.leadSource === "other").length,
    unknownTimeline: cohortLeads.filter((l) => !l.purchaseTimeline || l.purchaseTimeline === "unknown").length,
    noBudget: cohortLeads.filter((l) => !budgetSegment(l)).length,
    possibleDuplicates: cohortLeads.filter((l) => (l.possibleDuplicateOf || []).length).length,
    impliedLeads: cohortLeads.filter((l) => FUNNEL_ORDER.some((step) => reachedImplicitly(l, step))).length,
  };
}
