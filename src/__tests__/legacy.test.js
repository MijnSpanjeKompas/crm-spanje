import {
  normalizeLead,
  mapLegacyStatus,
  mapLegacyLeadType,
  mapLegacySource,
  mapLegacyRegion,
  mapLegacyNextAction,
  parseLegacyBudget,
  buildLeadPayload,
  buildMigrationFields,
  findDuplicateLeads,
  normalizePhone,
  normalizeEmail,
  emptyLead,
} from "../crm/normalize";
import { validateLead } from "../crm/validation";
import { getLeadSignals, computeKpis, getTodayItems } from "../crm/signals";
import { applyFilters, DEFAULT_FILTERS } from "../crm/filters";
import { describeLeadChanges } from "../crm/changes";
import { todayISO, addDaysISO } from "../crm/dates";

const USERS = [
  { id: "uLuke", displayName: "Luke van Spronsen", role: "admin", active: true },
  { id: "uIndy", displayName: "Indy Klijn", role: "admin", active: true },
];

// Records zoals ze in de huidige productie-CRM staan (zie screenshots).
const EWOUD = {
  id: "ewoud",
  naam: "Ewoud Kremer",
  telefoon: "06 12345678",
  email: "Ewoud@Example.nl ",
  regio: "",
  status: "Doorgegeven",
  startdatum: "2026-09-10",
  leadbron: "Meta Ads",
  leadscore: "Hot lead",
  volgendeActie: "Doorgeven",
  opvolgdatum: "",
  geenStrengeDatum: true,
  laatsteContactdatum: "2026-09-12",
  contactmethode: "Telefonisch",
  tags: ["Emigratie"],
  budget: "Anders, namelijk...",
  budgetAnders: "rond de 350k",
  doelAankoop: "Emigratie",
  pinned: false,
  voortgangsnotitie: "",
};
const AYAD = {
  id: "ayad",
  naam: "Ayad al Sakkal",
  email: "ayad@example.com",
  status: "Doorgegeven",
  leadbron: "Meta Ads",
  leadscore: "Lauwe lead",
  volgendeActie: "Later opnieuw benaderen",
  geenStrengeDatum: true,
  tags: ["Vakantiehuis"],
  doelAankoop: "Vakantiehuis",
};
const WILLIAM = {
  id: "william",
  naam: "William de Wit",
  telefoon: "+31 6 87654321",
  regio: "Costa Calida",
  status: "Niet doorgegaan",
  leadbron: "Meta Ads",
  leadscore: "Koude lead",
  volgendeActie: "Geen directe actie",
  geenStrengeDatum: true,
  budget: "Tot € 200.000",
  doelAankoop: "Emigratie",
  tags: [],
};
const HEERSCHAP = {
  id: "heerschap",
  naam: "Ed en Norma Heerschap",
  email: "heerschap@example.nl",
  regio: "Valencia",
  status: "Doorgegeven",
  leadbron: "Website",
  leadscore: "Warm lead",
  volgendeActie: "Later opnieuw benaderen",
  opvolgdatum: "2026-10-01",
  geenStrengeDatum: false,
  budget: "€ 200.000 – € 300.000",
  doelAankoop: "Emigratie",
  gewensteRegio: "Costa Blanca Zuid",
  gewenstePlaats: "Torrevieja, Guardamar",
  woningtype: "Villa",
  bouwtype: "Nieuwbouw of resale",
  tijdshorizon: "Oriënterend",
  tags: ["Urgent", "Beurslead"],
};

