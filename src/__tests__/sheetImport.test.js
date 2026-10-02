import {
  mapSheetRow,
  planImport,
  parseCsv,
  mapTimeline,
  mapListingType,
  mapLeadSource,
  mapSpainVisit,
  mapContactPreference,
  mapContactMoment,
  displayPhone,
  parseSheetDate,
} from "../crm/sheetImport";
import { normalizePhone, buildLeadPayload } from "../crm/normalize";

const ROW = {
  "Submission ID": "sub-001",
  "Submission time": "2026-10-01 19:14:03",
  property_type: "Villa, Appartement",
  listing_type: "Resale / bestaande bouw",
  bedrooms: "3+",
  region: "Costa Blanca Noord, Costa Cálida",
  max_budget: "200.000 - 300.000",
  aankooptijd: "Binnen 3-6 maanden",
  doeleinde: "(Semi) permanent wonen",
  financiering: "Eigen middelen",
  "bezoek spanje": "Ja, maar nog geen datum gepland",
  name: "Rory de Leon",
  Telefoonnummer: "31657968628",
  email: "Rory@Example.com",
  contact: "Eerst WhatsApp, daarna telefonisch",
  bereikbaar: "Maakt niet uit",
  toestemming: "Ja",
  utm_source: "fb",
  utm_medium: "paid_social",
  utm_campaign: "MSK | Leads | Website | NL",
  utm_content: "AD 01",
  landingPage: "gratis_zoekprofiel",
  form_source: "Website",
  mail_status: "sent",
  pdf_url: "https://drive.google.com/file/d/abc/view",
  pdf_file_id: "abc",
  pdf_created_at: "2026-10-01 19:15",
  pdf_sent: "TRUE",
  growth_sync_status: "error",
  growth_synced_at: "",
  growth_sync_error: "Timeout",
};

test("rij wordt volledig en genormaliseerd gemapt", () => {
  const m = mapSheetRow(ROW);
  expect(m.valid).toBe(true);
  expect(m.submissionId).toBe("sub-001");
  expect(m.form).toMatchObject({
    name: "Rory de Leon",
    phone: "+31 6 57968628",
    email: "rory@example.com",
    preferredContactMethod: "whatsapp_then_phone",
    preferredContactMoment: "no_preference",
    budgetMin: 200000,
    budgetMax: 300000,
    regions: ["costa_blanca_noord", "costa_calida"],
    propertyTypes: ["villa", "apartment"],
    buildPreference: "resale",
    bedroomsMin: 3,
    purchaseTimeline: "3_to_6_months",
    purchaseGoal: "semi_permanent",
    financingType: "own_funds",
    visitSpainStatus: "planned_no_date",
    visitSpainDate: "",
    consentContact: true,
    leadSource: "meta_ads",
    utmSource: "fb",
    utmMedium: "paid_social",
    formSource: "Website",
    landingPage: "gratis_zoekprofiel",
  });
  expect(m.extra.sourceSubmittedAt.getHours()).toBe(19);
  expect(m.extra.searchProfilePdf).toMatchObject({ url: ROW.pdf_url, fileId: "abc", sent: true });
  expect(m.extra.syncInfo).toMatchObject({ mailStatus: "sent", growthSyncStatus: "error", growthSyncError: "Timeout" });
  expect(m.extra.importRaw.max_budget).toBe("200.000 - 300.000");
  // De gemapte lead past door de normale opslaglogica
  const payload = buildLeadPayload(m.form);
  expect(payload.phoneNormalized).toBe("31657968628");
  expect(payload.consentContact).toBe(true);
});

test("budget, termijnen, bouwtype en bronnen", () => {
  expect(mapSheetRow({ ...ROW, max_budget: "0 - 200.000" }).form).toMatchObject({ budgetMin: null, budgetMax: 200000 });
  expect(mapTimeline("Binnen 3 maanden")).toBe("within_3_months");
  expect(mapTimeline("Binnen 6-12 maanden")).toBe("6_to_12_months");
  expect(mapTimeline("Ik weet het nog niet")).toBe("unknown");
  expect(mapListingType("Nieuwbouw")).toBe("new_build");
  expect(mapListingType("Nieuwbouw of resale")).toBe("both");
  expect(mapLeadSource({ utmSource: "google", utmMedium: "cpc" })).toBe("google_ads");
  expect(mapLeadSource({ utmSource: "ig", utmMedium: "organic" })).toBe("instagram_organic");
  expect(mapLeadSource({ formSource: "Rekentool" })).toBe("website_calculator");
});

test("bezoek Spanje, contactvoorkeur en moment", () => {
  expect(mapSpainVisit("Nee").visitSpainStatus).toBe("not_planned");
  expect(mapSpainVisit("15-11-2026")).toMatchObject({ visitSpainStatus: "date_known", visitSpainDate: "2026-11-15" });
  expect(mapSpainVisit("Ik ben er al geweest").visitSpainStatus).toBe("in_spain_or_visited");
  expect(mapContactPreference("WhatsApp")).toEqual({ preferredContactMethod: "whatsapp", contactPreferenceText: "" });
  expect(mapContactMoment("Avond")).toEqual({ preferredContactMoment: "evening", contactMomentText: "" });
  expect(mapContactMoment("Ochtend of avond")).toEqual({ preferredContactMoment: "no_preference", contactMomentText: "Ochtend of avond" });
});

test("telefoonnormalisatie: drie schrijfwijzen zijn hetzelfde nummer", () => {
  expect(normalizePhone("31612345678")).toBe("31612345678");
  expect(normalizePhone("+31612345678")).toBe("31612345678");
  expect(normalizePhone("06 12345678")).toBe("31612345678");
  expect(displayPhone("31612345678")).toBe("+31 6 12345678");
  expect(displayPhone("06 12345678")).toBe("+31 6 12345678");
  expect(parseSheetDate("1-10-2026 19:14").getMonth()).toBe(9);
});

test("importplan: Submission ID is harde controle, e-mail/telefoon zachte controle", () => {
  const existing = [
    { id: "L1", name: "Rory", sourceSubmissionId: "sub-001" },
    { id: "L2", name: "Jan", email: "jan@x.nl", emailNormalized: "jan@x.nl", phone: "", phoneNormalized: "" },
  ];
  const rows = [
    ROW, // zelfde Submission ID → already_exists
    { ...ROW, "Submission ID": "sub-002", email: "jan@x.nl", Telefoonnummer: "" }, // mogelijk dubbel
    { ...ROW, "Submission ID": "sub-003", email: "nieuw@x.nl", Telefoonnummer: "0611111111" }, // nieuw
    { ...ROW, "Submission ID": "sub-003", email: "nieuw@x.nl" }, // dubbel in dezelfde import
    { ...ROW, "Submission ID": "", name: "" }, // ongeldig
  ];
  const plan = planImport(rows, existing);
  expect(plan.map((p) => p.status)).toEqual(["already_exists", "possible_duplicate", "new", "already_exists", "invalid"]);
  expect(plan[0].existingId).toBe("L1");
  expect(plan[1].duplicates).toEqual([{ id: "L2", name: "Jan" }]);
});

test("CSV met quotes en puntkomma's", () => {
  const csv = 'Submission ID;name;email;utm_campaign\n"a1";"Jan; de Vos";jan@x.nl;"MSK | ""NL"""\n';
  expect(parseCsv(csv)).toEqual([{ "Submission ID": "a1", name: "Jan; de Vos", email: "jan@x.nl", utm_campaign: 'MSK | "NL"' }]);
});
