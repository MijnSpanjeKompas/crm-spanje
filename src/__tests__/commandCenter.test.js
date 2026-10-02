// Command Center: mijlpalen, KPI-definities, agenda, notificaties en pagina's.
import { render, screen, fireEvent, within, waitFor, act } from "@testing-library/react";
import * as fake from "../testing/fakeFirebase";
import { createLead, updateLead, addActivity, addTask, addPartnerLink, backfillMilestones, subscribeAllSub } from "../crm/services";
import { normalizeLead, emptyLead } from "../crm/normalize";
import { milestonePatch, deriveMilestones, reached } from "../crm/milestones";
import { cohort, cohortFunnel, getPeriod, kpiSummary, eventCounts, groupStats, distribution, leadQuality, followUpStats, formatDuration, commissionSummary, ratio, change } from "../crm/analytics";
import { buildAgendaItems, itemsInRange, overdueItems, buildNotifications } from "../crm/agenda";
import { isSuccessfulContact } from "../crm/constants";
import { todayISO, addDaysISO } from "../crm/dates";
import App from "../App";

jest.mock("../firebase", () => ({ db: {}, storage: {}, auth: {} }));
jest.mock("firebase/firestore", () => require("../testing/fakeFirebase"));
jest.mock("firebase/storage", () => require("../testing/fakeFirebase"));
const mockAuth = { current: null };
jest.mock("../crm/useCrmAuth", () => ({ useCrmAuth: () => mockAuth.current }));

const LUKE = { id: "uLuke", email: "luke@msk.nl", displayName: "Luke van Spronsen", isAdmin: true };
const read = (id) => normalizeLead({ id, ...fake.__getDoc(`leads/${id}`) });

beforeEach(() => {
  fake.__reset();
  fake.__setDoc("users/uLuke", { displayName: "Luke van Spronsen", email: "luke@msk.nl", role: "admin", active: true });
  window.localStorage.clear();
});

describe("mijlpalen", () => {
  test("worden bij de eerste overgang gezet en nooit overschreven", async () => {
    const id = await createLead({ ...emptyLead(LUKE), name: "A", email: "a@x.nl", consentStatus: "yes" }, LUKE);
    let lead = read(id);
    expect(lead.firstContactAt).toBeNull();

    await addActivity(lead, { type: "phone_call", outcome: "spoken", title: "Gebeld" }, LUKE);
    lead = read(id);
    expect(lead.firstContactAt).toBeInstanceOf(Date);
    const firstContact = lead.firstContactAt.getTime();

    await updateLead(lead, { ...lead, pipelineStage: "partner_connected" }, LUKE);
    lead = read(id);
    const forwarded = lead.firstForwardedAt.getTime();
    // Terug en weer vooruit: eerste datum blijft staan
    await updateLead(lead, { ...lead, pipelineStage: "contact_phase" }, LUKE);
    lead = read(id);
    await updateLead(lead, { ...lead, pipelineStage: "partner_connected" }, LUKE);
    lead = read(id);
    expect(lead.firstForwardedAt.getTime()).toBe(forwarded);
    expect(lead.firstContactAt.getTime()).toBe(firstContact);

    await updateLead(lead, { ...lead, pipelineStage: "purchase_process", reservedAt: "2026-09-20" }, LUKE);
    lead = read(id);
    expect(lead.firstReservedAt.getMonth()).toBe(8); // gecorrigeerde reserveringsdatum
  });

  test("afleiden uit bestaande tijdlijn verzint niets", () => {
    const lead = normalizeLead({ id: "x", schemaVersion: 2, name: "X", pipelineStage: "partner_connected" });
    const acts = [
      { type: "phone_call", outcome: "no_answer", occurredAt: new Date(2026, 7, 1) },
      { type: "whatsapp", outcome: "spoken", occurredAt: new Date(2026, 7, 3) },
      { type: "system", metadata: { field: "pipelineStage", from: "contact_phase", to: "partner_connected" }, occurredAt: new Date(2026, 7, 10) },
    ];
    const patch = deriveMilestones(lead, acts, isSuccessfulContact);
    expect(patch.firstContactAt.getDate()).toBe(3);
    expect(patch.firstForwardedAt.getDate()).toBe(10);
    expect(patch.firstReservedAt).toBeUndefined();
    expect(patch.purchaseCompletedAt).toBeUndefined();
    expect(milestonePatch({ pipelineStage: "x", firstForwardedAt: new Date(1) }, { pipelineStage: "partner_connected" })).toEqual({});
  });

  test("backfill vult alleen lege mijlpalen en logt wat er gebeurde", async () => {
    fake.__setDoc("leads/old", { schemaVersion: 2, name: "Oud", email: "o@x.nl", pipelineStage: "partner_connected" });
    fake.__setDoc("leads/old/activities/a1", { type: "system", metadata: { field: "pipelineStage", to: "partner_connected" }, occurredAt: new Date(2026, 5, 1) });
    const dry = await backfillMilestones([read("old")], LUKE, { dryRun: true });
    expect(dry).toMatchObject({ leads: 1, updated: 1, fields: { firstForwardedAt: 1 } });
    expect(fake.__getDoc("leads/old").firstForwardedAt).toBeUndefined();
    await backfillMilestones([read("old")], LUKE);
    expect(fake.__getDoc("leads/old").firstForwardedAt.getMonth()).toBe(5);
  });
});

