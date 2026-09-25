// ─── NORMALISATIE & BACKWARDS COMPATIBILITY ─────────────────────────────────
// Oude Firestore-leads (schemaVersion ontbreekt) worden bij het uitlezen
// vertaald naar het nieuwe model. Er wordt NIETS verwijderd:
//  - oude velden blijven in Firestore staan;
//  - bij opslaan worden alleen nieuwe velden toegevoegd/bijgewerkt;
//  - wat niet betrouwbaar te mappen is, blijft zichtbaar via lead._legacy.

import {
  SCHEMA_VERSION,
  PIPELINE_STAGES,
  PURCHASE_INTENTS,
  PRIORITIES,
  NEXT_ACTION_TYPES,
  LEAD_SOURCES,
  REGIONS,
  PROPERTY_TYPES,
  BUILD_PREFERENCES,
  PURCHASE_GOALS,
  PURCHASE_TIMELINES,
  FINANCING_TYPES,
  HOUSING_SITUATIONS,
  RENTAL_INTEREST,
  REQUIREMENTS,
  PREFERRED_CONTACT_METHODS,
  PREFERRED_CONTACT_MOMENTS,
  APPOINTMENT_TYPES,
  APPOINTMENT_STATUSES,
  CLOSURE_REASONS,
  CONTACT_METHODS,
  PARTNER_LINK_STATUSES,
} from "./constants";
import { toDate, todayISO } from "./dates";

const ANDERS = "Anders, namelijk...";

// ─── VELDEN ──────────────────────────────────────────────────────────────────
/** Velden die via het leadformulier worden beheerd en opgeslagen. */
export const FORM_FIELDS = [
  "name", "email", "phone",
  "preferredContactMethod", "preferredContactMoment",
  "pipelineStage", "purchaseIntent", "priority",
  "ownerId", "ownerName",
  "leadSummary", "notities",
  "nextActionType", "nextActionLabel", "nextActionDate",
  "nextActionAssignedTo", "nextActionAssignedToName", "nextActionNotes",
  "appointmentDate", "appointmentTime", "appointmentType",
  "appointmentAssignedTo", "appointmentAssignedToName", "appointmentStatus",
  "budgetMin", "budgetMax", "regions", "places", "propertyTypes",
  "buildPreference", "bedroomsMin", "bathroomsMin",
  "purchaseGoal", "purchaseTimeline", "financingType", "availableEquity",
  "currentHousingSituation", "visitSpainDate", "visitSpainNotes",
  "rentalInterest", "requirements", "extraRequirements",
  "leadSource", "utmSource", "utmMedium", "utmCampaign", "utmContent", "landingPage",
  "tags",
  "closureReason", "closureNotes",
  "pinned",
];

const ARRAY_FIELDS = ["regions", "places", "propertyTypes", "requirements", "tags"];
const NUMBER_FIELDS = ["budgetMin", "budgetMax", "bedroomsMin", "bathroomsMin", "availableEquity"];

// ─── KLEINE HULPEN ───────────────────────────────────────────────────────────
function isValidKey(options, value) {
  return options.some((o) => o.value === value);
}

function simplify(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq(arr) {
  return Array.from(new Set(arr.filter((v) => v !== undefined && v !== null && v !== "")));
}

function str(v) {
  return typeof v === "string" ? v : v === undefined || v === null ? "" : String(v);
}

function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function splitList(text) {
  return String(text || "")
    .split(/[,;/\n]| en /i)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── CONTACT-NORMALISATIE (duplicaatdetectie) ────────────────────────────────
export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * Telefoon → alleen cijfers in internationale vorm waar mogelijk.
 * "06 12 34 56 78" en "+31 6 12345678" → "31612345678".
 */
export function normalizePhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 10) digits = `31${digits.slice(1)}`;
  return digits;
}

function phonesMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  // Laatste 9 cijfers vergelijken vangt landcode-varianten af.
  return a.length >= 9 && b.length >= 9 && a.slice(-9) === b.slice(-9);
}

