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
} from "../crm/services";
import { normalizeLead, emptyLead } from "../crm/normalize";
import { reached, reachedAt, deriveFirstHandling } from "../crm/milestones";
import { blockingErrors } from "../crm/validation";
import { buildAgendaItems } from "../crm/agenda";
import { applyFilters, DEFAULT_FILTERS } from "../crm/filters";
import { followUpStats, kpiSummary } from "../crm/analytics";
import { PROFILES, profileUser, profileNameOnly } from "../crm/profiles";
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

  test("profielkeuze toont Luke en Indy", () => {
    const pick = jest.fn();
    render(<ProfilePicker profiles={PROFILES} onPick={pick} onSignOut={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Indy/ }));
    expect(pick).toHaveBeenCalledWith("indy");
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
  test("test op Gereserveerd/Aankoop afgerond die is teruggezet telt niet meer mee", async () => {
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
