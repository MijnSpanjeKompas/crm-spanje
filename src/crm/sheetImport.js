// ─── GOOGLE SHEETS → CRM: CENTRALE MAPPING ──────────────────────────────────
// Eén plek die een rij uit de lead-Sheet omzet naar een CRM-lead. Wordt
// gebruikt door de import in de app (ImportModal) én door de Cloud Function
// (functions/src/index.js bundelt dit bestand mee). Geen Firebase-imports hier:
// alles is puur en daardoor testbaar.
//
// Uitgangspunten:
// - mensleesbare Sheet-waarden → stabiele interne codes (UI toont labels);
// - niets weggooien: de originele rij gaat mee in `importRaw`;
// - Submission ID = harde duplicaatcontrole, e-mail/telefoon = zachte controle.

import { emptyLead, normalizePhone, normalizeEmail, parseLegacyBudget, mapLegacyRegion, findDuplicateLeads } from "./normalize";

/** Kolomnamen zoals ze in de Sheet staan. */
export const SHEET_COLUMNS = [
  "Submission ID",
  "Submission time",
  "property_type",
  "listing_type",
  "bedrooms",
  "region",
  "max_budget",
  "aankooptijd",
  "doeleinde",
  "financiering",
  "bezoek spanje",
  "name",
  "Telefoonnummer",
  "email",
  "contact",
  "bereikbaar",
  "toestemming",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "landingPage",
  "form_source",
  "mail_status",
  "pdf_url",
  "pdf_file_id",
  "pdf_created_at",
  "pdf_sent",
  "growth_sync_status",
  "growth_synced_at",
  "growth_sync_error",
];

