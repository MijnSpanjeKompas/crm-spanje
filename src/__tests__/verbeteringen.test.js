// Verbeteringen november 2026: profielen, contactmomenten, actie afvinken,
// KPI-correcties, agenda-betrouwbaarheid, recent toegevoegd en notificaties.

import { render, screen, fireEvent } from "@testing-library/react";
import * as fake from "../testing/fakeFirebase";
import {
  createLead,
  updateLead,
  addContactMoment,
  updateContactMoment,
  deleteContactMoment,
  completeNextAction,
  backfillContactAttempts,
  subscribeNotificationReads,
  saveNotificationReads,
  moveLeadToTrash,
  restoreFromTrash,
  purgeExpiredTrash,
  saveAdSpendMonth,
  subscribeAdSpend,
} from "../crm/services";
import { adPerformance, adSpendInPeriod, getPeriod } from "../crm/analytics";
import { buildDigest } from "../crm/digest";
import { normalizeLead, emptyLead } from "../crm/normalize";
import { reached, reachedAt, deriveFirstHandling } from "../crm/milestones";
import { blockingErrors } from "../crm/validation";
import { buildAgendaItems } from "../crm/agenda";
import { applyFilters, DEFAULT_FILTERS } from "../crm/filters";
import { followUpStats, kpiSummary } from "../crm/analytics";
import { PROFILES, profileUser, profileNameOnly, checkProfileCode } from "../crm/profiles";
import { todayISO, addDaysISO } from "../crm/dates";
import { ProfilePicker } from "../components/LoginScreen";

jest.mock("../firebase", () => ({ db: {}, storage: {}, auth: {} }));
jest.mock("firebase/firestore", () => require("../testing/fakeFirebase"));
jest.mock("firebase/storage", () => require("../testing/fakeFirebase"));

const LUKE = profileUser({ id: "authUid", email: "team@msk.nl" }, "luke");
const INDY = profileUser({ id: "authUid", email: "team@msk.nl" }, "indy");

const read = (id) => normalizeLead({ id, ...fake.__getDoc(`leads/${id}`) }, { users: PROFILES });
const acts = (id) =>
  Array.from(fake.__dump().docs.keys())
    .filter((p) => p.startsWith(`leads/${id}/activities/`))
    .map((p) => ({ id: p.split("/").pop(), ...fake.__getDoc(p) }));

beforeEach(() => fake.__reset());

async function newLead(extra = {}) {
  const form = { ...emptyLead(LUKE), name: "Test Lead", email: "t@t.nl", leadSource: "manual", consentStatus: "yes", ...extra };
  return createLead(form, LUKE);
}

describe("profielen", () => {
  test("acties staan op naam van het gekozen profiel; nieuwe lead krijgt dat profiel als verantwoordelijke", async () => {
    expect(LUKE).toMatchObject({ id: "luke", displayName: "Luke", authUid: "authUid" });
    const id = await newLead();
    expect(fake.__getDoc(`leads/${id}`)).toMatchObject({ ownerId: "luke", ownerName: "Luke", createdBy: "luke" });
    await addContactMoment(read(id), { title: "Klantcontact", description: "Gebeld" }, INDY);
    const cm = acts(id).find((a) => a.type === "contact_moment");
    expect(cm).toMatchObject({ createdByName: "Indy", actorId: "indy", actorType: "human" });
  });

  test("profielkeuze vraagt een code: verkeerde code weigert, juiste code laat je erin", () => {
    const pick = jest.fn();
    render(<ProfilePicker profiles={PROFILES} onPick={pick} onSignOut={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Indy/ }));
    const input = screen.getByLabelText(/Code voor Indy/);
    fireEvent.change(input, { target: { value: "3636" } }); // code van Luke
    expect(pick).not.toHaveBeenCalled();
    expect(screen.getByText(/klopt niet/)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "1306" } });
    expect(pick).toHaveBeenCalledWith("indy");
  });

  test("codes: Luke 3636, Indy 1306", () => {
    expect(checkProfileCode("luke", "3636")).toBe(true);
    expect(checkProfileCode("indy", "1306")).toBe(true);
    expect(checkProfileCode("luke", "1306")).toBe(false);
    expect(checkProfileCode("indy", "")).toBe(false);
  });

  test("oude accountnamen worden niet als persoon getoond", () => {
    expect(profileNameOnly("Mijn Spanje Kompas")).toBe("");
    expect(profileNameOnly("Luke van Spronsen")).toBe("Luke");
  });
});

