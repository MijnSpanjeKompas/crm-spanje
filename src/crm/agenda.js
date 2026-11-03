// ─── AGENDA & NOTIFICATIES ───────────────────────────────────────────────────
// Eén plek die uit bestaande CRM-data een tijdlijn van "te doen" maakt:
// gesprekken (lead.appointment*), volgende acties (lead.nextAction*), taken
// (tasks-subcollecties) en partneropvolgingen (partnerLinks.nextFollowUpAt).
// Er wordt niets extra opgeslagen.

import { APPOINTMENT_TYPES, PARTNER_WAITING_STATUSES, hasNextAction, isClosedStage, labelOf, nextActionText } from "./constants";
import { todayISO, monthStartISO, toDate } from "./dates";
import { leadArrivedAt } from "./milestones";
import { profileNameOnly } from "./profiles";

export const AGENDA_TYPES = [
  { value: "all", label: "Alles" },
  { value: "meeting", label: "Gesprekken" },
  { value: "followup", label: "Follow-ups" },
  { value: "task", label: "Taken" },
  { value: "partner", label: "Partners" },
];

const TYPE_META = {
  meeting: { label: "Gesprek", icon: "calendar" },
  followup: { label: "Follow-up", icon: "bell" },
  task: { label: "Taak", icon: "check" },
  partner: { label: "Partneropvolging", icon: "users" },
};

export function agendaTypeMeta(type) {
  return TYPE_META[type] || { label: type, icon: "dot" };
}

function addMinutes(time, minutes) {
  if (!/^\d{1,2}:\d{2}$/.test(time || "")) return "";
  const [h, m] = time.split(":").map(Number);
  const t = h * 60 + m + minutes;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

function isoOf(v) {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  const d = v instanceof Date ? v : typeof v.toDate === "function" ? v.toDate() : null;
  return d ? todayISO(d) : "";
}

/**
 * Alle agenda-items (zonder datumfilter). Elk item:
 * { id, type, date (YYYY-MM-DD), monthOnly, time, endTime, title, subtitle,
 *   leadId, leadName, ownerId, ownerName, status, tab, done }
 */
export function buildAgendaItems({ leads, tasks = [], links = [] }) {
  const byId = new Map(leads.map((l) => [l.id, l]));
  const items = [];
  const live = (l) => l && !l.archived;

  leads.forEach((l) => {
    if (!live(l)) return;
    if (l.appointmentDate && ["scheduled", "completed", "no_show"].includes(l.appointmentStatus)) {
      items.push({
        id: `meeting-${l.id}`,
        type: "meeting",
        date: l.appointmentDate,
        time: l.appointmentTime || "",
        endTime: addMinutes(l.appointmentTime, 30),
        title: labelOf(APPOINTMENT_TYPES, l.appointmentType || "phone") || "Gesprek",
        leadId: l.id,
        leadName: l.name,
        ownerId: l.appointmentAssignedTo || l.ownerId || "",
        ownerName: profileNameOnly(l.appointmentAssignedToName),
        status: l.appointmentStatus,
        done: l.appointmentStatus !== "scheduled",
        tab: "followup",
      });
    }
    // "Gesprek voeren" alleen overslaan als hetzelfde gesprek al als afspraak in de agenda staat;
    // anders zou die actie nergens verschijnen.
    const meetingShown = l.appointmentStatus === "scheduled" && l.appointmentDate && l.appointmentDate === l.nextActionDate;
    if (!isClosedStage(l.pipelineStage) && hasNextAction(l) && l.nextActionDate && !(l.nextActionType === "conduct_appointment" && meetingShown)) {
      items.push({
        id: `followup-${l.id}`,
        type: "followup",
        date: l.nextActionMonthOnly ? monthStartISO(l.nextActionDate) : l.nextActionDate,
        monthOnly: Boolean(l.nextActionMonthOnly),
        time: "",
        title: nextActionText(l),
        leadId: l.id,
        leadName: l.name,
        ownerId: l.nextActionAssignedTo || l.ownerId || "",
        ownerName: profileNameOnly(l.nextActionAssignedToName),
        status: "open",
        done: false,
        tab: "followup",
      });
    }
  });

  tasks.forEach((t) => {
    const l = byId.get(t.leadId);
    if (!live(l) || t.status !== "open" || !t.dueDate) return;
    items.push({
      id: `task-${t.leadId}-${t.id}`,
      type: "task",
      date: t.dueDate,
      time: "",
      title: t.title,
      leadId: l.id,
      leadName: l.name,
      ownerId: t.assignedToUserId || "",
      ownerName: profileNameOnly(t.assignedToName),
      status: "open",
      done: false,
      tab: "followup",
    });
  });

  links.forEach((k) => {
    const l = byId.get(k.leadId);
    const date = isoOf(k.nextFollowUpAt);
    if (!live(l) || !date || ["completed", "no_match"].includes(k.status)) return;
    items.push({
      id: `partner-${k.leadId}-${k.id}`,
      type: "partner",
      date,
      time: "",
      title: `${k.partnerName} opvolgen`,
      subtitle: PARTNER_WAITING_STATUSES.includes(k.status) ? "wacht op terugkoppeling" : "",
      leadId: l.id,
      leadName: l.name,
      partnerId: k.partnerId,
      ownerId: l.ownerId || "",
      ownerName: "",
      status: k.status,
      done: false,
      tab: "partners",
    });
  });

  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.time || "99").localeCompare(b.time || "99") || String(a.leadName).localeCompare(String(b.leadName), "nl"));
}

