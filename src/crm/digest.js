// ─── DAGELIJKS OVERZICHT (mail om 08:00) ────────────────────────────────────
// Gedeeld door de app (voorbeeld + instellingen) en de Cloud Function
// functions/src/dagoverzicht.js (bundelt dit bestand mee via esbuild).
// Puur: krijgt leads/taken/koppelingen binnen en geeft onderwerp + HTML + tekst terug.

import { buildAgendaItems, itemsInRange, overdueItems } from "./agenda";
import { leadArrivedAt } from "./milestones";
import { LEAD_SOURCES, REGIONS, labelOf } from "./constants";
import { todayISO } from "./dates";

const DAYS = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const TYPE_LABEL = { meeting: "Gesprek", followup: "Actie", task: "Taak", partner: "Partner" };

/** Standaardinstellingen (settings/dagoverzicht). */
export const DEFAULT_DIGEST_SETTINGS = {
  enabled: false,
  weekend: false,
  crmUrl: "",
  recipients: {
    luke: { enabled: true, email: "" },
    indy: { enabled: true, email: "" },
  },
};

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function dateLine(now) {
  return `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

/**
 * @param {{leads:Object[], tasks?:Object[], links?:Object[], now?:Date, profile?:{id:string, displayName:string}, crmUrl?:string}} input
 *   leads moeten genormaliseerd zijn (normalizeLead); prullenbak/archief wordt overgeslagen.
 */
export function buildDigest({ leads, tasks = [], links = [], now = new Date(), profile = null, crmUrl = "" }) {
  const live = leads.filter((l) => !l.deletedAt && !l.archived);
  const today = todayISO(now);
  const items = buildAgendaItems({ leads: live, tasks, links });
  const todays = itemsInRange(items, today, today).filter((it) => !it.monthOnly && !(it.done && it.type !== "meeting"));
  const late = overdueItems(items, today);
  const since = new Date(now.getTime() - 24 * 3600 * 1000);
  const fresh = live.filter((l) => {
    const d = leadArrivedAt(l);
    return d && d >= since && d <= now;
  });
  const mine = (it) => profile && (it.ownerName === profile.displayName || it.ownerId === profile.id);

  const total = todays.length + late.length + fresh.length;
  const name = profile?.displayName || "team";
  const subject = total
    ? `MSK dagoverzicht: ${todays.length} vandaag${late.length ? `, ${late.length} te laat` : ""}${fresh.length ? `, ${fresh.length} nieuw` : ""}`
    : "MSK dagoverzicht: niets op de planning";

  const row = (it, extra = "") => {
    const who = it.ownerName ? ` · ${it.ownerName}${mine(it) ? " (jij)" : ""}` : "";
    return {
      text: `- ${it.time ? `${it.time} ` : ""}${TYPE_LABEL[it.type] || ""}: ${it.leadName} – ${it.title}${who}${extra}`,
      html: `<tr><td style="padding:8px 0;border-bottom:1px solid #efeae1;vertical-align:top;width:70px;color:#5f6e80;font-size:13px">${esc(it.time || TYPE_LABEL[it.type] || "")}</td><td style="padding:8px 0;border-bottom:1px solid #efeae1;font-size:14px"><strong style="color:#102a43">${esc(it.leadName)}</strong><br><span style="color:#334a5e">${esc(it.title)}${esc(who)}${esc(extra)}</span></td></tr>`,
    };
  };
  const lateRow = (it) => row(it, ` · gepland ${it.monthOnly ? "in " : "op "}${it.date.split("-").reverse().join("-")}`);
  const freshRow = (l) => {
    const where = [...(l.regions || []).filter((r) => r !== "unknown").map((r) => labelOf(REGIONS, r)), ...(l.places || [])].slice(0, 2).join(", ");
    const src = l.leadSource ? labelOf(LEAD_SOURCES, l.leadSource) : "";
    const bits = [src, where, l.budgetMax ? `tot € ${Number(l.budgetMax).toLocaleString("nl-NL")}` : ""].filter(Boolean).join(" · ");
    return {
      text: `- ${l.name || "Naam onbekend"}${bits ? ` (${bits})` : ""}`,
      html: `<tr><td style="padding:8px 0;border-bottom:1px solid #efeae1;font-size:14px"><strong style="color:#102a43">${esc(l.name || "Naam onbekend")}</strong>${bits ? `<br><span style="color:#5f6e80;font-size:13px">${esc(bits)}</span>` : ""}</td></tr>`,
    };
  };

  const sections = [
    { title: `Vandaag (${todays.length})`, rows: todays.map((it) => row(it)), empty: "Niets gepland voor vandaag." },
    late.length ? { title: `Te laat (${late.length})`, rows: late.slice(0, 15).map(lateRow), more: late.length > 15 ? `+ ${late.length - 15} meer in de Agenda` : "", color: "#b3453a" } : null,
    fresh.length ? { title: `Nieuw binnen, afgelopen 24 uur (${fresh.length})`, rows: fresh.map(freshRow) } : null,
  ].filter(Boolean);

  const text = [
    `Goedemorgen ${name},`,
    "",
    `Dit staat er ${dateLine(now)} op de planning.`,
    ...sections.flatMap((s) => ["", s.title, ...(s.rows.length ? s.rows.map((r) => r.text) : [s.empty]), ...(s.more ? [s.more] : [])]),
    "",
    crmUrl ? `Open het CRM: ${crmUrl}` : "",
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f7f4ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#102a43">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#946a17;font-weight:700">Mijn Spanje Kompas</div>
<h1 style="font-family:Georgia,serif;font-size:24px;color:#0b304c;margin:6px 0 4px">Goedemorgen ${esc(name)}</h1>
<div style="color:#5f6e80;font-size:14px;margin-bottom:18px">Dit staat er ${esc(dateLine(now))} op de planning.</div>
${sections
  .map(
    (s) => `<div style="background:#fff;border:1px solid #e6e0d6;border-radius:14px;padding:14px 16px;margin-bottom:14px">
<div style="font-size:15px;font-weight:700;color:${s.color || "#0b304c"};margin-bottom:4px">${esc(s.title)}</div>
${s.rows.length ? `<table role="presentation" style="width:100%;border-collapse:collapse">${s.rows.map((r) => r.html).join("")}</table>` : `<div style="color:#5f6e80;font-size:14px;padding:6px 0">${esc(s.empty)}</div>`}
${s.more ? `<div style="color:#5f6e80;font-size:13px;padding-top:8px">${esc(s.more)}</div>` : ""}
</div>`
  )
  .join("\n")}
${crmUrl ? `<a href="${esc(crmUrl)}" style="display:inline-block;background:#0b304c;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px">Open het CRM</a>` : ""}
<div style="color:#7a8696;font-size:12px;margin-top:18px">Automatisch verstuurd door het MSK CRM. Uitzetten kan onder Instellingen → Dagelijks overzicht.</div>
</div></body></html>`;

  return { subject, text, html, counts: { today: todays.length, late: late.length, fresh: fresh.length } };
}
