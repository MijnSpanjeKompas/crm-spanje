// ─── CENTRALE CRM-CONFIGURATIE ───────────────────────────────────────────────
// Alle interne keys zijn stabiel (worden opgeslagen in Firestore).
// Labels mogen vrij aangepast worden zonder data te breken.

export const SCHEMA_VERSION = 2;

/** Hulpfunctie: label ophalen bij een key. */
export function labelOf(options, value, fallback = "–") {
  if (value === undefined || value === null || value === "") return fallback;
  const hit = options.find((o) => o.value === value);
  return hit ? hit.label : String(value);
}

export function optionOf(options, value) {
  return options.find((o) => o.value === value) || null;
}

// ─── PIPELINE ────────────────────────────────────────────────────────────────
export const PIPELINE_STAGES = [
  { value: "new_lead", label: "Nieuwe lead", group: "main", color: "#33506b", bg: "#edf1f5" },
  { value: "contact_phase", label: "Contactfase", group: "main", color: "#3a6788", bg: "#eaf1f6" },
  { value: "appointment_scheduled", label: "Kennismaking gepland", group: "main", color: "#2f6f82", bg: "#e8f2f4" },
  { value: "appointment_completed", label: "Kennismaking gehad", group: "main", color: "#2e7268", bg: "#e7f2ef" },
  { value: "qualified", label: "Gekwalificeerd", group: "main", color: "#2f7a55", bg: "#eaf4ee" },
  { value: "partner_connected", label: "Gekoppeld aan partner", group: "main", color: "#85663a", bg: "#f4ede2" },
  { value: "active_search", label: "Actief zoektraject", group: "main", color: "#2f5e86", bg: "#e6eef6" },
  { value: "purchase_process", label: "Aankooptraject", group: "main", color: "#8c6010", bg: "#fbefd2" },
  { value: "completed", label: "Afgerond / woning gekocht", group: "main", closed: true, color: "#4e5d6c", bg: "#eef0f2" },
  { value: "follow_up_later", label: "Later opvolgen", group: "side", color: "#97581a", bg: "#fbefe3" },
  { value: "unreachable", label: "Niet bereikbaar", group: "side", color: "#a0522d", bg: "#f8ece4" },
  { value: "disqualified", label: "Niet gekwalificeerd", group: "side", closed: true, color: "#636d78", bg: "#f3f2ef" },
  { value: "stopped", label: "Gestopt", group: "side", closed: true, color: "#9b4a43", bg: "#f6eae8" },
];

export const CLOSED_STAGES = PIPELINE_STAGES.filter((s) => s.closed).map((s) => s.value);
export const STAGES_REQUIRING_CLOSURE_REASON = ["stopped", "disqualified"];
/** Fases waarin een lead altijd een volgende actie hoort te hebben. */
export const STAGES_REQUIRING_NEXT_ACTION = [
  "new_lead",
  "contact_phase",
  "appointment_scheduled",
  "appointment_completed",
  "qualified",
  "partner_connected",
  "active_search",
  "purchase_process",
  "follow_up_later",
];
/** Vanaf deze fases verwachten we een ingevuld zoekprofiel. */
export const STAGES_REQUIRING_SEARCH_PROFILE = [
  "qualified",
  "partner_connected",
  "active_search",
  "purchase_process",
];

export function isClosedStage(stage) {
  return CLOSED_STAGES.includes(stage);
}

// ─── KWALIFICATIE ────────────────────────────────────────────────────────────
export const PURCHASE_INTENTS = [
  { value: "unknown", label: "Nog onbekend", color: "#636d78", bg: "#f3f2ef", rank: 0 },
  { value: "orienting", label: "Oriënterend", color: "#3a6788", bg: "#eaf1f6", rank: 1 },
  { value: "serious_orientation", label: "Serieus oriënterend", color: "#33506b", bg: "#edf1f5", rank: 2 },
  { value: "concrete_plans", label: "Concrete koopplannen", color: "#8c6010", bg: "#fbefd2", rank: 3 },
  { value: "ready_to_buy", label: "Koopklaar", color: "#2f7a55", bg: "#eaf4ee", rank: 4 },
];