describe("legacy mapping-functies", () => {
  test("statussen", () => {
    expect(mapLegacyStatus("Nieuwe lead")).toBe("new_lead");
    expect(mapLegacyStatus("Intake gepland")).toBe("appointment_scheduled");
    expect(mapLegacyStatus("Doorgegeven")).toBe("partner_connected");
    expect(mapLegacyStatus("Afgerond")).toBe("completed");
    expect(mapLegacyStatus("Niet doorgegaan")).toBe("stopped");
    expect(mapLegacyStatus("iets raars")).toBe("new_lead");
    expect(mapLegacyStatus(undefined)).toBe("new_lead");
  });

  test("leadtype → koopintentie + prioriteit", () => {
    expect(mapLegacyLeadType("Hot lead")).toEqual({ purchaseIntent: "concrete_plans", priority: "high" });
    expect(mapLegacyLeadType("Warm lead")).toEqual({ purchaseIntent: "unknown", priority: "normal" });
    expect(mapLegacyLeadType("Lauwe lead")).toEqual({ purchaseIntent: "orienting", priority: "normal" });
    expect(mapLegacyLeadType("Koude lead")).toEqual({ purchaseIntent: "orienting", priority: "low" });
    expect(mapLegacyLeadType("")).toEqual({ purchaseIntent: "unknown", priority: "normal" });
  });

  test("bronnen", () => {
    expect(mapLegacySource("Website")).toBe("website_questionnaire");
    expect(mapLegacySource("Meta Ads")).toBe("meta_ads");
    expect(mapLegacySource("Via-via")).toBe("referral");
    expect(mapLegacySource("Organisch")).toBe("other");
  });

  test("regio's", () => {
    expect(mapLegacyRegion("Costa Calida").regions).toContain("costa_calida");
    expect(mapLegacyRegion("Costa Blanca Zuid").regions).toContain("costa_blanca_zuid");
    expect(mapLegacyRegion("Valencia").places).toContain("Valencia");
  });

  test("volgende actie", () => {
    expect(mapLegacyNextAction("Intake plannen").type).toBe("schedule_appointment");
    expect(mapLegacyNextAction("Doorgeven").type).toBe("connect_partner");
    expect(mapLegacyNextAction("Geen directe actie").type).toBe("none");
  });

  test("budget", () => {
    expect(parseLegacyBudget("Tot € 200.000")).toMatchObject({ budgetMin: null, budgetMax: 200000 });
    expect(parseLegacyBudget("€ 200.000 – € 300.000")).toMatchObject({ budgetMin: 200000, budgetMax: 300000 });
    expect(parseLegacyBudget("€ 600.000+")).toMatchObject({ budgetMin: 600000, budgetMax: null });
  });
});

describe("normalizeLead op echte oude records", () => {
  test("Ewoud Kremer (Doorgegeven, Hot lead, geen strenge datum)", () => {
    const l = normalizeLead(EWOUD, { users: USERS });
    expect(l._isLegacy).toBe(true);
    expect(l.name).toBe("Ewoud Kremer");
    expect(l.phone).toBe("06 12345678");
    expect(l.pipelineStage).toBe("partner_connected");
    expect(l.purchaseIntent).toBe("concrete_plans");
    expect(l.priority).toBe("high");
    expect(l.leadSource).toBe("meta_ads");
    expect(l.purchaseGoal).toBe("emigration");
    expect(l.tags).toEqual([]); // "Emigratie" is geen tag meer…
    expect(l.legacyTags).toEqual(["Emigratie"]); // …maar blijft bewaard
    expect(l.nextActionType).toBe("connect_partner");
    expect(l.nextActionDate).toBe(""); // geen strenge datum → datum ontbreekt
    expect(l.lastContactAt).toBeTruthy();
    expect(l._legacy.status).toBe("Doorgegeven");
    expect(l._legacy.leadType).toBe("Hot lead");
    // Oude velden blijven aanwezig op het object
    expect(l.naam).toBe("Ewoud Kremer");
    expect(l.leadscore).toBe("Hot lead");
    const signals = getLeadSignals(l).map((s) => s.key);
    expect(signals.length).toBeGreaterThan(0);
  });

  test("William de Wit (Niet doorgegaan → gestopt, reden ontbreekt)", () => {
    const l = normalizeLead(WILLIAM, { users: USERS });
    expect(l.pipelineStage).toBe("stopped");
    expect(l.priority).toBe("low");
    expect(l.regions).toContain("costa_calida");
    expect(l.budgetMax).toBe(200000);
    expect(l.nextActionType).toBe("none");
    const v = validateLead(l);
    expect(v.errors.closureReason).toBeTruthy();
  });

  test("Heerschap (Warm lead, Valencia, datum, structurele tags)", () => {
    const l = normalizeLead(HEERSCHAP, { users: USERS });
    expect(l.purchaseIntent).toBe("orienting"); // tijdshorizon "Oriënterend" → intentie
    expect(l.purchaseTimeline).not.toBe("orienting");
    expect(l.priority).toBe("urgent"); // tag Urgent
    expect(l.tags).toEqual(["Beurslead"]);
    expect(l.regions).toContain("costa_blanca_zuid");
    expect(l.places).toEqual(expect.arrayContaining(["Valencia", "Torrevieja", "Guardamar"]));
    expect(l.propertyTypes).toContain("villa");
    expect(l.buildPreference).toBe("both");
    expect(l.budgetMin).toBe(200000);
    expect(l.budgetMax).toBe(300000);
    expect(l.nextActionType).toBe("follow_up_lead");
    expect(l.nextActionDate).toBe("2026-10-01");
    expect(l.leadSource).toBe("website_questionnaire");
  });

  test("Ayad (Lauwe lead + Vakantiehuis)", () => {
    const l = normalizeLead(AYAD);
    expect(l.purchaseIntent).toBe("orienting");
    expect(l.purchaseGoal).toBe("holiday_home");
    expect(l.email).toBe("ayad@example.com");
  });

  test("nieuwe velden hebben voorrang, schema v2 wordt niet opnieuw afgeleid", () => {
    const l = normalizeLead({ ...EWOUD, schemaVersion: 2, pipelineStage: "active_search", purchaseIntent: "ready_to_buy", priority: "normal", name: "Ewoud K." });
    expect(l._isLegacy).toBe(false);
    expect(l.pipelineStage).toBe("active_search");
    expect(l.purchaseIntent).toBe("ready_to_buy");
    expect(l.name).toBe("Ewoud K.");
  });

  test("verantwoordelijke-naam wordt aan user gekoppeld", () => {
    const l = normalizeLead({ ...AYAD, verantwoordelijke: "Indy" }, { users: USERS });
    expect(l.ownerId).toBe("uIndy");
  });

  test("migratievelden bewaren oude info en startdatum als createdAt", () => {
    const l = normalizeLead(EWOUD, { users: USERS });
    const m = buildMigrationFields(l);
    expect(m.legacyInfo.status).toBe("Doorgegeven");
    expect(m.legacyTags).toEqual(["Emigratie"]);
    expect(m.createdAtSource).toBe("legacy_startdatum");
    const payload = buildLeadPayload(l);
    // Payload bevat alleen nieuwe velden – oude velden worden niet overschreven/verwijderd
    expect(payload.naam).toBeUndefined();
    expect(payload.status).toBeUndefined();
    Object.values(payload).forEach((v) => expect(v).not.toBeUndefined());
  });
});