describe("KPI-definities", () => {
  const sep = new Date(2026, 8, 15);
  const lead = (id, created, extra = {}) => normalizeLead({ id, schemaVersion: 2, name: id, createdAt: created, leadSource: "meta_ads", ...extra });
  const leads = [
    lead("juni", new Date(2026, 5, 3), { pipelineStage: "completed", purchaseCompletedAt: new Date(2026, 8, 5), firstForwardedAt: new Date(2026, 6, 1), saleDate: "2026-09-05", commissionStatus: "expected", commissionExpectedAmount: 5000 }),
    lead("sep1", new Date(2026, 8, 2), { firstContactAt: new Date(2026, 8, 3), firstContactAttemptAt: new Date(2026, 8, 2, 3), pipelineStage: "contact_phase", utmCampaign: "C1", purchaseTimeline: "3_to_6_months", budgetMax: 250000 }),
    lead("sep2", new Date(2026, 8, 9), { pipelineStage: "new_lead", leadSource: "google_organic", regions: ["costa_calida"], purchaseTimeline: "over_12_months" }),
    // Gesprek gevoerd zonder geregistreerd contact: mag de funnel niet laten "stijgen"
    lead("sep3", new Date(2026, 8, 10), { appointmentStatus: "completed", appointmentDate: "2026-09-12" }),
    // Via Sheet: aangemaakt (import) in oktober, maar binnengekomen in september
    lead("sheet", new Date(2026, 9, 2), { sourceSubmittedAt: new Date(2026, 8, 20), pipelineStage: "partner_connected" }),
  ];
  const p = getPeriod("month", sep);

  test("cohort op binnenkomst; funnel is altijd aflopend", () => {
    const c = cohort(leads, p);
    expect(c.map((l) => l.id).sort()).toEqual(["sep1", "sep2", "sep3", "sheet"]);
    const f = cohortFunnel(c);
    const counts = f.stages.map((s) => s.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a)); // nooit stijgend
    expect(f.stages.find((s) => s.key === "contact").count).toBe(3); // sep1 + gesprek (sep3) + doorgestuurd (sheet)
    expect(f.stages.map((s) => s.key)).toEqual(["contact", "forwarded", "reserved", "purchased"]); // 4 heldere stappen
    expect(f.stages[0].implied).toBe(2); // gesprek zonder los contact (sep3) en doorgestuurd zonder contact (sheet) tellen toch als contact gehad
    expect(f.stages[1].prevCount).toBe(3); // "x van de 3 die we spraken"
    const k = kpiSummary(c);
    expect(k.contact).toEqual({ count: 3, total: 4, pct: 0.75 });
    expect(k.purchased.count).toBe(0); // aankoop van juni-lead telt niet in het sep-cohort…
    expect(eventCounts(leads, p).purchased).toBe(1); // …wel als gebeurtenis in september
  });

  test("bronnen met Onbekend-rij, verdelingen, kwaliteit en opvolging", () => {
    const c = cohort(leads, p);
    const rows = groupStats(c, "campaign");
    expect(rows[rows.length - 1]).toMatchObject({ label: "Onbekend", leads: 3 });
    expect(rows[0]).toMatchObject({ label: "C1", leads: 1 });
    expect(distribution(c, "timeline").find((r) => r.key === "3_6").value).toBe(1);
    expect(distribution(c, "budget").find((r) => r.key === "unknown").value).toBe(3);
    const q = leadQuality(c);
    expect(q.shortTerm).toEqual({ count: 1, total: 2, pct: 0.5 });
    expect(q.avgBudgetMax).toBe(250000);
    const fu = followUpStats(c, leads, new Date(2026, 9, 1));
    expect(fu.sample).toBeGreaterThanOrEqual(1);
    expect(formatDuration(3 * 3600 * 1000 + 18 * 60000)).toBe("3u 18m");
    expect(commissionSummary(leads, p)).toMatchObject({ expected: 5000, outstanding: 5000, completedDeals: 1, purchasesInPeriod: 1 });
    expect(ratio(0, 0).pct).toBeNull(); // nooit NaN%
    expect(change(12, 10)).toMatchObject({ text: "↑ 20%" });
    expect(change(0.5, 0.4, { asRate: true })).toMatchObject({ text: "↑ 10 pp" });
    expect(reached(leads[0], "forwarded")).toBe(true);
  });
});