export const PRIORITIES = [
  { value: "low", label: "Laag", color: "#636d78", bg: "#f3f2ef", rank: 0 },
  { value: "normal", label: "Normaal", color: "#3a6788", bg: "#eaf1f6", rank: 1 },
  { value: "high", label: "Hoog", color: "#97581a", bg: "#fbefe3", rank: 2 },
  { value: "urgent", label: "Urgent", color: "#b3453a", bg: "#fbedeb", rank: 3 },
];

// ─── VOLGENDE ACTIE ──────────────────────────────────────────────────────────
export const NEXT_ACTION_TYPES = [
  { value: "first_contact", label: "Eerste contact opnemen" },
  { value: "call_back", label: "Terugbellen" },
  { value: "send_whatsapp", label: "WhatsApp sturen" },
  { value: "send_email", label: "E-mail sturen" },
  { value: "schedule_appointment", label: "Kennismaking inplannen" },
  { value: "conduct_appointment", label: "Kennismaking uitvoeren" },
  { value: "complete_search_profile", label: "Zoekprofiel aanvullen" },
  { value: "select_partner", label: "Partner selecteren" },
  { value: "connect_partner", label: "Koppelen aan partner" },
  { value: "follow_up_partner", label: "Partner opvolgen" },
  { value: "follow_up_lead", label: "Lead opvolgen" },
  { value: "follow_up_spain_visit", label: "Bezoek Spanje opvolgen" },
  { value: "request_document", label: "Document opvragen" },
  { value: "other", label: "Anders" },
  { value: "none", label: "Geen actie gepland" },
];

export function hasNextAction(lead) {
  return Boolean(lead?.nextActionType) && lead.nextActionType !== "none";
}

export function nextActionText(lead) {
  if (!hasNextAction(lead)) return "Geen actie gepland";
  if (lead.nextActionType === "other" && lead.nextActionLabel) return lead.nextActionLabel;
  return labelOf(NEXT_ACTION_TYPES, lead.nextActionType);
}

// ─── ACTIVITEITEN ────────────────────────────────────────────────────────────
// customerContact = telt mee voor lastContactAt
export const ACTIVITY_TYPES = [
  { value: "phone_call", label: "Telefoongesprek", customerContact: true, contactMethod: "phone", icon: "phone" },
  { value: "whatsapp", label: "WhatsApp", customerContact: true, contactMethod: "whatsapp", icon: "chat" },
  { value: "email", label: "E-mail", customerContact: true, contactMethod: "email", icon: "mail" },
  { value: "appointment", label: "Kennismaking", customerContact: true, contactMethod: "appointment", icon: "calendar" },
  { value: "note", label: "Notitie", icon: "edit" },
  { value: "partner_contact", label: "Partnercontact", icon: "users" },
  { value: "document", label: "Document", icon: "file" },
  { value: "viewing", label: "Bezichtiging", icon: "home" },
  { value: "other", label: "Anders", icon: "dot" },
  { value: "system", label: "Systeem", system: true, icon: "cog" },
];

/** Typen die een gebruiker handmatig kan kiezen (systeem niet). */
export const MANUAL_ACTIVITY_TYPES = ACTIVITY_TYPES.filter((t) => !t.system);

export function isCustomerContactType(type) {
  return Boolean(optionOf(ACTIVITY_TYPES, type)?.customerContact);
}

export const CONTACT_OUTCOMES = [
  { value: "spoken", label: "Gesproken", success: true },
  { value: "no_answer", label: "Geen gehoor" },
  { value: "callback_agreed", label: "Terugbellen afgesproken", success: true },
  { value: "voicemail", label: "Voicemail" },
  { value: "invalid_number", label: "Nummer onjuist" },
  { value: "no_interest", label: "Geen interesse", success: true },
  { value: "other", label: "Anders", success: true },
];