describe("duplicaten", () => {
  const leads = [normalizeLead(EWOUD), normalizeLead(WILLIAM)];
  test("normalisatie", () => {
    expect(normalizeEmail(" Ewoud@Example.NL")).toBe("ewoud@example.nl");
    expect(normalizePhone("+31 6 87654321")).toBe(normalizePhone("06-87654321"));
  });
  test("vindt op e-mail en telefoon", () => {
    expect(findDuplicateLeads(leads, { email: "ewoud@example.nl" }).map((l) => l.id)).toEqual(["ewoud"]);
    expect(findDuplicateLeads(leads, { phone: "0687654321" }).map((l) => l.id)).toEqual(["william"]);
    expect(findDuplicateLeads(leads, { email: "nieuw@x.nl", phone: "0611111111" })).toEqual([]);
  });
});

describe("validatie", () => {
  const base = { ...emptyLead({ id: "uLuke", displayName: "Luke" }), name: "Test", email: "t@t.nl" };
  test("naam en contactgegeven verplicht", () => {
    const v = validateLead({ ...base, name: "", email: "", phone: "" });
    expect(v.errors.name).toBeTruthy();
    expect(v.errors.email).toBeTruthy();
  });
  test("actie zonder datum mag niet", () => {
    expect(validateLead({ ...base, nextActionType: "call_back", nextActionDate: "" }).errors.nextActionDate).toBeTruthy();
    expect(validateLead({ ...base, nextActionType: "none", nextActionDate: "" }).valid).toBe(true);
  });
  test("kennismaking gepland vereist datum", () => {
    expect(validateLead({ ...base, pipelineStage: "appointment_scheduled" }).errors.appointmentDate).toBeTruthy();
  });
  test("gekoppeld aan partner zonder koppeling = waarschuwing", () => {
    const v = validateLead({ ...base, pipelineStage: "partner_connected" }, { partnerCount: 0 });
    expect(v.valid).toBe(true);
    expect(v.warnings.length).toBe(1);
  });
  test("gestopt vereist afsluitreden", () => {
    expect(validateLead({ ...base, pipelineStage: "stopped", nextActionType: "none" }).errors.closureReason).toBeTruthy();
    expect(validateLead({ ...base, pipelineStage: "stopped", nextActionType: "none", closureReason: "no_response" }).valid).toBe(true);
  });
});