// ─── HULPEN ──────────────────────────────────────────────────────────────────
function s(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

/** Kleine letters, zonder accenten, enkele spaties. */
export function simplifyText(v) {
  return s(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Waarde uit een rij, ongeacht hoofdletters/spaties in de kolomnaam. */
export function getCell(row, column) {
  if (!row) return "";
  if (row[column] !== undefined) return s(row[column]);
  const want = simplifyText(column).replace(/[\s_]/g, "");
  const key = Object.keys(row).find((k) => simplifyText(k).replace(/[\s_]/g, "") === want);
  return key ? s(row[key]) : "";
}

function splitMulti(v) {
  return s(v)
    .split(/[,;|\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Eerste regel waarvan een van de woorden voorkomt. */
function matchRules(value, rules) {
  const t = simplifyText(value);
  if (!t) return "";
  const hit = rules.find(([words]) => words.some((w) => t.includes(w)));
  return hit ? hit[1] : "";
}

function toBool(v) {
  const t = simplifyText(v);
  if (!t) return null;
  if (["ja", "yes", "true", "1", "akkoord", "checked", "on", "y", "x", "toegestaan"].some((w) => t === w || t.startsWith(`${w} `))) return true;
  if (["nee", "no", "false", "0", "n", "geen"].some((w) => t === w || t.startsWith(`${w} `))) return false;
  return null;
}

/**
 * Datum/tijd uit de Sheet → Date. Ondersteunt ISO, "2026-10-01 19:14(:00)",
 * "1-10-2026 19:14" en "01/10/2026 19:14" (dag eerst, Nederlandse notatie).
 */
export function parseSheetDate(v) {
  const t = s(v);
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(t)) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  }
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDate(d) {
  if (!d) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ─── VELD-MAPPINGS (formulierwaarde → interne code) ─────────────────────────
const PROPERTY_RULES = [
  [["penthouse"], "penthouse"],
  [["appartement", "apartment", "flat"], "apartment"],
  [["geschakeld", "semi", "twee-onder", "2-onder", "quad"], "semi_detached"],
  [["townhouse", "rijwoning", "rijtjes", "bungalow"], "townhouse"],
  [["villa", "vrijstaand"], "villa"],
  [["finca", "landhuis"], "finca"],
];

export function mapPropertyTypes(v) {
  const out = [];
  splitMulti(v).forEach((part) => {
    const hit = matchRules(part, PROPERTY_RULES);
    const code = hit || (simplifyText(part) && !/geen voorkeur|maakt niet uit|weet/.test(simplifyText(part)) ? "other" : "");
    if (code && !out.includes(code)) out.push(code);
  });
  return out;
}

export function mapListingType(v) {
  const t = simplifyText(v);
  if (!t) return "";
  const nieuw = /nieuwbouw|new ?build|nieuw/.test(t);
  const resale = /resale|bestaand|bestaande bouw/.test(t);
  if (nieuw && resale) return "both";
  if (/beide|allebei|geen voorkeur|maakt niet uit/.test(t)) return t.includes("geen voorkeur") || t.includes("maakt niet uit") ? "no_preference" : "both";
  if (nieuw) return "new_build";
  if (resale) return "resale";
  return "";
}

export function mapBedrooms(v) {
  const m = s(v).match(/\d+/);
  return m ? Number(m[0]) : null;
}

export function mapRegions(v) {
  const regions = [];
  const places = [];
  splitMulti(v).forEach((part) => {
    if (/geen voorkeur|weet (ik )?(het )?nog niet|nog onbekend|maakt niet uit/.test(simplifyText(part))) {
      if (!regions.includes("unknown")) regions.push("unknown");
      return;
    }
    const r = mapLegacyRegion(part);
    r.regions.forEach((x) => !regions.includes(x) && regions.push(x));
    r.places.forEach((x) => !places.includes(x) && places.push(x));
  });
  return { regions, places };
}

export function mapBudget(v) {
  return parseLegacyBudget(v);
}

const TIMELINE_RULES = [
  [["zo snel", "direct", "per direct", "asap", "zsm"], "immediate"],
  // 6–12 vóór 3–6: "binnen 6-12 maanden" bevat ook "binnen 6".
  [["6-12", "6 - 12", "6 tot 12", "binnen 12", "binnen een jaar", "binnen 1 jaar", "6 a 12"], "6_to_12_months"],
  [["3-6", "3 - 6", "3 tot 6", "binnen 6", "3 a 6"], "3_to_6_months"],
  [["binnen 3", "0-3", "0 - 3", "1-3", "1 - 3"], "within_3_months"],
  [["12+", "meer dan 12", "langer dan", "na 12", "over een jaar", "1-2 jaar", "> 12", "later"], "over_12_months"],
  [["weet", "orienter", "nog niet", "onbekend"], "unknown"],
];

export function mapTimeline(v) {
  return matchRules(v, TIMELINE_RULES);
}

const GOAL_RULES = [
  [["semi"], "semi_permanent"],
  [["overwinter", "winter"], "wintering"],
  [["emigr", "verhuiz"], "emigration"],
  [["permanent", "vast wonen", "pensioen"], "permanent_living"],
  [["tweede woning", "2e woning"], "second_home"],
  [["vakantie"], "holiday_home"],
  [["investering", "belegging", "rendement"], "investment"],
  [["verhuur"], "rental"],
];

export function mapGoal(v) {
  return matchRules(v, GOAL_RULES) || (s(v) ? "other" : "");
}

const FINANCING_RULES = [
  [["combinatie", "deels"], "combination"],
  [["hypotheek", "financiering nodig", "lening"], "mortgage"],
  [["eigen middelen", "eigen geld", "contant", "cash", "eigen vermogen", "spaargeld"], "own_funds"],
  [["weet", "onbekend", "nog niet"], "unknown"],
];

export function mapFinancing(v) {
  return matchRules(v, FINANCING_RULES);
}

/** "bezoek spanje" → { visitSpainStatus, visitSpainDate, visitSpainNotes } */
export function mapSpainVisit(v) {
  const raw = s(v);
  const t = simplifyText(v);
  if (!t) return { visitSpainStatus: "", visitSpainDate: "", visitSpainNotes: "" };
  const d = /\d/.test(t) ? parseSheetDate(raw) : null;
  if (d) return { visitSpainStatus: "date_known", visitSpainDate: isoDate(d), visitSpainNotes: "" };
  let status = "";
  if (/al geweest|ben er al|woon|in spanje|zit er|verblijf/.test(t)) status = "in_spain_or_visited";
  else if (/nog geen datum|datum onbekend|nog niet gepland|binnenkort/.test(t) && /^ja|gepland|binnenkort/.test(t)) status = "planned_no_date";
  else if (/^nee|niet gepland|geen plannen|nog niet/.test(t)) status = "not_planned";
  else if (/^ja/.test(t)) status = "planned_no_date";
  return { visitSpainStatus: status, visitSpainDate: "", visitSpainNotes: raw };
}

/** "contact" → { preferredContactMethod, contactPreferenceText } */
export function mapContactPreference(v) {
  const raw = s(v);
  const t = simplifyText(v);
  if (!t) return { preferredContactMethod: "no_preference", contactPreferenceText: "" };
  const wa = t.indexOf("whatsapp") >= 0 ? t.indexOf("whatsapp") : t.indexOf("app") >= 0 ? t.indexOf("app") : -1;
  const ph = ["tele", "bel", "phone"].map((w) => t.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? -1;
  const em = t.includes("mail") ? t.indexOf("mail") : -1;
  let method = "no_preference";
  if (wa >= 0 && ph >= 0) method = wa < ph ? "whatsapp_then_phone" : "phone_then_whatsapp";
  else if (wa >= 0) method = "whatsapp";
  else if (ph >= 0) method = "phone";
  else if (em >= 0) method = "email";
  const simple = ["whatsapp", "telefoon", "telefonisch", "bellen", "e-mail", "email", "mail", "geen voorkeur", "maakt niet uit"];
  return { preferredContactMethod: method, contactPreferenceText: simple.includes(t) ? "" : raw };
}

/** "bereikbaar" → { preferredContactMoment, contactMomentText } */
export function mapContactMoment(v) {
  const raw = s(v);
  const t = simplifyText(v);
  if (!t) return { preferredContactMoment: "no_preference", contactMomentText: "" };
  const hits = [
    ["ochtend", "morning"],
    ["middag", "afternoon"],
    ["avond", "evening"],
    ["weekend", "weekend"],
  ].filter(([w]) => t.includes(w));
  let moment = "no_preference";
  if (hits.length === 1) moment = hits[0][1];
  const simple = ["ochtend", "middag", "avond", "weekend", "maakt niet uit", "geen voorkeur", "altijd"];
  return { preferredContactMoment: moment, contactMomentText: hits.length > 1 || !simple.includes(t) ? raw : "" };
}

/**
 * Leadbron uit UTM/formulier. utm_source "fb"/"ig" + betaald → Meta Ads, enz.
 * Ruwe waarden blijven bewaard in utmSource/utmMedium.
 */
export function mapLeadSource({ utmSource, utmMedium, formSource }) {
  const src = simplifyText(utmSource);
  const med = simplifyText(utmMedium);
  const paid = /paid|cpc|ppc|ads?$|social_paid|paid_social|display|cpm/.test(med);
  if (/^(fb|facebook|ig|instagram|meta|an|msg)$/.test(src) || src.includes("facebook") || src.includes("instagram")) {
    if (paid || !med) return "meta_ads";
    return src.startsWith("ig") || src.includes("instagram") ? "instagram_organic" : "facebook_organic";
  }
  if (src.includes("google")) return paid ? "google_ads" : "google_organic";
  if (src.includes("tiktok")) return "tiktok";
  const form = simplifyText(formSource);
  if (/rekentool|calculator|kosten/.test(form)) return "website_calculator";
  if (/contact/.test(form)) return "website_contact";
  if (/koopgids|gids|guide/.test(form)) return "website_buyers_guide";
  if (/vragenlijst|zoekprofiel|website|formulier/.test(form) || src) return "website_questionnaire";
  return "website_questionnaire";
}

// ─── RIJ → LEAD ──────────────────────────────────────────────────────────────
/**
 * Zet één Sheet-rij om naar { form, extra, submissionId, problems }.
 * form  = waarden voor de normale leadvelden (zoals het formulier ze kent)
 * extra = bron-/systeemvelden die niet via het formulier lopen
 */
export function mapSheetRow(row) {
  const get = (c) => getCell(row, c);
  const problems = [];

  const submissionId = get("Submission ID");
  const submittedAt = parseSheetDate(get("Submission time"));
  const name = get("name");
  const phone = get("Telefoonnummer");
  const email = get("email");
  if (!submissionId) problems.push("Submission ID ontbreekt");
  if (!name) problems.push("Naam ontbreekt");
  if (!phone && !email) problems.push("Geen telefoon en geen e-mail");

  const utm = {
    utmSource: get("utm_source"),
    utmMedium: get("utm_medium"),
    utmCampaign: get("utm_campaign"),
    utmContent: get("utm_content"),
  };
  const formSource = get("form_source");
  const budget = mapBudget(get("max_budget"));
  const loc = mapRegions(get("region"));
  const contact = mapContactPreference(get("contact"));
  const moment = mapContactMoment(get("bereikbaar"));
  const visit = mapSpainVisit(get("bezoek spanje"));

  const form = {
    ...emptyLead(null),
    name,
    // Leesbaar: zoals ingevuld. Genormaliseerde vorm wordt bij opslaan apart bewaard.
    phone: displayPhone(phone),
    email: email.toLowerCase(),
    preferredContactMethod: contact.preferredContactMethod,
    contactPreferenceText: contact.contactPreferenceText,
    preferredContactMoment: moment.preferredContactMoment,
    contactMomentText: moment.contactMomentText,
    pipelineStage: "new_lead",
    ownerId: "",
    ownerName: "",
    nextActionType: "first_contact",
    nextActionDate: isoDate(submittedAt || new Date()),
    nextActionAssignedTo: "",
    nextActionAssignedToName: "",
    budgetMin: budget.budgetMin,
    budgetMax: budget.budgetMax,
    regions: loc.regions,
    places: loc.places,
    propertyTypes: mapPropertyTypes(get("property_type")),
    buildPreference: mapListingType(get("listing_type")),
    bedroomsMin: mapBedrooms(get("bedrooms")),
    purchaseTimeline: mapTimeline(get("aankooptijd")),
    purchaseGoal: mapGoal(get("doeleinde")),
    financingType: mapFinancing(get("financiering")),
    visitSpainStatus: visit.visitSpainStatus,
    visitSpainDate: visit.visitSpainDate,
    visitSpainNotes: visit.visitSpainNotes,
    consentContact: toBool(get("toestemming")),
    leadSource: mapLeadSource({ ...utm, formSource }),
    formSource,
    landingPage: get("landingPage"),
    ...utm,
  };

  const pdfUrl = get("pdf_url");
  const extra = {
    sourceSubmissionId: submissionId,
    sourceSubmittedAt: submittedAt,
    importSource: "google_sheet",
    // Originele rij: niets gaat verloren (audit/debugging, latere herberekening).
    importRaw: Object.fromEntries(SHEET_COLUMNS.map((c) => [c, get(c)])),
    searchProfilePdf: pdfUrl
      ? {
          url: pdfUrl,
          fileId: get("pdf_file_id"),
          createdAt: parseSheetDate(get("pdf_created_at")),
          sent: toBool(get("pdf_sent")),
        }
      : null,
    syncInfo: {
      mailStatus: get("mail_status"),
      growthSyncStatus: get("growth_sync_status"),
      growthSyncedAt: parseSheetDate(get("growth_synced_at")),
      growthSyncError: get("growth_sync_error"),
    },
  };

  return { submissionId, form, extra, problems, valid: problems.length === 0 };
}

/** Leesbaar telefoonnummer: "31612345678" → "+31 6 12345678". Onbekende vormen blijven zoals ze zijn. */
export function displayPhone(phone) {
  const raw = s(phone);
  const n = normalizePhone(raw);
  if (/^316\d{8}$/.test(n)) return `+31 6 ${n.slice(3)}`;
  if (/^34\d{9}$/.test(n)) return `+34 ${n.slice(2, 5)} ${n.slice(5, 8)} ${n.slice(8)}`;
  if (/^32\d{8,9}$/.test(n)) return `+32 ${n.slice(2)}`;
  if (/^\d{10,15}$/.test(raw.replace(/\s/g, "")) && !raw.startsWith("0") && !raw.startsWith("+")) return `+${n}`;
  return raw;
}

// ─── IMPORTPLAN (DUPLICATEN) ─────────────────────────────────────────────────
/**
 * Bepaalt per rij wat er moet gebeuren, zonder iets te schrijven.
 * status: "new" | "already_exists" | "possible_duplicate" | "invalid"
 * - already_exists: Submission ID bestaat al → nooit een tweede lead.
 * - possible_duplicate: nieuw Submission ID, maar e-mail/telefoon komt al voor.
 *   Wordt wel geïmporteerd, met verwijzing naar de bestaande lead(s); geen merge.
 */
export function planImport(rows, existingLeads = []) {
  const bySubmission = new Map();
  existingLeads.forEach((l) => l.sourceSubmissionId && bySubmission.set(String(l.sourceSubmissionId), l));
  const seen = new Map();
  const pending = [];

  return rows.map((row, index) => {
    const mapped = mapSheetRow(row);
    const base = { index, row, ...mapped };
    if (!mapped.valid) return { ...base, status: "invalid" };
    const existing = bySubmission.get(mapped.submissionId);
    if (existing) return { ...base, status: "already_exists", existingId: existing.id, existingName: existing.name };
    if (seen.has(mapped.submissionId)) return { ...base, status: "already_exists", existingId: null, existingName: `rij ${seen.get(mapped.submissionId) + 1}` };
    seen.set(mapped.submissionId, index);

    const pool = [...existingLeads, ...pending];
    const dups = findDuplicateLeads(pool, { email: mapped.form.email, phone: mapped.form.phone });
    pending.push({ id: `pending-${index}`, name: mapped.form.name, email: mapped.form.email, phone: mapped.form.phone, emailNormalized: normalizeEmail(mapped.form.email), phoneNormalized: normalizePhone(mapped.form.phone) });
    if (dups.length) {
      return { ...base, status: "possible_duplicate", duplicates: dups.map((d) => ({ id: d.id, name: d.name || "" })) };
    }
    return { ...base, status: "new" };
  });
}

// ─── CSV ─────────────────────────────────────────────────────────────────────
/** Simpele CSV/TSV-parser (quotes, komma/puntkomma/tab). Eerste regel = kolomnamen. */
export function parseCsv(text) {
  const src = String(text || "").replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/)[0] || "";
  const delim = firstLine.includes("\t") ? "\t" : (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let cur = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) {
      cur.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i += 1;
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  const nonEmpty = rows.filter((r) => r.some((x) => String(x).trim() !== ""));
  if (!nonEmpty.length) return [];
  const header = nonEmpty[0].map((h) => String(h).trim());
  return nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

/**
 * Vaste document-id voor een Sheet-lead. Twee keer dezelfde Submission ID
 * importeren kan daardoor nooit twee leads opleveren (ook niet bij gelijktijdige calls).
 */
export function sheetLeadId(submissionId) {
  const safe = String(submissionId || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 120);
  return safe ? `sheet-${safe}` : null;
}

/** Activiteit bij een geïmporteerde lead (actor = systeem). */
export function importActivity(mapped, status) {
  const lines = [`Formulier: ${mapped.form.formSource || "onbekend"}`, `Submission ID: ${mapped.submissionId}`];
  if (status === "possible_duplicate") lines.push("Let op: mogelijk bestaat deze lead al (zelfde e-mail of telefoon).");
  return {
    type: "system",
    title: "Lead binnengekomen via Google Sheet",
    description: lines.join("\n"),
    occurredAt: mapped.extra.sourceSubmittedAt || new Date(),
    actorType: "system",
    actorId: "sheets_import",
    actionType: "lead_imported",
    metadata: { event: "lead_imported", submissionId: mapped.submissionId, possibleDuplicate: status === "possible_duplicate" },
  };
}