/** Zoekt bestaande leads (ook gearchiveerde) met hetzelfde e-mailadres of telefoonnummer. */
export function findDuplicateLeads(leads, { email, phone }, excludeId) {
  const e = normalizeEmail(email);
  const p = normalizePhone(phone);
  if (!e && !p) return [];
  return leads.filter((lead) => {
    if (excludeId && lead.id === excludeId) return false;
    const le = lead.emailNormalized || normalizeEmail(lead.email);
    const lp = lead.phoneNormalized || normalizePhone(lead.phone);
    return (e && le && e === le) || (p && phonesMatch(p, lp));
  });
}

// ─── LEGACY MAPPINGS ─────────────────────────────────────────────────────────
const LEGACY_STATUS_MAP = {
  "nieuwe lead": "new_lead",
  "in gesprek": "contact_phase",
  "wacht op reactie": "contact_phase",
  "intake gepland": "appointment_scheduled",
  "intake gehad": "appointment_completed",
  "zoekprofiel duidelijk": "qualified",
  "doorgegeven": "partner_connected",
  "doorgestuurd naar makelaar": "partner_connected",
  "woningvoorstellen gestuurd": "active_search",
  "actieve klant": "active_search",
  "afgerond": "completed",
  "niet doorgegaan": "stopped",
};

/** Oude status → nieuwe pipelinefase. Onbekend → "new_lead". */
export function mapLegacyStatus(status) {
  if (isValidKey(PIPELINE_STAGES, status)) return status;
  return LEGACY_STATUS_MAP[simplify(status)] || "new_lead";
}

/**
 * Oud leadtype → { purchaseIntent, priority }.
 * "Warm lead" was de standaardwaarde bij elke nieuwe lead en zegt dus weinig:
 * die mappen we bewust naar "Nog onbekend" + "Normaal".
 */
export function mapLegacyLeadType(leadType) {
  const map = {
    "hot lead": { purchaseIntent: "concrete_plans", priority: "high" },
    "a-lead": { purchaseIntent: "concrete_plans", priority: "high" },
    "warm lead": { purchaseIntent: "unknown", priority: "normal" },
    "b-lead": { purchaseIntent: "unknown", priority: "normal" },
    "lauwe lead": { purchaseIntent: "orienting", priority: "normal" },
    "koude lead": { purchaseIntent: "orienting", priority: "low" },
    "c-lead": { purchaseIntent: "orienting", priority: "low" },
  };
  return map[simplify(leadType)] || { purchaseIntent: "unknown", priority: "normal" };
}

/** Oude leadbron → nieuwe key. "Website" was vrijwel altijd de vragenlijst-funnel. */
export function mapLegacySource(source) {
  if (isValidKey(LEAD_SOURCES, source)) return source;
  const map = {
    website: "website_questionnaire",
    "meta ads": "meta_ads",
    "google ads": "google_ads",
    "via-via": "referral",
    "via via": "referral",
    partner: "partner",
    anders: "other",
    organisch: "other", // niet eenduidig (Google/Instagram/Facebook) → legacy bewaard
  };
  return map[simplify(source)] || (source ? "other" : "manual");
}

/** Oude regio-tekst → { regions[], places[] }. */
export function mapLegacyRegion(text) {
  const s = simplify(text);
  if (!s || s === "nog niet zeker" || s === "regio onbekend") return { regions: [], places: [] };
  const direct = REGIONS.find((r) => simplify(r.label) === s || r.value === s);
  if (direct) return { regions: [direct.value], places: [] };
  if (s.includes("costa blanca noord") || s.includes("costa blanca north")) return { regions: ["costa_blanca_noord"], places: [] };
  if (s.includes("costa blanca zuid") || s.includes("costa blanca south")) return { regions: ["costa_blanca_zuid"], places: [] };
  if (s.includes("costa calida") || s.includes("mar menor") || s === "murcia") return { regions: ["costa_calida"], places: [] };
  if (s.includes("costa del sol")) return { regions: ["costa_del_sol"], places: [] };
  if (s.includes("costa brava")) return { regions: ["costa_brava"], places: [] };
  // Alles wat geen bekende costa is (bijv. "Valencia", "Alicante stad") → plaats.
  return { regions: [], places: [String(text).trim()] };
}