describe("agenda en notificaties", () => {
  test("combineert gesprekken, follow-ups, taken en partneropvolging", () => {
    const today = todayISO();
    const leads = [
      normalizeLead({ id: "a", schemaVersion: 2, name: "Rory", appointmentStatus: "scheduled", appointmentDate: today, appointmentTime: "11:00", appointmentType: "video", nextActionType: "follow_up_whatsapp", nextActionDate: addDaysISO(today, -2) }),
      normalizeLead({ id: "b", schemaVersion: 2, name: "Marije", nextActionType: "call_back", nextActionDate: today }),
    ];
    const tasks = [{ id: "t1", leadId: "b", status: "open", dueDate: today, title: "Bewijs opvragen" }];
    const links = [{ id: "k1", leadId: "a", partnerId: "p1", partnerName: "Costa Homes", status: "sent", nextFollowUpAt: addDaysISO(today, -1) }];
    const items = buildAgendaItems({ leads, tasks, links });
    expect(items.map((i) => i.type).sort()).toEqual(["followup", "followup", "meeting", "partner", "task"]);
    expect(itemsInRange(items, today, today).map((i) => i.leadName).sort()).toEqual(["Marije", "Marije", "Rory"]);
    expect(overdueItems(items, today).map((i) => i.type).sort()).toEqual(["followup", "partner"]);
    const notes = buildNotifications({ leads, tasks, links });
    expect(notes[0].severity).toBe("high");
    expect(notes.map((n) => n.kind)).toEqual(expect.arrayContaining(["followup_overdue", "partner_overdue", "task_today", "meeting", "new_lead"]));
  });

  test("collection group levert taken en koppelingen van alle leads", async () => {
    const id = await createLead({ ...emptyLead(LUKE), name: "B", email: "b@x.nl", consentStatus: "yes" }, LUKE);
    await addTask(read(id), { title: "Taak", dueDate: todayISO(), assignedToUserId: "uLuke", assignedToName: "Luke", priority: "normal" }, LUKE);
    fake.__setDoc("partners/p1", { name: "Costa Homes", type: "realtor", active: true });
    await addPartnerLink(read(id), { id: "p1", name: "Costa Homes", type: "realtor" }, { status: "sent" }, LUKE);
    let tasks = [];
    let links = [];
    subscribeAllSub("tasks", (d) => (tasks = d));
    subscribeAllSub("partnerLinks", (d) => (links = d));
    expect(tasks).toHaveLength(1);
    expect(tasks[0].leadId).toBe(id);
    expect(links[0]).toMatchObject({ leadId: id, partnerId: "p1" });
  });
});

