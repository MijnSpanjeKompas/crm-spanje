// Volledige leadflow tegen een in-memory Firestore/Storage:
// aanmaken → contactactiviteit → opvolgactie → kennismaking → kwalificeren →
// partner koppelen → bestand uploaden → taak → afsluiten → archiveren.

import * as fake from "../testing/fakeFirebase";
import {
  createLead,
  updateLead,
  addActivity,
  savePartner,
  addPartnerLink,
  updatePartnerLink,
  removePartnerLink,
  addTask,
  setTaskStatus,
  uploadLeadFile,
  updateLeadFile,
  deleteLeadFile,
  archiveLead,
  restoreLead,
  deleteLeadPermanently,
  setPinned,
  validateFile,
} from "../crm/services";
import { normalizeLead, emptyLead } from "../crm/normalize";
import { validateLead } from "../crm/validation";
import { getLeadSignals, computeKpis } from "../crm/signals";
import { todayISO, addDaysISO, toMillis } from "../crm/dates";

jest.mock("../firebase", () => ({ db: {}, storage: {}, auth: {} }));
jest.mock("firebase/firestore", () => require("../testing/fakeFirebase"));
jest.mock("firebase/storage", () => require("../testing/fakeFirebase"));

const LUKE = { id: "uLuke", displayName: "Luke van Spronsen", isAdmin: true };
const INDY = { id: "uIndy", displayName: "Indy Klijn", isAdmin: true };
const USERS = [LUKE, INDY];

const read = (id) => normalizeLead({ id, ...fake.__getDoc(`leads/${id}`) }, { users: USERS });
const sub = (id, name) =>
  Array.from(fake.__dump().docs.keys())
    .filter((p) => p.startsWith(`leads/${id}/${name}/`))
    .map((p) => ({ id: p.split("/").pop(), ...fake.__getDoc(p) }));
const titles = (id) => sub(id, "activities").map((a) => a.title);

beforeEach(() => fake.__reset());