/** Een contactpoging zonder echt contact telt niet als 'laatste contact'. */
export function isSuccessfulContact(type, outcome) {
  if (!isCustomerContactType(type)) return false;
  if (!outcome) return true;
  return Boolean(optionOf(CONTACT_OUTCOMES, outcome)?.success);
}

export const CONTACT_METHODS = [
  { value: "phone", label: "Telefoon" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "appointment", label: "Kennismaking" },
  { value: "video", label: "Videocall" },
  { value: "form", label: "Formulier" },
];

export const PREFERRED_CONTACT_METHODS = [
  { value: "phone", label: "Telefoon" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "no_preference", label: "Geen voorkeur" },
];

export const PREFERRED_CONTACT_MOMENTS = [
  { value: "morning", label: "Ochtend" },
  { value: "afternoon", label: "Middag" },
  { value: "evening", label: "Avond" },
  { value: "no_preference", label: "Geen voorkeur" },
];

// ─── AFSPRAKEN ───────────────────────────────────────────────────────────────
export const APPOINTMENT_TYPES = [
  { value: "phone", label: "Telefonisch" },
  { value: "video", label: "Videocall" },
  { value: "in_person", label: "Fysiek" },
  { value: "other", label: "Anders" },
];

export const APPOINTMENT_STATUSES = [
  { value: "scheduled", label: "Gepland" },
  { value: "completed", label: "Afgerond" },
  { value: "cancelled", label: "Geannuleerd" },
  { value: "no_show", label: "Niet verschenen" },
];

// ─── TAKEN ───────────────────────────────────────────────────────────────────
export const TASK_STATUSES = [
  { value: "open", label: "Open" },
  { value: "completed", label: "Afgerond" },
  { value: "cancelled", label: "Geannuleerd" },
];

// ─── AFSLUITEN ───────────────────────────────────────────────────────────────
export const CLOSURE_REASONS = [
  { value: "insufficient_budget", label: "Budget onvoldoende" },
  { value: "outside_service_area", label: "Regio buiten werkgebied" },
  { value: "plans_postponed", label: "Koopplannen uitgesteld" },
  { value: "house_not_sold", label: "Eigen woning nog niet verkocht" },
  { value: "no_response", label: "Geen reactie" },
  { value: "chose_other_party", label: "Andere partij gekozen" },
  { value: "no_longer_interested", label: "Geen interesse meer" },
  { value: "financing_not_possible", label: "Financiering niet mogelijk" },
  { value: "not_qualified", label: "Niet gekwalificeerd" },
  { value: "other", label: "Anders" },
];

// ─── BRON ────────────────────────────────────────────────────────────────────
export const LEAD_SOURCES = [
  { value: "website_questionnaire", label: "Website – vragenlijst" },
  { value: "website_calculator", label: "Website – rekentool" },
  { value: "website_contact", label: "Website – contactformulier" },
  { value: "website_buyers_guide", label: "Website – koopgids" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "facebook_organic", label: "Facebook (organisch)" },
  { value: "instagram_organic", label: "Instagram (organisch)" },
  { value: "tiktok", label: "TikTok" },
  { value: "google_organic", label: "Google (organisch)" },
  { value: "google_ads", label: "Google Ads" },
  { value: "fair", label: "Beurs" },
  { value: "referral", label: "Via-via / doorverwijzing" },
  { value: "partner", label: "Partner" },
  { value: "manual", label: "Handmatig toegevoegd" },
  { value: "other", label: "Anders" },
];

// ─── ZOEKPROFIEL ─────────────────────────────────────────────────────────────
export const REGIONS = [
  { value: "costa_blanca_noord", label: "Costa Blanca Noord" },
  { value: "costa_blanca_zuid", label: "Costa Blanca Zuid" },
  { value: "costa_calida", label: "Costa Cálida" },
  { value: "costa_del_sol", label: "Costa del Sol" },
  { value: "costa_brava", label: "Costa Brava" },
  { value: "other", label: "Overig" },
  { value: "unknown", label: "Nog onbekend" },
];