describe("contactmomenten", () => {
  test("vastleggen met titel + tekst + tijdstip, telt als klantcontact", async () => {
    const id = await newLead();
    const at = new Date(2026, 10, 2, 14, 5);
    await addContactMoment(read(id), { title: "Klantcontact", description: "Lang gesprek over Rojales", occurredAt: at }, LUKE);
    const cm = acts(id).find((a) => a.type === "contact_moment");
    expect(cm).toMatchObject({ title: "Klantcontact", description: "Lang gesprek over Rojales" });
    expect(cm.occurredAt.getTime()).toBe(at.getTime());
    const raw = fake.__getDoc(`leads/${id}`);
    expect(raw.lastContactAt.getTime()).toBe(at.getTime());
    expect(raw.firstContactAt.getTime()).toBe(at.getTime());
  });

  test("'Controle makelaar' zonder klantcontact telt niet als klantcontact", async () => {
    const id = await newLead();
    await addContactMoment(read(id), { title: "Controle makelaar", description: "Makelaar gebeld", customerContact: false }, LUKE);
    const raw = fake.__getDoc(`leads/${id}`);
    expect(raw.lastContactAt).toBeNull();
    expect(raw.lastActivityAt).toBeInstanceOf(Date);
  });

  test("aanpassen en verwijderen", async () => {
    const id = await newLead();
    await addContactMoment(read(id), { title: "Klantcntact", description: "x" }, LUKE);
    let cm = acts(id).find((a) => a.type === "contact_moment");
    await updateContactMoment(read(id), cm, { title: "Klantcontact" }, LUKE);
    cm = acts(id).find((a) => a.type === "contact_moment");
    expect(cm.title).toBe("Klantcontact");
    await deleteContactMoment(read(id), cm, LUKE);
    expect(acts(id).some((a) => a.type === "contact_moment")).toBe(false);
    expect(acts(id).some((a) => a.metadata?.event === "contact_moment_deleted")).toBe(true);
  });
});

describe("volgende actie afvinken", () => {
  test("Gedaan legt vast wat is uitgevoerd, maakt de actie leeg en telt als benadering", async () => {
    const id = await newLead({ nextActionType: "check_realtor", nextActionDate: todayISO() });
    let lead = read(id);
    // Lead aanmaken met een geplande actie telt nog niet als oppakken.
    expect(lead.firstContactAttemptAt).toBeFalsy();
    await completeNextAction(lead, lead, { note: "Makelaar heeft gebeld" }, INDY);
    lead = read(id);
    expect(lead.nextActionType).toBe("none");
    const done = acts(id).find((a) => a.type === "action_done");
    expect(done).toMatchObject({ title: "Gedaan: Contact met makelaar checken", description: "Makelaar heeft gebeld", createdByName: "Indy" });
    expect(done.metadata).toMatchObject({ event: "next_action_done", action: "check_realtor" });
    // Geen extra "Volgende actie verwijderd"-regel naast het afvinken
    expect(acts(id).some((a) => a.title === "Volgende actie verwijderd")).toBe(false);
  });

  test("contactactie afvinken = benadering voor 'Hoe snel reageren we?'", async () => {
    const id = await newLead({ nextActionType: "send_whatsapp", nextActionDate: todayISO() });
    const lead = read(id);
    await completeNextAction(lead, lead, {}, LUKE);
    expect(fake.__getDoc(`leads/${id}`).firstContactAttemptAt).toBeInstanceOf(Date);
  });
});