test("volledige leadflow", async () => {
  const today = todayISO();

  // 1. Aanmaken
  const form = { ...emptyLead(LUKE), name: "Jan Jansen", email: "Jan@Voorbeeld.nl", phone: "06 11122233", leadSource: "website_questionnaire", utmCampaign: "najaar" };
  expect(validateLead(form).valid).toBe(true);
  const id = await createLead(form, LUKE);
  let lead = read(id);
  const raw = fake.__getDoc(`leads/${id}`);
  expect(raw.schemaVersion).toBe(2);
  expect(raw.createdAt).toBeInstanceOf(Date);
  expect(raw.updatedAt).toBeInstanceOf(Date);
  expect(raw.createdBy).toBe("uLuke");
  expect(raw.emailNormalized).toBe("jan@voorbeeld.nl");
  expect(raw.lastContactAt).toBeNull();
  expect(lead.pipelineStage).toBe("new_lead");
  expect(lead.ownerId).toBe("uLuke");
  expect(lead.nextActionType).toBe("first_contact");
  expect(titles(id)).toContain("Lead aangemaakt");

  // 2. Contactpoging zonder gehoor: geen 'laatste contact', wel poging
  await addActivity(lead, { type: "phone_call", outcome: "no_answer", title: "Gebeld", occurredAt: new Date() }, LUKE);
  lead = read(id);
  expect(lead.lastContactAt).toBeNull();
  expect(lead.lastContactAttemptAt).toBeTruthy();
  expect(lead.lastActivityType).toBe("phone_call");

  // 3. Geslaagd contact + direct volgende actie plannen + fase naar contactfase
  await addActivity(lead, { type: "phone_call", outcome: "spoken", title: "Kennismakingsgesprek telefonisch", description: "Wil emigreren", occurredAt: new Date() }, INDY, {
    nextAction: { nextActionType: "schedule_appointment", nextActionDate: addDaysISO(today, 2), nextActionAssignedTo: "uIndy", nextActionAssignedToName: "Indy Klijn" },
    pipelineStage: "contact_phase",
  });
  lead = read(id);
  expect(lead.pipelineStage).toBe("contact_phase");
  expect(lead.lastContactAt).toBeTruthy();
  expect(lead.lastContactMethod).toBe("phone");
  expect(lead.nextActionType).toBe("schedule_appointment");
  expect(lead.nextActionAssignedTo).toBe("uIndy");
  expect(titles(id)).toEqual(expect.arrayContaining(["Pipelinefase gewijzigd van Nieuwe lead naar Contactfase", "Kennismakingsgesprek telefonisch"]));
  const call = sub(id, "activities").find((a) => a.title === "Kennismakingsgesprek telefonisch");
  expect(call).toMatchObject({ type: "phone_call", outcome: "spoken", contactMethod: "phone", createdByUserId: "uIndy" });

  // 4. Kennismaking plannen: zonder datum geblokkeerd, met datum ok
  expect(validateLead({ ...lead, pipelineStage: "appointment_scheduled" }).errors.appointmentDate).toBeTruthy();
  await updateLead(lead, { ...lead, pipelineStage: "appointment_scheduled", appointmentDate: addDaysISO(today, 3), appointmentTime: "10:00", appointmentType: "video", appointmentStatus: "scheduled", appointmentAssignedTo: "uLuke", appointmentAssignedToName: "Luke van Spronsen", nextActionType: "conduct_appointment", nextActionDate: addDaysISO(today, 3) }, LUKE);
  lead = read(id);
  expect(lead.appointmentStatus).toBe("scheduled");
  expect(computeKpis([lead]).appointments).toBe(1);

  // 5. Kennismaking gehad → telt als klantcontact
  const beforeContact = toMillis(lead.lastContactAt);
  await updateLead(lead, { ...lead, appointmentStatus: "completed", pipelineStage: "appointment_completed", nextActionType: "complete_search_profile", nextActionDate: today }, LUKE);
  lead = read(id);
  expect(lead.pipelineStage).toBe("appointment_completed");
  expect(sub(id, "activities").some((a) => a.type === "appointment")).toBe(true);
  expect(toMillis(lead.lastContactAt)).toBeGreaterThanOrEqual(beforeContact);
  expect(lead.lastContactMethod).toBe("appointment");

  // 6. Kwalificeren + zoekprofiel
  await updateLead(lead, { ...lead, pipelineStage: "qualified", purchaseIntent: "concrete_plans", priority: "high", budgetMin: 250000, budgetMax: 350000, regions: ["costa_blanca_zuid"], places: ["Torrevieja", "Rojales"], propertyTypes: ["villa", "townhouse"], purchaseGoal: "emigration", purchaseTimeline: "3_to_6_months", financingType: "own_funds", currentHousingSituation: "house_needs_to_be_sold", requirements: ["private_pool"], nextActionType: "select_partner", nextActionDate: today }, LUKE);
  lead = read(id);
  expect(lead.pipelineStage).toBe("qualified");
  expect(lead.places).toEqual(["Torrevieja", "Rojales"]);
  expect(getLeadSignals(lead).map((s) => s.key)).not.toContain("incomplete_profile");
  expect(titles(id).some((t) => /Koopintentie/.test(t))).toBe(true);

  // 7. Partner aanmaken + koppelen + fase + opvolging
  const partnerId = await savePartner({ name: "Casa Sol Makelaars", type: "realtor", contactPerson: "Maria", regions: ["costa_blanca_zuid"] }, LUKE);
  expect(fake.__getDoc(`partners/${partnerId}`)).toMatchObject({ name: "Casa Sol Makelaars", active: true });
  const partner = { id: partnerId, ...fake.__getDoc(`partners/${partnerId}`) };
  await addPartnerLink(lead, partner, { status: "sent", nextFollowUpAt: addDaysISO(today, -1), notes: "Zoekprofiel gemaild" }, LUKE);
  lead = read(id);
  expect(lead.partnerIds).toEqual([partnerId]);
  expect(lead.partnerNames).toEqual(["Casa Sol Makelaars"]);
  expect(lead.partnerStatus).toBe("sent");
  expect(lead.partnerSummary).toMatchObject({ count: 1, waitingCount: 1 });
  expect(getLeadSignals(lead).map((s) => s.key)).toContain("partner_follow_up_overdue");
  expect(validateLead({ ...lead, pipelineStage: "partner_connected" }, { partnerCount: 1 }).warnings).toHaveLength(0);
  await updateLead(lead, { ...lead, pipelineStage: "partner_connected", nextActionType: "follow_up_partner", nextActionDate: addDaysISO(today, 7) }, LUKE);
  lead = read(id);
  const [link] = sub(id, "partnerLinks");
  await updatePartnerLink(lead, link, { status: "contacted", nextFollowUpAt: addDaysISO(today, 7) }, LUKE, { logFollowUp: true, followUpNote: "Maria heeft gebeld" });
  lead = read(id);
  expect(lead.partnerStatus).toBe("contacted");
  expect(sub(id, "partnerLinks")[0].lastFollowUpAt).toBeInstanceOf(Date);
  expect(getLeadSignals(lead).map((s) => s.key)).not.toContain("partner_follow_up_overdue");
  expect(titles(id)).toContain("Partner opgevolgd: Casa Sol Makelaars");

  // 8. Bestanden: validatie + upload + hernoemen + verwijderen
  expect(validateFile({ name: "virus.exe", size: 10 })).toMatch(/niet toegestaan/);
  expect(validateFile({ name: "groot.pdf", size: 16 * 1024 * 1024 })).toMatch(/15 MB/);
  for (const n of ["a.pdf", "b.JPG", "c.jpeg", "d.png", "e.doc", "f.docx"]) expect(validateFile({ name: n, size: 1000 })).toBeNull();
  const pdf = new File(["%PDF-1.4 test"], "Zoekprofiel Jan.pdf", { type: "application/pdf" });
  const progress = jest.fn();
  const fileId = await uploadLeadFile(lead, pdf, "search_profile", LUKE, progress);
  lead = read(id);
  const [fileMeta] = sub(id, "files");
  expect(fileMeta).toMatchObject({ fileName: "Zoekprofiel Jan.pdf", mimeType: "application/pdf", category: "search_profile", uploadedByUserId: "uLuke" });
  expect(fileMeta.downloadUrl).toBeUndefined(); // bewust geen publieke URL opgeslagen
  expect(fileMeta.storagePath).toBe(`leads/${id}/${fileId}_Zoekprofiel-Jan.pdf`);
  expect(fake.__files().get(fileMeta.storagePath).metadata.contentType).toBe("application/pdf");
  expect(lead.fileCount).toBe(1);
  expect(progress).toHaveBeenCalled();
  await updateLeadFile(lead, { id: fileId, ...fileMeta }, { fileName: "Zoekprofiel definitief.pdf", category: "lead_summary" });
  expect(sub(id, "files")[0]).toMatchObject({ fileName: "Zoekprofiel definitief.pdf", category: "lead_summary", originalFileName: "Zoekprofiel Jan.pdf" });
  const img = new File(["x"], "paspoort.png", { type: "image/png" });
  const imgId = await uploadLeadFile(read(id), img, "identification", LUKE);
  await deleteLeadFile(read(id), { id: imgId, ...sub(id, "files").find((f) => f.id === imgId) }, LUKE);
  expect(sub(id, "files")).toHaveLength(1);
  expect(read(id).fileCount).toBe(1);
  expect(fake.__files().size).toBe(1);

  // 9. Taken
  lead = read(id);
  await addTask(lead, { title: "Financieringsbewijs opvragen", dueDate: addDaysISO(today, -1), assignedToUserId: "uIndy", assignedToName: "Indy Klijn" }, LUKE);
  await addTask(lead, { title: "Bezichtiging plannen", dueDate: addDaysISO(today, 5) }, LUKE);
  lead = read(id);
  expect(lead.openTaskCount).toBe(2);
  expect(lead.nextTaskTitle).toBe("Financieringsbewijs opvragen");
  expect(getLeadSignals(lead).map((s) => s.key)).toContain("overdue_task");
  const task = sub(id, "tasks").find((t) => t.title === "Financieringsbewijs opvragen");
  await setTaskStatus(lead, task, "completed", INDY);
  lead = read(id);
  expect(lead.openTaskCount).toBe(1);
  expect(lead.nextTaskTitle).toBe("Bezichtiging plannen");
  expect(titles(id)).toContain("Taak afgerond: Financieringsbewijs opvragen");

  // 10. Pinnen (geen activiteit)
  const countBefore = sub(id, "activities").length;
  await setPinned(lead, true);
  expect(read(id).pinned).toBe(true);
  expect(sub(id, "activities").length).toBe(countBefore);

  // 11. Afsluiten: zonder reden geblokkeerd, met reden ok
  lead = read(id);
  const closing = { ...lead, pipelineStage: "stopped", nextActionType: "none" };
  expect(validateLead(closing).errors.closureReason).toBeTruthy();
  await updateLead(lead, { ...closing, closureReason: "plans_postponed", closureNotes: "Eerst huis verkopen" }, LUKE);
  lead = read(id);
  expect(lead.pipelineStage).toBe("stopped");
  expect(fake.__getDoc(`leads/${id}`).closedAt).toBeInstanceOf(Date);
  expect(titles(id)).toContain("Lead gesloten");

  // 12. Archiveren en terugzetten
  await archiveLead(lead, LUKE);
  lead = read(id);
  expect(lead.archived).toBe(true);
  expect(fake.__getDoc(`leads/${id}`).archivedBy).toBe("uLuke");
  await restoreLead(lead, LUKE);
  expect(read(id).archived).toBe(false);

  // Er is onderweg niets verwijderd: alle activiteiten staan er nog
  expect(sub(id, "activities").length).toBeGreaterThan(15);

  // 13. Partner ontkoppelen en definitief verwijderen (beheerder) ruimt alles op
  await removePartnerLink(read(id), { id: link.id, ...sub(id, "partnerLinks")[0] }, LUKE);
  expect(read(id).partnerSummary.count).toBe(0);
  await deleteLeadPermanently(read(id));
  expect(fake.__getDoc(`leads/${id}`)).toBeUndefined();
  expect(Array.from(fake.__dump().docs.keys()).filter((p) => p.startsWith(`leads/${id}`))).toHaveLength(0);
  expect(fake.__files().size).toBe(0);
  expect(fake.__getDoc(`partners/${partnerId}`)).toBeTruthy(); // partner blijft bestaan
});