/** Items in [fromISO, toISO] (beide inclusief). Maand-acties alleen als hun maand overlapt. */
export function itemsInRange(items, fromISO, toISO) {
  return items.filter((it) => (it.monthOnly ? it.date.slice(0, 7) >= fromISO.slice(0, 7) && it.date.slice(0, 7) <= toISO.slice(0, 7) : it.date >= fromISO && it.date <= toISO));
}

/** Te laat: open items vóór vandaag (maand-acties pas na hun maand). */
export function overdueItems(items, today = todayISO()) {
  return items.filter((it) => {
    const late = it.monthOnly ? it.date.slice(0, 7) < today.slice(0, 7) : it.date < today;
    return (!it.done && late) || (it.type === "meeting" && it.status === "scheduled" && it.date < today);
  });
}

export function filterAgenda(items, { type = "all", ownerId = "" } = {}) {
  return items.filter((it) => (type === "all" || it.type === type) && (!ownerId || it.ownerId === ownerId));
}

function daysBetween(fromISO, toISO) {
  const [a, b] = [fromISO, toISO].map((x) => {
    const [y, m, d] = String(x).slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86400000);
}

function monthEndOf(iso) {
  const [y, m] = String(iso).split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

// ─── NOTIFICATIES ────────────────────────────────────────────────────────────
/** Een nieuwe lead geeft maximaal zo lang een melding (daarna staat hij gewoon in de lijst). */
const NEW_LEAD_NOTIFY_DAYS = 3;
/** Verlopen items ouder dan dit tellen niet meer als melding (wel in de Agenda onder "Te laat"). */
const OVERDUE_NOTIFY_DAYS = 14;

/**
 * Meldingen worden afgeleid uit de data (geen aparte opslag). Elk heeft een
 * stabiele id, zodat "gelezen" per profiel bijgehouden kan worden.
 * Bewust beperkt tot wat nu aandacht vraagt:
 *  - nieuwe lead (max. 3 dagen oud) die nog niet is opgepakt;
 *  - mogelijke dubbele lead, importfout;
 *  - gesprek vandaag;
 *  - actie/taak/partneropvolging vandaag of de afgelopen 14 dagen verlopen.
 * `external` = meldingen van buitenaf (bijv. toekomstige AI-agents) met dezelfde vorm.
 */
export function buildNotifications({ leads, tasks = [], links = [], now = new Date(), external = [] }) {
  const today = todayISO(now);
  const out = [];
  const items = buildAgendaItems({ leads, tasks, links });
  const nowMin = now.getHours() * 60 + now.getMinutes();

  leads.forEach((l) => {
    if (l.archived) return;
    const arrived = leadArrivedAt(l);
    const fresh = arrived && now - arrived <= NEW_LEAD_NOTIFY_DAYS * 24 * 3600 * 1000;
    const handled = Boolean(l.lastContactAt || toDate(l.firstContactAttemptAt) || toDate(l.firstContactAt));
    if (l.pipelineStage === "new_lead" && fresh && !handled) {
      out.push({ id: `new:${l.id}`, kind: "new_lead", severity: "info", title: "Nieuwe lead ontvangen", text: l.name || "Naam onbekend", leadId: l.id, tab: "overview" });
    }
    if ((l.possibleDuplicateOf || []).length) {
      out.push({ id: `dup:${l.id}`, kind: "duplicate", severity: "warn", title: "Mogelijke dubbele lead", text: l.name || "", leadId: l.id, tab: "overview" });
    }
    if (l.syncInfo?.growthSyncError) {
      out.push({ id: `sync:${l.id}:${l.syncInfo.growthSyncError}`, kind: "import_error", severity: "warn", title: "Synchronisatie- of importfout", text: l.name || "", leadId: l.id, tab: "overview" });
    }
  });

  items.forEach((it) => {
    if (it.done) return;
    const base = { leadId: it.leadId, tab: it.tab, partnerId: it.partnerId };
    if (it.type === "meeting" && it.date === today) {
      const [h, m] = (it.time || "00:00").split(":").map(Number);
      const startsIn = h * 60 + m - nowMin;
      const soon = it.time && startsIn >= 0 && startsIn <= 60;
      out.push({ ...base, id: `meeting:${it.id}:${it.date}`, kind: "meeting", severity: soon ? "warn" : "info", title: soon ? "Gesprek start binnenkort" : "Gesprek vandaag", text: `${it.time ? `${it.time} · ` : ""}${it.leadName}` });
      return;
    }
    const late = it.monthOnly ? it.date.slice(0, 7) < today.slice(0, 7) : it.date < today;
    const lateSince = it.monthOnly ? monthEndOf(it.date) : it.date;
    const tooOld = late && daysBetween(lateSince, today) > OVERDUE_NOTIFY_DAYS;
    if (late && tooOld) return;
    if (late) {
      const title = { followup: "Opvolgactie verlopen", task: "Taak over deadline", partner: "Partneropvolging verlopen", meeting: "Gesprek nog niet afgerond" }[it.type];
      out.push({ ...base, id: `late:${it.id}:${it.date}`, kind: `${it.type}_overdue`, severity: "high", title, text: `${it.leadName} · ${it.title}` });
    } else if (!it.monthOnly && it.date === today) {
      const title = { followup: "Lead heeft vandaag opvolging nodig", task: "Taak heeft deadline vandaag", partner: "Partner vandaag opvolgen" }[it.type];
      if (title) out.push({ ...base, id: `today:${it.id}:${it.date}`, kind: `${it.type}_today`, severity: "info", title, text: `${it.leadName} · ${it.title}` });
    }
  });

  const rank = { high: 0, warn: 1, info: 2 };
  return [...external, ...out].sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
}