describe("KPI's: teruggezette fase", () => {
  test("proef op Gereserveerd/Aankoop afgerond die is teruggezet telt niet meer mee", async () => {
    const id = await newLead();
    // Situatie zoals bij de test: mijlpalen staan nog, lead staat weer op een eerdere fase.
    fake.__setDoc(`leads/${id}`, { ...fake.__getDoc(`leads/${id}`), pipelineStage: "partner_connected", firstReservedAt: new Date(2026, 9, 1), purchaseCompletedAt: new Date(2026, 9, 2), firstForwardedAt: new Date(2026, 9, 1) });
    const lead = read(id);
    expect(reached(lead, "reserved")).toBe(false);
    expect(reached(lead, "purchased")).toBe(false);
    expect(reachedAt(lead, "purchased")).toBeNull();
    expect(reached(lead, "forwarded")).toBe(true);
    expect(kpiSummary([lead]).reserved.count).toBe(0);
  });

  test("fase terugzetten wist de mijlpalen en logt dat", async () => {
    const id = await newLead();
    fake.__setDoc(`leads/${id}`, { ...fake.__getDoc(`leads/${id}`), pipelineStage: "completed", firstReservedAt: new Date(2026, 9, 1), purchaseCompletedAt: new Date(2026, 9, 2), saleDate: "2026-10-02" });
    const lead = read(id);
    expect(reached(lead, "purchased")).toBe(true);
    await updateLead(lead, { ...lead, pipelineStage: "new_lead", nextActionType: "call_back", nextActionDate: todayISO() }, LUKE);
    const raw = fake.__getDoc(`leads/${id}`);
    expect(raw.firstReservedAt).toBeNull();
    expect(raw.purchaseCompletedAt).toBeNull();
    expect(acts(id).some((a) => a.metadata?.event === "milestones_rolled_back")).toBe(true);
  });

  test("een echte reservering die stopt blijft in de historie", async () => {
    const lead = normalizeLead({ id: "x", schemaVersion: 2, name: "X", pipelineStage: "stopped", firstReservedAt: new Date(2026, 9, 1) });
    expect(reached(lead, "reserved")).toBe(true);
  });
});

describe("KPI's: hoe snel reageren we", () => {
  test("eerste handeling door het team telt, import en 'eerste contact plannen' niet", () => {
    const t = (h) => new Date(2026, 9, 1, h);
    const at = deriveFirstHandling([
      { type: "system", actorType: "system", createdByUserId: "sheets_import", occurredAt: t(8), metadata: { event: "lead_imported" } },
      { type: "system", actorType: "human", createdByUserId: "uX", occurredAt: t(9), metadata: { field: "nextAction", to: "first_contact" } },
      { type: "system", actorType: "human", createdByUserId: "uX", occurredAt: t(10), metadata: { field: "nextAction", to: "follow_up_whatsapp" } },
      { type: "system", actorType: "human", createdByUserId: "uX", occurredAt: t(12), metadata: { field: "pipelineStage", to: "appointment_scheduled" } },
    ]);
    expect(at.getTime()).toBe(t(10).getTime());
  });

  test("bestaande leads: eerste benadering wordt uit de tijdlijn afgeleid (één keer)", async () => {
    const id = "sheet-1";
    const arrived = new Date(2026, 9, 1, 8);
    fake.__setDoc(`leads/${id}`, { schemaVersion: 2, name: "Oud", pipelineStage: "partner_connected", sourceSubmittedAt: arrived, createdAt: arrived });
    fake.__setDoc(`leads/${id}/activities/a1`, { type: "system", actorType: "system", createdByUserId: "sheets_import", occurredAt: arrived, metadata: { event: "lead_imported" } });
    fake.__setDoc(`leads/${id}/activities/a2`, { type: "system", actorType: "human", createdByUserId: "uOud", occurredAt: new Date(2026, 9, 1, 8, 20), metadata: { field: "nextAction", to: "follow_up_whatsapp" } });
    const res = await backfillContactAttempts([read(id)], LUKE);
    expect(res).toMatchObject({ checked: 1, updated: 1 });
    const lead = read(id);
    expect(lead.firstContactAttemptAt.getTime()).toBe(new Date(2026, 9, 1, 8, 20).getTime());
    const stats = followUpStats([lead], [lead], new Date(2026, 9, 5));
    expect(stats.within24h.count).toBe(1);
    expect(stats.noAttempt).toBe(0);
    expect(stats.medianFirstAttemptMs).toBe(20 * 60000);
    // Tweede keer: niets meer te doen
    expect(await backfillContactAttempts([lead], LUKE)).toMatchObject({ checked: 0 });
  });

  test("fase wijzigen bij een nieuwe lead = opgepakt", async () => {
    const id = await newLead({ nextActionType: "first_contact", nextActionDate: todayISO() });
    const lead = read(id);
    await updateLead(lead, { ...lead, nextActionType: "follow_up_whatsapp" }, LUKE);
    expect(fake.__getDoc(`leads/${id}`).firstContactAttemptAt).toBeInstanceOf(Date);
  });
});