describe("signalen, KPI's en filters", () => {
  const now = new Date();
  const today = todayISO(now);
  const mk = (over) => ({ ...emptyLead(null), id: Math.random().toString(36), name: "X", email: "x@x.nl", createdAt: now, ...over });

  test("nieuwe lead > 24 uur zonder contact", () => {
    const l = mk({ createdAt: new Date(now.getTime() - 30 * 3600 * 1000) });
    expect(getLeadSignals(l, now).map((s) => s.key)).toContain("no_contact");
  });
  test("actieve lead zonder volgende actie", () => {
    const l = mk({ pipelineStage: "qualified", nextActionType: "none", nextActionDate: "" });
    expect(getLeadSignals(l, now).map((s) => s.key)).toContain("no_next_action");
  });
  test("partner te lang zonder terugkoppeling", () => {
    const l = mk({
      pipelineStage: "partner_connected",
      nextActionDate: today,
      partnerSummary: { count: 1, waitingCount: 1, waitingSince: new Date(now.getTime() - 10 * 86400000), nextFollowUpAt: "" },
    });
    expect(getLeadSignals(l, now).map((s) => s.key)).toContain("partner_waiting");
  });
  test("KPI's en Vandaag", () => {
    const leads = [
      mk({ nextActionDate: today }),
      mk({ nextActionDate: addDaysISO(today, -2), pipelineStage: "contact_phase" }),
      mk({ pipelineStage: "appointment_scheduled", appointmentStatus: "scheduled", appointmentDate: today, nextActionDate: addDaysISO(today, 3) }),
      mk({ pipelineStage: "active_search", nextActionDate: addDaysISO(today, 5) }),
      mk({ pipelineStage: "stopped", closureReason: "no_response", nextActionType: "none", nextActionDate: "" }),
    ];
    const k = computeKpis(leads, now);
    expect(k.new).toBe(1);
    expect(k.today).toBe(2);
    expect(k.overdue).toBe(1);
    expect(k.appointments).toBe(1);
    expect(k.active_search).toBe(1);
    expect(getTodayItems(leads, now).length).toBe(2);
  });
  test("filters: scope, mijn leads, zoeken op plaats/partner", () => {
    const a = mk({ ownerId: "uLuke", places: ["Torrevieja"], partnerNames: ["Casa Sol"], partnerIds: ["p1"] });
    const b = mk({ ownerId: "uIndy", archived: true });
    const c = mk({ ownerId: "uIndy", pipelineStage: "completed", nextActionType: "none", nextActionDate: "" });
    const all = [a, b, c];
    expect(applyFilters(all, DEFAULT_FILTERS, { currentUserId: "uLuke" })).toEqual([a]);
    expect(applyFilters(all, { ...DEFAULT_FILTERS, scope: "archived" }, {})).toEqual([b]);
    expect(applyFilters(all, { ...DEFAULT_FILTERS, scope: "closed" }, {})).toEqual([c]);
    expect(applyFilters(all, { ...DEFAULT_FILTERS, owner: "me" }, { currentUserId: "uIndy" })).toEqual([]);
    expect(applyFilters(all, { ...DEFAULT_FILTERS, search: "torrev" }, {})).toEqual([a]);
    expect(applyFilters(all, { ...DEFAULT_FILTERS, search: "casa sol" }, {})).toEqual([a]);
    expect(applyFilters(all, { ...DEFAULT_FILTERS, partner: "p1" }, {})).toEqual([a]);
  });
});

describe("systeemactiviteiten bij wijzigingen", () => {
  test("fase- en prioriteitswijziging worden beschreven, notities niet", () => {
    const before = buildLeadPayload({ ...emptyLead(null), name: "A", pipelineStage: "qualified", priority: "normal" });
    const after = buildLeadPayload({ ...before, pipelineStage: "partner_connected", priority: "high", notities: "iets" });
    const titles = describeLeadChanges(before, after).map((a) => a.title);
    expect(titles).toEqual(expect.arrayContaining(["Pipelinefase gewijzigd van Gekwalificeerd naar Gekoppeld aan partner"]));
    expect(titles.some((t) => /Prioriteit/.test(t))).toBe(true);
    expect(titles.some((t) => /otitie/.test(t))).toBe(false);
  });
});