const LEGACY_PROPERTY_MAP = {
  appartement: "apartment",
  penthouse: "penthouse",
  villa: "villa",
  townhouse: "townhouse",
  finca: "finca",
  "geschakelde woning": "semi_detached",
};

const LEGACY_BUILD_MAP = {
  nieuwbouw: "new_build",
  "resale / bestaande bouw": "resale",
  "bestaande bouw": "resale",
  "nieuwbouw of resale": "both",
};

const LEGACY_GOAL_MAP = {
  "tweede woning": "second_home",
  vakantiehuis: "holiday_home",
  investering: "investment",
  emigratie: "emigration",
  pensioenmigratie: "emigration",
  "pensioen / langere verblijven": "semi_permanent",
  "combinatie eigen gebruik en verhuur": "second_home",
  "permanente bewoning": "permanent_living",
};

const LEGACY_TIMELINE_MAP = {
  "zo snel mogelijk": "immediate",
  "binnen 3 maanden": "within_3_months",
  "binnen 6 maanden": "3_to_6_months",
  "6 tot 12 maanden": "6_to_12_months",
  "meer dan 12 maanden": "over_12_months",
  orienterend: "unknown",
};

const LEGACY_RENTAL_MAP = {
  "ja, belangrijk": "yes",
  misschien: "maybe",
  "alleen als het goed uitkomt": "maybe",
  nee: "no",
  "nog niet zeker": "unknown",
};

const LEGACY_NEXT_ACTION_MAP = {
  "intake plannen": { type: "schedule_appointment" },
  "intake uitvoeren": { type: "conduct_appointment" },
  "wensen controleren": { type: "complete_search_profile" },
  "woningvoorstellen sturen": { type: "other", label: "Woningvoorstellen sturen" },
  doorgeven: { type: "connect_partner" },
  "wachten op reactie": { type: "follow_up_lead" },
  "later opnieuw benaderen": { type: "follow_up_lead" },
  "geen directe actie": { type: "none" },
};

export function mapLegacyNextAction(text) {
  if (isValidKey(NEXT_ACTION_TYPES, text)) return { type: text, label: "" };
  const hit = LEGACY_NEXT_ACTION_MAP[simplify(text)];
  if (hit) return { type: hit.type, label: hit.label || "" };
  if (text) return { type: "other", label: String(text) };
  return { type: "none", label: "" };
}

const LEGACY_CONTACT_METHOD_MAP = {
  telefoon: "phone",
  whatsapp: "whatsapp",
  "e-mail": "email",
  intakeformulier: "form",
  videocall: "video",
};

/** Tags die vroeger informatie droegen die nu in vaste velden staat. */
const STRUCTURAL_TAGS = {
  investering: { purchaseGoal: "investment" },
  emigratie: { purchaseGoal: "emigration" },
  "tweede woning": { purchaseGoal: "second_home" },
  vakantiehuis: { purchaseGoal: "holiday_home" },
  nieuwbouw: { buildPreference: "new_build" },
  "bestaande bouw": { buildPreference: "resale" },
  verhuurinteresse: { rentalInterest: "maybe" },
  orienterend: { purchaseIntent: "orienting" },
  urgent: { priority: "urgent" },
};

export function isStructuralTag(tag) {
  return Boolean(STRUCTURAL_TAGS[simplify(tag)]);
}

/**
 * Oude budgettekst → { budgetMin, budgetMax }.
 * "Tot € 200.000" → max; "€ 600.000+" → min; "€ 200.000 – € 300.000" → beide.
 */