describe("agenda en opslaan", () => {
  test("'Gesprek voeren' zonder ingepland gesprek staat wél in de agenda", () => {
    const today = todayISO();
    const lead = normalizeLead({ id: "a", schemaVersion: 2, name: "A", pipelineStage: "appointment_scheduled", nextActionType: "conduct_appointment", nextActionDate: addDaysISO(today, 2) });
    expect(buildAgendaItems({ leads: [lead] }).map((i) => i.type)).toEqual(["followup"]);
    const withMeeting = normalizeLead({ ...lead, appointmentStatus: "scheduled", appointmentDate: addDaysISO(today, 2), appointmentTime: "10:00" });
    expect(buildAgendaItems({ leads: [withMeeting] }).map((i) => i.type)).toEqual(["meeting"]);
  });

  test("een oud probleem in een ander veld blokkeert het inplannen van een gesprek niet", () => {
    const before = normalizeLead({ id: "a", schemaVersion: 2, name: "A", phone: "123", pipelineStage: "new_lead", nextActionType: "call_back", nextActionDate: "" });
    const after = { ...before, appointmentStatus: "scheduled", appointmentDate: addDaysISO(todayISO(), 1), pipelineStage: "appointment_scheduled" };
    expect(blockingErrors(before, after, { previousStage: "new_lead" })).toEqual({});
    // Een nieuwe fout blokkeert wel
    expect(Object.keys(blockingErrors(before, { ...before, name: "" }, {}))).toEqual(["name"]);
  });
});

describe("recent toegevoegd", () => {
  test("toont leads van de laatste 30 dagen, nieuwste bovenaan, ook vastgepinde niet voorrang", () => {
    const now = new Date(2026, 10, 3);
    const mk = (id, d, extra = {}) => normalizeLead({ id, schemaVersion: 2, name: id, pipelineStage: "partner_connected", sourceSubmittedAt: d, ...extra });
    const leads = [mk("oud", new Date(2026, 5, 1)), mk("a", new Date(2026, 10, 1), { pinned: true }), mk("b", new Date(2026, 10, 2)), mk("arch", new Date(2026, 10, 2), { archived: true })];
    expect(applyFilters(leads, { ...DEFAULT_FILTERS, recent: true }, { now }).map((l) => l.id)).toEqual(["b", "a"]);
  });
});

describe("notificaties", () => {
  test("gelezen-status per profiel blijft bewaard", async () => {
    let got = null;
    const unsub = subscribeNotificationReads("luke", (ids) => (got = ids));
    await saveNotificationReads("luke", ["late:x", "new:y", "new:y"]);
    expect(fake.__getDoc("settings/notificaties-luke").readIds).toEqual(["late:x", "new:y"]);
    // Na "herstart": opnieuw abonneren levert dezelfde lijst
    const again = [];
    subscribeNotificationReads("luke", (ids) => again.push(ids));
    expect(again[again.length - 1]).toEqual(["late:x", "new:y"]);
    expect(got).toEqual(["late:x", "new:y"]);
    unsub && unsub();
  });
});

describe("prullenbak", () => {
  test("verplaatsen, terugzetten en na 30 dagen definitief wissen", async () => {
    const id = await newLead();
    await moveLeadToTrash(read(id), INDY);
    let raw = fake.__getDoc(`leads/${id}`);
    expect(raw.deletedAt).toBeInstanceOf(Date);
    expect(raw.deletedByName).toBe("Indy");
    expect(Math.round((raw.purgeAfter - Date.now()) / 86400000)).toBe(30);
    await restoreFromTrash(read(id), LUKE);
    raw = fake.__getDoc(`leads/${id}`);
    expect(raw.deletedAt).toBeNull();
    // Opnieuw verwijderen, 31 dagen later legen
    await moveLeadToTrash(read(id), LUKE);
    expect(await purgeExpiredTrash([read(id)], new Date())).toBe(0);
    expect(await purgeExpiredTrash([read(id)], new Date(Date.now() + 31 * 86400000))).toBe(1);
    expect(fake.__getDoc(`leads/${id}`)).toBeUndefined();
  });
});

