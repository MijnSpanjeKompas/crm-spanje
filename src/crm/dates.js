// ─── DATUMHULPEN ─────────────────────────────────────────────────────────────
// Kalenderdagen ("YYYY-MM-DD") worden altijd in lokale tijd behandeld.
// (De oude code gebruikte toISOString(), wat na middernacht in Spanje de
// datum van gisteren kon geven.)

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n) {
  return String(n).padStart(2, "0");
}

/** Date → "YYYY-MM-DD" in lokale tijd. */
export function toISODate(date) {
  if (!date) return "";
  const d = toDate(date);
  if (!d) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(now = new Date()) {
  return toISODate(now);
}

export function addDaysISO(iso, days) {
  const d = toDate(iso);
  if (!d) return "";
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/**
 * Zet allerlei datumvormen om naar een Date:
 * Firestore Timestamp, {seconds}, Date, millis, "YYYY-MM-DD", ISO-string.
 */
export function toDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000 + Math.round((value.nanoseconds || 0) / 1e6));
  }
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function toMillis(value) {
  const d = toDate(value);
  return d ? d.getTime() : null;
}

/** Aantal kalenderdagen van vandaag tot iso (negatief = verleden). */
export function diffInDays(iso, now = new Date()) {
  const target = toDate(iso);
  if (!target) return null;
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((t - today) / DAY_MS);
}

/** Aantal hele dagen sinds een tijdstip. */
export function daysSince(value, now = new Date()) {
  const ms = toMillis(value);
  if (ms === null) return null;
  return Math.floor((now.getTime() - ms) / DAY_MS);
}

export function hoursSince(value, now = new Date()) {
  const ms = toMillis(value);
  if (ms === null) return null;
  return (now.getTime() - ms) / (60 * 60 * 1000);
}

export function formatDate(value) {
  const d = toDate(value);
  if (!d) return "–";
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "–";
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "vandaag", "gisteren", "3 dagen geleden" of datum. */
export function formatRelative(value, now = new Date()) {
  const d = toDate(value);
  if (!d) return "–";
  const diff = diffInDays(d, now);
  if (diff === 0) return "vandaag";
  if (diff === -1) return "gisteren";
  if (diff === 1) return "morgen";
  if (diff < 0 && diff > -14) return `${Math.abs(diff)} dagen geleden`;
  if (diff > 0 && diff < 14) return `over ${diff} dagen`;
  return formatDate(d);
}

/** Waarde voor <input type="datetime-local">. */
export function toDateTimeLocal(value) {
  const d = toDate(value) || new Date();
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDateTimeLocal(str) {
  if (!str) return new Date();
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