export function parseLegacyBudget(text) {
  const raw = String(text || "");
  if (!raw.trim()) return { budgetMin: null, budgetMax: null };
  const cleaned = raw.toLowerCase().replace(/(\d)[.\s](?=\d{3}\b)/g, "$1");
  const nums = [];
  const re = /(\d+(?:,\d+)?)\s*(k|mln|miljoen)?/g;
  let m;
  while ((m = re.exec(cleaned))) {
    let n = Number(m[1].replace(",", "."));
    if (m[2] === "k") n *= 1000;
    if (m[2] === "mln" || m[2] === "miljoen") n *= 1000000;
    if (n >= 1000) nums.push(Math.round(n));
  }
  if (!nums.length) return { budgetMin: null, budgetMax: null };
  if (/^\s*(tot|max|maximaal|onder)/.test(cleaned) && nums.length === 1) return { budgetMin: null, budgetMax: nums[0] };
  if (/\+|vanaf|minimaal|boven/.test(cleaned) && nums.length === 1) return { budgetMin: nums[0], budgetMax: null };
  if (nums.length === 1) return { budgetMin: null, budgetMax: nums[0] };
  return { budgetMin: Math.min(...nums), budgetMax: Math.max(...nums) };
}

function mapFromTable(table, value) {
  return table[simplify(value)] || "";
}

/** Oude keuzeveld-waarde incl. "Anders, namelijk..." → { value, otherText } */
function legacyChoice(raw, key) {
  const v = raw[key];
  if (v === ANDERS) return { value: "", otherText: str(raw[`${key}Anders`]) || "Anders" };
  return { value: str(v), otherText: "" };
}

// ─── LEGE LEAD ───────────────────────────────────────────────────────────────
/** Standaardwaarden voor een nieuwe lead. */
export function emptyLead(user) {
  return {
    schemaVersion: SCHEMA_VERSION,
    name: "",
    email: "",
    phone: "",
    preferredContactMethod: "no_preference",
    preferredContactMoment: "no_preference",
    pipelineStage: "new_lead",
    purchaseIntent: "unknown",
    priority: "normal",
    ownerId: user?.id || "",
    ownerName: user?.displayName || "",
    leadSummary: "",
    notities: "",
    nextActionType: "first_contact",
    nextActionLabel: "",
    nextActionDate: todayISO(),
    nextActionAssignedTo: user?.id || "",
    nextActionAssignedToName: user?.displayName || "",
    nextActionNotes: "",
    appointmentDate: "",
    appointmentTime: "",
    appointmentType: "",
    appointmentAssignedTo: "",
    appointmentAssignedToName: "",
    appointmentStatus: "",
    budgetMin: null,
    budgetMax: null,
    regions: [],
    places: [],
    propertyTypes: [],
    buildPreference: "",
    bedroomsMin: null,
    bathroomsMin: null,
    purchaseGoal: "",
    purchaseTimeline: "",
    financingType: "",
    availableEquity: null,
    currentHousingSituation: "",
    visitSpainDate: "",
    visitSpainNotes: "",
    rentalInterest: "",
    requirements: [],
    extraRequirements: "",
    leadSource: "manual",
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    utmContent: "",
    landingPage: "",
    tags: [],
    closureReason: "",
    closureNotes: "",
    pinned: false,
    archived: false,
    // gedenormaliseerd
    lastContactAt: null,
    lastContactMethod: "",
    lastContactAttemptAt: null,
    lastActivityAt: null,
    lastActivityType: "",
    partnerIds: [],
    partnerNames: [],
    partnerStatus: "none",
    partnerSummary: { count: 0, waitingCount: 0, waitingSince: null, nextFollowUpAt: "" },
    openTaskCount: 0,
    nextTaskDueDate: "",
    nextTaskTitle: "",
    fileCount: 0,
    emailNormalized: "",
    phoneNormalized: "",
    _legacy: null,
  };
}