/** Suggesties voor plaatsen (vrije invoer blijft mogelijk). */
export const PLACE_SUGGESTIONS = [
  "Torrevieja",
  "Guardamar del Segura",
  "Rojales",
  "Ciudad Quesada",
  "Orihuela Costa",
  "Pilar de la Horadada",
  "Alicante",
  "Jávea",
  "Altea",
  "Moraira",
  "Calpe",
  "Dénia",
  "San Pedro del Pinatar",
  "Los Alcázares",
  "San Javier",
  "Málaga",
  "Marbella",
];

export const PROPERTY_TYPES = [
  { value: "apartment", label: "Appartement" },
  { value: "penthouse", label: "Penthouse" },
  { value: "townhouse", label: "Rijwoning / townhouse" },
  { value: "semi_detached", label: "Geschakelde woning" },
  { value: "villa", label: "Villa" },
  { value: "finca", label: "Finca" },
  { value: "other", label: "Anders" },
];

export const BUILD_PREFERENCES = [
  { value: "new_build", label: "Nieuwbouw" },
  { value: "resale", label: "Bestaande bouw" },
  { value: "both", label: "Beide mogelijk" },
  { value: "no_preference", label: "Geen voorkeur" },
];

export const PURCHASE_GOALS = [
  { value: "emigration", label: "Emigratie" },
  { value: "permanent_living", label: "Permanent wonen" },
  { value: "semi_permanent", label: "Semi-permanent wonen" },
  { value: "second_home", label: "Tweede woning" },
  { value: "holiday_home", label: "Vakantiehuis" },
  { value: "investment", label: "Investering" },
  { value: "rental", label: "Verhuur" },
  { value: "other", label: "Anders" },
];

export const PURCHASE_TIMELINES = [
  { value: "immediate", label: "Direct / zodra passend aanbod", rank: 0 },
  { value: "within_3_months", label: "Binnen 3 maanden", rank: 1 },
  { value: "3_to_6_months", label: "3–6 maanden", rank: 2 },
  { value: "6_to_12_months", label: "6–12 maanden", rank: 3 },
  { value: "over_12_months", label: "12+ maanden", rank: 4 },
  { value: "unknown", label: "Nog onbekend", rank: 9 },
];

export const FINANCING_TYPES = [
  { value: "own_funds", label: "Eigen middelen" },
  { value: "mortgage", label: "Hypotheek nodig" },
  { value: "combination", label: "Combinatie" },
  { value: "unknown", label: "Nog onbekend" },
];

export const HOUSING_SITUATIONS = [
  { value: "house_needs_to_be_sold", label: "Woning moet nog verkocht worden" },
  { value: "house_sold", label: "Woning reeds verkocht" },
  { value: "renting", label: "Huurwoning" },
  { value: "financing_arranged", label: "Financiering geregeld" },
  { value: "not_applicable", label: "Niet van toepassing" },
  { value: "unknown", label: "Nog onbekend" },
  { value: "other", label: "Anders" },
];

export const RENTAL_INTEREST = [
  { value: "yes", label: "Ja, belangrijk" },
  { value: "maybe", label: "Misschien" },
  { value: "no", label: "Nee" },
  { value: "unknown", label: "Nog onbekend" },
];

export const REQUIREMENTS = [
  { value: "private_pool", label: "Privézwembad" },
  { value: "communal_pool", label: "Gemeenschappelijk zwembad" },
  { value: "near_sea", label: "Dicht bij zee" },
  { value: "near_amenities", label: "Dicht bij voorzieningen" },
  { value: "quiet_location", label: "Rustige ligging" },
  { value: "golf_nearby", label: "Golf in de buurt" },
  { value: "single_level", label: "Gelijkvloers" },
  { value: "elevator", label: "Lift" },
  { value: "outdoor_space", label: "Buitenruimte / terras" },
  { value: "parking", label: "Parkeerplaats" },
  { value: "view", label: "Uitzicht" },
  { value: "large_plot", label: "Groot perceel" },
  { value: "permanent_living_suitable", label: "Geschikt voor permanent wonen" },
];

