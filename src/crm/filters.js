// ─── FILTEREN, ZOEKEN, SORTEREN (client-side) ───────────────────────────────
// Bij de huidige schaal (honderden, niet tienduizenden leads) is client-side
// filteren sneller en goedkoper dan Firestore-queries met composite indexes.

import { REGIONS, PRIORITIES, isClosedStage, labelOf, hasNextAction } from "./constants";
import { QUICK_FILTERS, getNextActionInfo } from "./signals";
import { daysSince, toMillis } from "./dates";
import { getCreatedDate } from "./normalize";

export const DEFAULT_FILTERS = {
  search: "",
  scope: "open",
  stage: "",
  intent: "",
  priority: "",
  owner: "all",
  region: "",
  place: "",
  goal: "",
  timeline: "",
  source: "",
  partner: "",
  nextAction: "",
  followUp: "",
  lastActivity: "",
  sort: "followup",
  quick: null,
};

function simplify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Doorzoekbare tekst van een lead. */
export function searchText(lead) {
  return simplify(
    [
      lead.name,
      lead.email,
      lead.phone,
      ...(lead.regions || []).map((r) => labelOf(REGIONS, r)),
      ...(lead.places || []),
      ...(lead.tags || []),
      lead.leadSummary,
      ...(lead.partnerNames || []),
      lead.regio, // oude regiotekst
    ]
      .filter(Boolean)
      .join(" | ")
  );
}

export function matchesSearch(lead, query) {
  const q = simplify(query).trim();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 4) {
    const phone = String(lead.phone || "").replace(/\D/g, "");
    if (phone.includes(digits) || (lead.phoneNormalized || "").includes(digits.replace(/^0/, ""))) return true;
  }
  const hay = searchText(lead);
  return q.split(/\s+/).every((part) => hay.includes(part));
}

function matchesScope(lead, scope, stageFilterActive) {
  if (scope === "all") return true;
  if (scope === "archived") return lead.archived;
  if (lead.archived) return false;
  if (stageFilterActive) return true;
  if (scope === "closed") return isClosedStage(lead.pipelineStage);
  return !isClosedStage(lead.pipelineStage); // "open"
}

function matchesFollowUp(lead, value, now) {
  if (!value) return true;
  const info = getNextActionInfo(lead, now);
  if (value === "week") return ["today", "soon"].includes(info.state);
  return info.state === value;
}

function matchesLastActivity(lead, value, now) {
  if (!value) return true;
  const last = lead.lastActivityAt || lead.lastContactAt;
  const days = daysSince(last, now);
  if (value === "never") return days === null;
  if (days === null) return false;
  if (value === "7") return days <= 7;
  if (value === "30") return days <= 30;
  if (value === "older30") return days > 30;
  return true;
}

export function applyFilters(leads, f, { currentUserId, now = new Date() } = {}) {
  const quick = f.quick ? QUICK_FILTERS[f.quick] : null;
  const res = leads.filter((l) => {
    if (quick) {
      if (l.archived && f.scope !== "archived") return false;
      if (!quick.test(l, now)) return false;
    } else if (!matchesScope(l, f.scope, Boolean(f.stage))) return false;
    if (!matchesSearch(l, f.search)) return false;
    if (f.stage && l.pipelineStage !== f.stage) return false;
    if (f.intent && l.purchaseIntent !== f.intent) return false;
    if (f.priority && l.priority !== f.priority) return false;
    if (f.owner === "me" && l.ownerId !== currentUserId) return false;
    if (f.owner === "none" && l.ownerId) return false;
    if (f.owner && !["all", "me", "none"].includes(f.owner) && l.ownerId !== f.owner) return false;
    if (f.region && !(l.regions || []).includes(f.region)) return false;
    if (f.place && !(l.places || []).some((p) => simplify(p) === simplify(f.place))) return false;
    if (f.goal && l.purchaseGoal !== f.goal) return false;
    if (f.timeline && l.purchaseTimeline !== f.timeline) return false;
    if (f.source && l.leadSource !== f.source) return false;
    if (f.partner && !(l.partnerIds || []).includes(f.partner)) return false;
    if (f.nextAction === "none" && hasNextAction(l)) return false;
    if (f.nextAction && f.nextAction !== "none" && l.nextActionType !== f.nextAction) return false;
    if (!matchesFollowUp(l, f.followUp, now)) return false;
    if (!matchesLastActivity(l, f.lastActivity, now)) return false;
    return true;
  });
  return sortLeads(res, f.sort, now);
}

const priorityRank = (l) => PRIORITIES.find((p) => p.value === l.priority)?.rank ?? 1;

export function sortLeads(leads, sort, now = new Date()) {
  return [...leads].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sort === "newest") return (toMillis(getCreatedDate(b)) || 0) - (toMillis(getCreatedDate(a)) || 0);
    if (sort === "priority") return priorityRank(b) - priorityRank(a) || getNextActionInfo(a, now).sort - getNextActionInfo(b, now).sort;
    if (sort === "last_activity") return (toMillis(b.lastActivityAt) || 0) - (toMillis(a.lastActivityAt) || 0);
    if (sort === "name") return String(a.name).localeCompare(String(b.name), "nl");
    // "followup": eerst te laat/zonder datum, dan vandaag, etc.
    return getNextActionInfo(a, now).sort - getNextActionInfo(b, now).sort;
  });
}

export function countActiveFilters(f) {
  return Object.entries(f).filter(([k, v]) => {
    if (["sort", "scope", "search", "quick"].includes(k)) return false;
    if (k === "owner") return v !== "all";
    return Boolean(v);
  }).length;
}