// ─── HOOFDFUNCTIE ────────────────────────────────────────────────────────────
function resolveOwner(raw, users) {
  if (raw.ownerId) {
    const u = users.find((x) => x.id === raw.ownerId);
    return { ownerId: raw.ownerId, ownerName: u?.displayName || str(raw.ownerName) };
  }
  const name = str(raw.ownerName || raw.verantwoordelijke).trim();
  if (!name) return { ownerId: "", ownerName: "" };
  const s = simplify(name);
  const u = users.find((x) => {
    const dn = simplify(x.displayName);
    return dn === s || dn.split(" ")[0] === s.split(" ")[0];
  });
  return { ownerId: u?.id || "", ownerName: u?.displayName || name };
}

function pickKey(options, value, fallback) {
  return isValidKey(options, value) ? value : fallback;
}

function arrayOfKeys(options, arr) {
  return uniq((Array.isArray(arr) ? arr : []).filter((v) => isValidKey(options, v)));
}

/**
 * Zet een ruw Firestore-document (oud of nieuw) om naar een volledig Lead-object.
 * @param {Object} raw  document data + id
 * @param {{users?: Array}} ctx
 * @returns {import("./types").Lead}
 */
export function normalizeLead(raw, ctx = {}) {
  const users = ctx.users || [];
  const base = emptyLead(null);
  const isLegacy = !(Number(raw.schemaVersion) >= SCHEMA_VERSION);
  const unmapped = {};
  const derived = {};

  if (isLegacy) {
    // Tags
    const oldTags = Array.isArray(raw.tags) ? raw.tags : [];
    const structural = oldTags.filter(isStructuralTag);
    const tagHints = structural.reduce((acc, t) => ({ ...acc, ...STRUCTURAL_TAGS[simplify(t)] }), {});

    // Status / leadtype
    derived.pipelineStage = mapLegacyStatus(raw.status);
    if (raw.status && !LEGACY_STATUS_MAP[simplify(raw.status)] && !isValidKey(PIPELINE_STAGES, raw.status)) {
      unmapped.status = raw.status;
    }
    const lt = mapLegacyLeadType(raw.leadscore || raw.leadType);
    derived.purchaseIntent = lt.purchaseIntent;
    derived.priority = lt.priority;
    if (tagHints.priority) derived.priority = tagHints.priority;

    // Bron
    derived.leadSource = mapLegacySource(raw.leadbron);
    if (simplify(raw.leadbron) === "organisch") unmapped.leadSource = raw.leadbron;

    // Regio's en plaatsen
    const regions = [];
    const places = [];
    const regionChoice = legacyChoice(raw, "gewensteRegio");
    [regionChoice.value, raw.regio].forEach((txt) => {
      if (!txt || txt === ANDERS) return;
      const r = mapLegacyRegion(txt);
      regions.push(...r.regions);
      places.push(...r.places);
    });
    if (regionChoice.otherText) {
      regions.push("other");
      unmapped.gewensteRegio = regionChoice.otherText;
    }
    const placeChoice = legacyChoice(raw, "gewenstePlaats");
    if (placeChoice.value && simplify(placeChoice.value) !== "nog niet zeker") {
      places.push(...splitList(placeChoice.value).map((p) => p.replace(/ omgeving$/i, "")));
    }
    if (placeChoice.otherText) places.push(...splitList(placeChoice.otherText));
    derived.regions = uniq(regions);
    derived.places = uniq(places);

    // Woningtype / bouw
    const typeChoice = legacyChoice(raw, "woningtype");
    const pt = LEGACY_PROPERTY_MAP[simplify(typeChoice.value)];
    derived.propertyTypes = pt ? [pt] : typeChoice.otherText ? ["other"] : [];
    if (typeChoice.otherText) unmapped.woningtype = typeChoice.otherText;

    const buildChoice = legacyChoice(raw, "bouwtype");
    derived.buildPreference = mapFromTable(LEGACY_BUILD_MAP, buildChoice.value) || tagHints.buildPreference || "";
    if (buildChoice.otherText) unmapped.bouwtype = buildChoice.otherText;

    // Slaapkamers
    const bedChoice = legacyChoice(raw, "slaapkamers");
    const bed = parseInt(String(bedChoice.value || bedChoice.otherText).replace(/\D/g, ""), 10);
    derived.bedroomsMin = Number.isFinite(bed) ? bed : null;
    if (bedChoice.otherText && !Number.isFinite(bed)) unmapped.slaapkamers = bedChoice.otherText;

    // Budget
    const budgetChoice = legacyChoice(raw, "budget");
    const budget = parseLegacyBudget(budgetChoice.value || budgetChoice.otherText);
    derived.budgetMin = budget.budgetMin;
    derived.budgetMax = budget.budgetMax;
    if (budgetChoice.otherText) unmapped.budget = budgetChoice.otherText;

    // Doel
    const goalChoice = legacyChoice(raw, "doelAankoop");
    const goalText = goalChoice.value || raw.typeKlant;
    derived.purchaseGoal = mapFromTable(LEGACY_GOAL_MAP, goalText) || tagHints.purchaseGoal || (goalChoice.otherText ? "other" : "");
    if (goalChoice.otherText) unmapped.doelAankoop = goalChoice.otherText;
    else if (goalText && !mapFromTable(LEGACY_GOAL_MAP, goalText) && simplify(goalText) !== "nog niet zeker") {
      unmapped.doelAankoop = goalText;
    }

    // Verhuur
    const rentChoice = legacyChoice(raw, "verhuurinteresse");
    derived.rentalInterest = mapFromTable(LEGACY_RENTAL_MAP, rentChoice.value) || tagHints.rentalInterest || "";
    if (simplify(goalText) === "combinatie eigen gebruik en verhuur" && !derived.rentalInterest) derived.rentalInterest = "yes";
    if (rentChoice.otherText) unmapped.verhuurinteresse = rentChoice.otherText;

    // Tijdlijn (+ "Oriënterend" hoort nu bij koopintentie)
    const tlChoice = legacyChoice(raw, "tijdshorizon");
    derived.purchaseTimeline = mapFromTable(LEGACY_TIMELINE_MAP, tlChoice.value) || "";
    if (simplify(tlChoice.value) === "orienterend" || tagHints.purchaseIntent === "orienting") {
      if (derived.purchaseIntent === "unknown") derived.purchaseIntent = "orienting";
    }
    if (tlChoice.otherText) unmapped.tijdshorizon = tlChoice.otherText;

    // Volgende actie
    const na = mapLegacyNextAction(raw.volgendeActie);
    derived.nextActionType = na.type;
    derived.nextActionLabel = na.label;
    const legacyDate = raw.geenStrengeDatum === true ? "" : str(raw.opvolgdatum || raw.volgendActie);
    derived.nextActionDate = /^\d{4}-\d{2}-\d{2}$/.test(legacyDate) ? legacyDate : "";
    if (!raw.volgendeActie && derived.nextActionDate) derived.nextActionType = "follow_up_lead";

    // Laatste contact
    const lc = raw.laatsteContactdatum || raw.laatsteContact;
    derived.lastContactAt = lc ? toDate(lc) : null;
    derived.lastContactMethod = LEGACY_CONTACT_METHOD_MAP[simplify(raw.contactmethode)] || "";

    derived.tags = uniq(oldTags.filter((t) => !isStructuralTag(t)));
    derived.legacyTags = structural;
    derived.leadSummary = str(raw.voortgangsnotitie);
    derived.extraRequirements = str(raw.extraWensen);
  }

  // Samenvoegen: nieuwe velden hebben altijd voorrang op afgeleide legacy waarden.
  const pick = (key) => (raw[key] !== undefined ? raw[key] : derived[key] !== undefined ? derived[key] : base[key]);

  const owner = resolveOwner(raw, users);

  const lead = {
    ...base,
    ...raw,
    id: raw.id,
    name: str(raw.name ?? raw.naam),
    email: str(raw.email),
    phone: str(raw.phone ?? raw.telefoon),
    preferredContactMethod: pickKey(PREFERRED_CONTACT_METHODS, raw.preferredContactMethod, "no_preference"),
    preferredContactMoment: pickKey(PREFERRED_CONTACT_MOMENTS, raw.preferredContactMoment, "no_preference"),
    pipelineStage: pickKey(PIPELINE_STAGES, pick("pipelineStage"), "new_lead"),
    purchaseIntent: pickKey(PURCHASE_INTENTS, pick("purchaseIntent"), "unknown"),
    priority: pickKey(PRIORITIES, pick("priority"), "normal"),
    ownerId: owner.ownerId,
    ownerName: owner.ownerName,
    leadSummary: str(pick("leadSummary")),
    notities: str(raw.notities),
    nextActionType: pickKey(NEXT_ACTION_TYPES, pick("nextActionType"), "none"),
    nextActionLabel: str(pick("nextActionLabel")),
    nextActionDate: str(pick("nextActionDate")),
    nextActionAssignedTo: str(raw.nextActionAssignedTo),
    nextActionAssignedToName: str(raw.nextActionAssignedToName),
    nextActionNotes: str(raw.nextActionNotes),
    appointmentDate: str(raw.appointmentDate),
    appointmentTime: str(raw.appointmentTime),
    appointmentType: pickKey(APPOINTMENT_TYPES, raw.appointmentType, ""),
    appointmentAssignedTo: str(raw.appointmentAssignedTo),
    appointmentAssignedToName: str(raw.appointmentAssignedToName),
    appointmentStatus: pickKey(APPOINTMENT_STATUSES, raw.appointmentStatus, ""),
    budgetMin: numOrNull(pick("budgetMin")),
    budgetMax: numOrNull(pick("budgetMax")),
    regions: arrayOfKeys(REGIONS, pick("regions")),
    places: uniq((Array.isArray(pick("places")) ? pick("places") : []).map((p) => str(p).trim())),
    propertyTypes: arrayOfKeys(PROPERTY_TYPES, pick("propertyTypes")),
    buildPreference: pickKey(BUILD_PREFERENCES, pick("buildPreference"), ""),
    bedroomsMin: numOrNull(pick("bedroomsMin")),
    bathroomsMin: numOrNull(pick("bathroomsMin")),
    purchaseGoal: pickKey(PURCHASE_GOALS, pick("purchaseGoal"), ""),
    purchaseTimeline: pickKey(PURCHASE_TIMELINES, pick("purchaseTimeline"), ""),
    financingType: pickKey(FINANCING_TYPES, raw.financingType, ""),
    availableEquity: numOrNull(raw.availableEquity),
    currentHousingSituation: pickKey(HOUSING_SITUATIONS, raw.currentHousingSituation, ""),
    visitSpainDate: str(raw.visitSpainDate),
    visitSpainNotes: str(raw.visitSpainNotes),
    rentalInterest: pickKey(RENTAL_INTEREST, pick("rentalInterest"), ""),
    requirements: arrayOfKeys(REQUIREMENTS, raw.requirements),
    extraRequirements: str(pick("extraRequirements")),
    leadSource: pickKey(LEAD_SOURCES, pick("leadSource"), "other"),
    // "tags" bestaat in het oude én nieuwe schema. Bij oude docs gebruiken we de
    // opgeschoonde lijst (zonder structurele tags); het origineel blijft in Firestore staan.
    tags: uniq((isLegacy ? derived.tags || [] : Array.isArray(raw.tags) ? raw.tags : []).map((t) => str(t).trim())),
    closureReason: pickKey(CLOSURE_REASONS, raw.closureReason, ""),
    closureNotes: str(raw.closureNotes),
    pinned: Boolean(raw.pinned),
    archived: Boolean(raw.archived),
    lastContactAt: raw.lastContactAt || derived.lastContactAt || null,
    lastContactMethod: pickKey(CONTACT_METHODS, pick("lastContactMethod"), ""),
    lastActivityAt: raw.lastActivityAt || null,
    partnerIds: Array.isArray(raw.partnerIds) ? raw.partnerIds : [],
    partnerNames: Array.isArray(raw.partnerNames) ? raw.partnerNames : [],
    partnerStatus: pickKey(PARTNER_LINK_STATUSES, raw.partnerStatus, "none"),
    partnerSummary: { ...base.partnerSummary, ...(raw.partnerSummary || {}) },
    openTaskCount: Number(raw.openTaskCount) || 0,
    fileCount: Number(raw.fileCount) || 0,
    legacyTags: Array.isArray(raw.legacyTags) ? raw.legacyTags : derived.legacyTags || [],
  };

  // Nieuwe schema-docs: niets meer afleiden, schema staat vast.
  lead.schemaVersion = isLegacy ? Number(raw.schemaVersion) || 1 : Number(raw.schemaVersion);
  lead.emailNormalized = normalizeEmail(lead.email);
  lead.phoneNormalized = normalizePhone(lead.phone);

  const legacyInfo = isLegacy
    ? {
        status: raw.status || "",
        leadType: raw.leadscore || "",
        source: raw.leadbron || "",
        startdatum: raw.startdatum || "",
        tags: derived.legacyTags || [],
        unmapped,
      }
    : raw.legacyInfo || null;
  lead._legacy = legacyInfo;
  lead._isLegacy = isLegacy;
  return lead;
}