test("oude lead: opslaan breidt uit naar nieuw schema zonder oude velden te verwijderen", async () => {
  const legacy = {
    naam: "Ewoud Kremer",
    telefoon: "0612345678",
    email: "ewoud@example.nl",
    status: "Doorgegeven",
    leadscore: "Hot lead",
    leadbron: "Meta Ads",
    volgendeActie: "Doorgeven",
    geenStrengeDatum: true,
    tags: ["Emigratie", "VIP"],
    doelAankoop: "Emigratie",
    startdatum: "2026-09-10",
    laatsteContactdatum: "2026-09-12",
    contactmethode: "Telefonisch",
    notities: "Belangrijke gespreksnotities",
    voortgangsnotitie: "Wil in 2027 verhuizen",
  };
  fake.__setDoc("leads/old1", legacy);
  let lead = read("old1");
  expect(lead._isLegacy).toBe(true);

  // Pinnen of een activiteit toevoegen maakt de lead niet 'nieuw' en raakt niets kwijt
  await setPinned(lead, true);
  await addActivity(read("old1"), { type: "note", title: "Notitie" }, LUKE);
  lead = read("old1");
  expect(lead._isLegacy).toBe(true);
  expect(lead.pipelineStage).toBe("partner_connected");

  // Opslaan vereist datum bij de volgende actie (was 'geen strenge datum')
  expect(validateLead(lead).errors.nextActionDate).toBeTruthy();
  await updateLead(lead, { ...lead, nextActionDate: todayISO() }, LUKE);

  const raw = fake.__getDoc("leads/old1");
  // nieuw schema
  expect(raw.schemaVersion).toBe(2);
  expect(raw.name).toBe("Ewoud Kremer");
  expect(raw.pipelineStage).toBe("partner_connected");
  expect(raw.purchaseIntent).toBe("concrete_plans");
  expect(raw.priority).toBe("high");
  expect(raw.purchaseGoal).toBe("emigration");
  expect(raw.leadSummary).toBe("Wil in 2027 verhuizen");
  expect(raw.tags).toEqual(["VIP"]);
  expect(raw.legacyTags).toEqual(["Emigratie"]);
  expect(raw.legacyInfo).toMatchObject({ status: "Doorgegeven", leadType: "Hot lead", source: "Meta Ads" });
  expect(raw.createdAt).toBeInstanceOf(Date);
  expect(raw.createdAtSource).toBe("legacy_startdatum");
  expect(raw.lastContactAt).toBeInstanceOf(Date);
  expect(raw.pinned).toBe(true);
  // oude velden staan er nog
  expect(raw.naam).toBe("Ewoud Kremer");
  expect(raw.status).toBe("Doorgegeven");
  expect(raw.leadscore).toBe("Hot lead");
  expect(raw.notities).toBe("Belangrijke gespreksnotities");
  expect(raw.voortgangsnotitie).toBe("Wil in 2027 verhuizen");

  // Na migratie blijft alles consistent bij herlezen
  const again = read("old1");
  expect(again._isLegacy).toBe(false);
  expect(again.tags).toEqual(["VIP"]);
  expect(again.nextActionType).toBe("connect_partner");
});