/** Tags zijn alleen aanvullende labels. Dit zijn suggesties; eigen tags mogen ook. */
export const TAG_SUGGESTIONS = [
  "Beurslead",
  "Terugkerende lead",
  "Familie in Spanje",
  "VIP",
  "Bijzondere situatie",
];

// ─── PARTNERS ────────────────────────────────────────────────────────────────
export const PARTNER_TYPES = [
  { value: "realtor", label: "Makelaar" },
  { value: "lawyer", label: "Advocaat" },
  { value: "mortgage_advisor", label: "Hypotheekadviseur" },
  { value: "insurance", label: "Verzekering" },
  { value: "gestor", label: "Gestor" },
  { value: "other", label: "Overig" },
];

// order = hoe "ver" een koppeling is (voor samenvatting op lead)
export const PARTNER_LINK_STATUSES = [
  { value: "not_sent", label: "Nog niet verstuurd", order: 1, color: "#636d78", bg: "#f3f2ef" },
  { value: "sent", label: "Verstuurd", order: 2, waiting: true, color: "#3a6788", bg: "#eaf1f6" },
  { value: "received", label: "Ontvangen", order: 3, waiting: true, color: "#33506b", bg: "#edf1f5" },
  { value: "contacted", label: "Contact opgenomen", order: 4, waiting: true, color: "#8c6010", bg: "#fbefd2" },
  { value: "active", label: "Actief", order: 5, color: "#2f7a55", bg: "#eaf4ee" },
  { value: "completed", label: "Afgerond", order: 6, color: "#4e5d6c", bg: "#eef0f2" },
  { value: "no_match", label: "Geen match", order: 0, color: "#9b4a43", bg: "#f6eae8" },
];

/** Statussen waarbij we op terugkoppeling van de partner wachten. */
export const PARTNER_WAITING_STATUSES = PARTNER_LINK_STATUSES.filter((s) => s.waiting).map((s) => s.value);

// ─── BESTANDEN ───────────────────────────────────────────────────────────────
export const FILE_CATEGORIES = [
  { value: "lead_summary", label: "Leadsamenvatting" },
  { value: "search_profile", label: "Zoekprofiel" },
  { value: "identification", label: "Identificatie/documentatie" },
  { value: "financing", label: "Financiering" },
  { value: "property", label: "Woning" },
  { value: "partner", label: "Partner" },
  { value: "contract", label: "Contract/document" },
  { value: "other", label: "Overig" },
];

export const MAX_FILE_SIZE_MB = 15;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Extensie → MIME. Browsers geven bij .doc soms een lege type door, daarom op extensie. */
export const ALLOWED_FILE_TYPES = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const FILE_ACCEPT_ATTR = Object.keys(ALLOWED_FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(",");

// ─── GEBRUIKERS ──────────────────────────────────────────────────────────────
export const USER_ROLES = [
  { value: "admin", label: "Beheerder" },
  { value: "member", label: "Medewerker" },
];

// ─── DREMPELWAARDEN (dashboard-signalen) ─────────────────────────────────────
// Eén plek, zodat je dit later makkelijk kunt tunen.
export const THRESHOLDS = {
  /** Nieuwe lead zonder klantcontact na zoveel uur → aandacht nodig. */
  NEW_LEAD_NO_CONTACT_HOURS: 24,
  /** Open lead zonder enige activiteit na zoveel dagen → aandacht nodig. */
  INACTIVITY_DAYS: 14,
  /** Partnerkoppeling in afwachting zonder opvolging na zoveel dagen → aandacht nodig. */
  PARTNER_FOLLOW_UP_DAYS: 7,
  /** "Binnenkort" = binnen zoveel dagen. */
  UPCOMING_DAYS: 7,
};