describe("Command Center UI", () => {
  beforeEach(() => {
    mockAuth.current = { status: "ready", user: LUKE, authUser: { uid: "uLuke" }, signIn: jest.fn(), signOut: jest.fn(), resetPassword: jest.fn() };
    window.confirm = jest.fn(() => true);
    fake.__setDoc("partners/p1", { name: "Costa Homes", type: "realtor", active: true });
    fake.__setDoc("leads/rory", { schemaVersion: 2, name: "Rory de Leon", phone: "+31 6 12345678", email: "rory@x.nl", places: ["Moraira"], pipelineStage: "partner_connected", partnerIds: ["p1"], partnerNames: ["Costa Homes"], appointmentStatus: "scheduled", appointmentDate: todayISO(), appointmentTime: "11:00", appointmentType: "video", nextActionType: "call_back", nextActionDate: addDaysISO(todayISO(), -1), createdAt: new Date() });
    fake.__setDoc("leads/rory/partnerLinks/k1", { partnerId: "p1", partnerName: "Costa Homes", partnerType: "realtor", status: "sent", linkedAt: new Date(), nextFollowUpAt: todayISO() });
  });

  test("navigatie, universeel zoeken, notificaties, agenda, KPI's en partners", async () => {
    window.location.hash = "#/dashboard";
    window.localStorage.setItem("msk:uLuke:sidebarCollapsed", "false");
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Hoofdnavigatie" });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent.replace(/\d+$/, ""))).toEqual(
      expect.arrayContaining(["Dashboard", "Leads", "Agenda", "KPI's", "Partners", "Commissies", "Instellingen", "Help / handleiding"])
    );
    // Dashboard: gesprek vandaag + achterstallig
    expect(await screen.findByText(/Dit vraagt vandaag je aandacht/)).toBeInTheDocument();

    // Universeel zoeken op plaats → dossier
    fireEvent.change(screen.getByRole("combobox", { name: "Universeel zoeken" }), { target: { value: "moraira" } });
    fireEvent.click(await screen.findByRole("option", { name: /Rory de Leon/ }));
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Rory de Leon" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Sluiten" })[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // Notificaties met badge
    const bell = screen.getByRole("button", { name: /Notificaties \(\d+ ongelezen\)/ });
    fireEvent.click(bell);
    expect(screen.getByText("Opvolgactie verlopen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Alles als gelezen markeren/ }));
    expect(screen.getByRole("button", { name: "Notificaties" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Notificaties" }));
    expect(screen.queryByRole("dialog", { name: "Notificaties" })).not.toBeInTheDocument();

    // Agenda
    fireEvent.click(within(nav).getByRole("button", { name: /Agenda/ }));
    expect(await screen.findByRole("heading", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getAllByText("Rory de Leon").length).toBeGreaterThan(0);
    const views = screen.getByRole("group", { name: "Weergave" });
    fireEvent.click(within(views).getByRole("button", { name: "Maand" }));
    fireEvent.click(within(views).getByRole("button", { name: "Vandaag" }));
    expect(screen.getAllByText("Rory de Leon").length).toBeGreaterThan(0);

    // KPI's
    fireEvent.click(within(nav).getByRole("button", { name: /KPI's/ }));
    expect(await screen.findByRole("heading", { name: "Van lead tot aankoop" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Waar komen de beste leads vandaan?" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Periode" })).toHaveValue("all"); // standaard: Altijd
    expect(screen.getByText(/Alles sinds/)).toBeInTheDocument();
    expect(screen.queryByText(/Vergelijk met vorige periode/)).not.toBeInTheDocument(); // niet bij Altijd

    // Partners → dossier
    fireEvent.click(within(nav).getByRole("button", { name: /Partners/ }));
    fireEvent.click(await screen.findByText("Costa Homes"));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Actieve leads \(1\)/)).toBeInTheDocument();
  });

  test("statuswijziging via fasebadge: doorsturen zonder gegevens opent dossier met ontbrekende velden", async () => {
    fake.__setDoc("leads/nieuw", { schemaVersion: 2, name: "Nieuwe Nina", email: "n@x.nl", pipelineStage: "new_lead", nextActionType: "call_back", nextActionDate: "2099-01-01" });
    window.location.hash = "#/leads";
    render(<App />);
    const sel = await screen.findByRole("combobox", { name: /Pipelinefase van Nieuwe Nina wijzigen/ });
    await act(async () => {
      fireEvent.change(sel, { target: { value: "partner_connected" } });
    });
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByText(/Vul eerst deze gegevens aan voordat de lead kan worden doorgestuurd/).length).toBeGreaterThan(0);
    expect(fake.__getDoc("leads/nieuw").pipelineStage).toBe("new_lead");
    // Oude leads op "Contactfase" worden als Nieuwe lead gelezen
    expect(normalizeLead({ id: "c", schemaVersion: 2, name: "C", pipelineStage: "contact_phase" }).pipelineStage).toBe("new_lead");
  });
});

describe("kwalificatie, contactpoging en click-through", () => {
  test("poging ≠ contact; kwalificatie zet qualifiedAt en wordt gelogd", async () => {
    const id = await createLead({ ...emptyLead(LUKE), name: "Q", email: "q@x.nl", consentStatus: "yes" }, LUKE);
    await addActivity(read(id), { type: "phone_call", outcome: "no_answer", title: "Niet opgenomen" }, LUKE);
    let lead = read(id);
    expect(lead.firstContactAttemptAt).toBeInstanceOf(Date);
    expect(lead.firstContactAt).toBeNull();
    await updateLead(lead, { ...lead, qualificationStatus: "qualified" }, LUKE);
    lead = read(id);
    expect(lead.qualifiedAt).toBeInstanceOf(Date);
    const acts = Array.from(fake.__dump().docs.entries()).filter(([p]) => p.startsWith(`leads/${id}/activities/`)).map(([, d]) => d.title);
    expect(acts).toContain("Kwalificatie: Gekwalificeerd");
    // Oude afsluitreden "niet gekwalificeerd" wordt als zodanig gelezen
    expect(normalizeLead({ id: "o", schemaVersion: 2, name: "O", pipelineStage: "stopped", closureReason: "not_qualified" }).qualificationStatus).toBe("unqualified");
  });

  test("klik op KPI opent Leads gefilterd op cohort en stap", async () => {
    mockAuth.current = { status: "ready", user: LUKE, authUser: { uid: "uLuke" }, signIn: jest.fn(), signOut: jest.fn(), resetPassword: jest.fn() };
    fake.__setDoc("leads/fw", { schemaVersion: 2, name: "Doorgestuurde Dirk", email: "d@x.nl", pipelineStage: "partner_connected", createdAt: new Date(), nextActionType: "call_back", nextActionDate: "2099-01-01" });
    fake.__setDoc("leads/nw", { schemaVersion: 2, name: "Nieuwe Noor", email: "n@x.nl", pipelineStage: "new_lead", createdAt: new Date(), nextActionType: "call_back", nextActionDate: "2099-01-01" });
    window.location.hash = "#/kpis";
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /^Doorgestuurd: 1\. Toon deze leads/ }));
    expect(await screen.findByText(/Uit KPI's/)).toBeInTheDocument();
    expect(screen.getAllByText("Doorgestuurde Dirk").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Nieuwe Noor").filter((el) => el.tagName === "DIV")).toHaveLength(0);
  });
});