describe("automatisch makelaar checken na doorsturen", () => {
  test("fase naar Doorgestuurd plant 'Contact met makelaar checken' over 14 dagen", async () => {
    const id = await newLead({ nextActionType: "follow_up_whatsapp", nextActionDate: todayISO(), pipelineStage: "appointment_scheduled", appointmentDate: todayISO(), appointmentStatus: "completed" });
    const lead = read(id);
    const res = await updateLead(lead, { ...lead, pipelineStage: "partner_connected" }, LUKE);
    expect(res.autoFollowUp).toBe(true);
    const raw = fake.__getDoc(`leads/${id}`);
    expect(raw).toMatchObject({ pipelineStage: "partner_connected", nextActionType: "check_realtor", nextActionDate: addDaysISO(todayISO(), 14), nextActionAssignedToName: "Luke" });
  });

  test("zelf in dezelfde handeling een andere actie gekozen → die blijft", async () => {
    const id = await newLead({ nextActionType: "follow_up_whatsapp", nextActionDate: todayISO() });
    const lead = read(id);
    await updateLead(lead, { ...lead, pipelineStage: "partner_connected", nextActionType: "follow_up_spain_visit", nextActionDate: addDaysISO(todayISO(), 30) }, LUKE);
    expect(fake.__getDoc(`leads/${id}`).nextActionType).toBe("follow_up_spain_visit");
  });

  test("check afgevinkt terwijl lead nog Doorgestuurd is → volgende check weer over 14 dagen", async () => {
    const id = await newLead({ pipelineStage: "partner_connected", nextActionType: "check_realtor", nextActionDate: todayISO() });
    const lead = read(id);
    const res = await completeNextAction(lead, lead, {}, INDY);
    expect(res.nextPlanned).toBeTruthy();
    expect(fake.__getDoc(`leads/${id}`)).toMatchObject({ nextActionType: "check_realtor", nextActionDate: addDaysISO(todayISO(), 14) });
  });
});

describe("advertentiekosten", () => {
  test("kosten per lead en per doorgestuurde lead", async () => {
    await saveAdSpendMonth("2026-10", { total: 600, campaigns: { najaar: 400, oud: 50 } }, LUKE);
    await saveAdSpendMonth("2026-10", { total: 600, campaigns: { najaar: 400 } }, LUKE); // "oud" leeggemaakt
    let months = null;
    subscribeAdSpend((m) => (months = m));
    expect(months["2026-10"].campaigns).toEqual({ najaar: 400 });
    const mk = (id, extra) => normalizeLead({ id, schemaVersion: 2, name: id, leadSource: "meta_ads", utmCampaign: "najaar", sourceSubmittedAt: new Date(2026, 9, 10), pipelineStage: "new_lead", ...extra });
    const leads = [mk("a"), mk("b"), mk("c", { pipelineStage: "partner_connected" }), normalizeLead({ id: "w", schemaVersion: 2, name: "w", leadSource: "website_questionnaire", sourceSubmittedAt: new Date(2026, 9, 10) })];
    const period = getPeriod("month", new Date(2026, 9, 15));
    const perf = adPerformance(leads, months, period);
    expect(perf).toMatchObject({ spend: 600, leads: 3, forwarded: 1, perLead: 200, perForwarded: 600 });
    expect(perf.campaigns.find((c) => c.name === "najaar")).toMatchObject({ spend: 400, leads: 3, perForwarded: 400 });
    // Halve maand → half budget
    expect(Math.round(adSpendInPeriod(months, { start: new Date(2026, 9, 1), end: new Date(2026, 9, 16, 12) }))).toBe(300);
  });
});

describe("dagelijks overzicht", () => {
  test("bevat vandaag, te laat en nieuw binnen; slaat prullenbak over", () => {
    const now = new Date();
    const today = todayISO(now);
    const leads = [
      normalizeLead({ id: "a", schemaVersion: 2, name: "Anna", pipelineStage: "appointment_scheduled", appointmentStatus: "scheduled", appointmentDate: today, appointmentTime: "10:00", nextActionType: "none" }),
      normalizeLead({ id: "b", schemaVersion: 2, name: "Bram", pipelineStage: "partner_connected", nextActionType: "check_realtor", nextActionDate: addDaysISO(today, -3), nextActionAssignedTo: "luke", nextActionAssignedToName: "Luke" }),
      normalizeLead({ id: "c", schemaVersion: 2, name: "Cees", pipelineStage: "new_lead", sourceSubmittedAt: new Date(now.getTime() - 3600 * 1000), nextActionType: "none", leadSource: "meta_ads" }),
      normalizeLead({ id: "d", schemaVersion: 2, name: "Weg", pipelineStage: "new_lead", deletedAt: new Date(), nextActionType: "call_back", nextActionDate: today }),
    ];
    const mail = buildDigest({ leads, now, profile: PROFILES[0], crmUrl: "https://crm.example.nl" });
    expect(mail.counts).toEqual({ today: 1, late: 1, fresh: 1 });
    expect(mail.subject).toMatch(/1 vandaag, 1 te laat, 1 nieuw/);
    expect(mail.text).toMatch(/Goedemorgen Luke/);
    expect(mail.text).toMatch(/Bram – Contact met makelaar checken · Luke \(jij\)/);
    expect(mail.html).toContain("https://crm.example.nl");
    expect(mail.text).not.toMatch(/Weg/);
  });
});