/** Aanmaakdatum voor sortering/signalen: createdAt, anders oude startdatum. */
export function getCreatedDate(lead) {
  return toDate(lead.createdAt) || toDate(lead.startdatum) || null;
}

// ─── OPSLAAN ─────────────────────────────────────────────────────────────────
/** Maakt een schoon object met alleen de formuliervelden, klaar voor Firestore. */
export function buildLeadPayload(lead) {
  const out = {};
  FORM_FIELDS.forEach((key) => {
    let v = lead[key];
    if (ARRAY_FIELDS.includes(key)) v = uniq(Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.trim() : x)) : []);
    else if (NUMBER_FIELDS.includes(key)) v = numOrNull(v);
    else if (key === "pinned") v = Boolean(v);
    else v = typeof v === "string" ? v.trim() : v === undefined || v === null ? "" : v;
    out[key] = v;
  });
  if (out.nextActionType === "none" || !out.nextActionType) {
    out.nextActionType = "none";
    out.nextActionDate = "";
    out.nextActionLabel = "";
  }
  if (out.nextActionType !== "other") out.nextActionLabel = "";
  out.emailNormalized = normalizeEmail(out.email);
  out.phoneNormalized = normalizePhone(out.phone);
  out.schemaVersion = SCHEMA_VERSION;
  return out;
}

/**
 * Extra velden die we bij de eerste keer opslaan van een OUDE lead meeschrijven,
 * zodat afgeleide waarden bewaard blijven. Oude velden worden niet verwijderd.
 */
export function buildMigrationFields(lead) {
  if (!lead._isLegacy) return {};
  const out = {
    legacyInfo: lead._legacy || null,
    legacyTags: lead.legacyTags || [],
    migratedAt: new Date(),
  };
  if (lead.lastContactAt) out.lastContactAt = toDate(lead.lastContactAt);
  if (lead.lastContactMethod) out.lastContactMethod = lead.lastContactMethod;
  if (!lead.createdAt) {
    const created = getCreatedDate(lead);
    if (created) {
      out.createdAt = created;
      out.createdAtSource = "legacy_startdatum";
    }
  }
  return out;
}
