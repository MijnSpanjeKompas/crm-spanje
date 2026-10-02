// UI-rooktest: de hele app rendert met (oude) productiedata, de leaddetail
// opent met alle tabbladen en de belangrijkste handelingen werken via de UI.
import { render, screen, fireEvent, within, waitFor, act } from "@testing-library/react";
import * as fake from "./testing/fakeFirebase";
import App from "./App";

jest.mock("./firebase", () => ({ db: {}, storage: {}, auth: {} }));
jest.mock("firebase/firestore", () => require("./testing/fakeFirebase"));
jest.mock("firebase/storage", () => require("./testing/fakeFirebase"));

const mockAuth = { current: null };
jest.mock("./crm/useCrmAuth", () => ({ useCrmAuth: () => mockAuth.current }));

const LUKE = { id: "uLuke", email: "luke@msk.nl", displayName: "Luke van Spronsen", role: "admin", isAdmin: true };

function seed() {
  fake.__reset();
  fake.__setDoc("users/uLuke", { displayName: "Luke van Spronsen", email: "luke@msk.nl", role: "admin", active: true });
  fake.__setDoc("users/uIndy", { displayName: "Indy Klijn", email: "indy@msk.nl", role: "admin", active: true });
  fake.__setDoc("leads/ewoud", { naam: "Ewoud Kremer", email: "ewoud@example.nl", status: "Doorgegeven", leadscore: "Hot lead", leadbron: "Meta Ads", volgendeActie: "Doorgeven", geenStrengeDatum: true, tags: ["Emigratie"], doelAankoop: "Emigratie", budget: "Anders, namelijk...", startdatum: "2026-09-01" });
  fake.__setDoc("leads/william", { naam: "William de Wit", telefoon: "0687654321", regio: "Costa Calida", status: "Niet doorgegaan", leadscore: "Koude lead", leadbron: "Meta Ads", volgendeActie: "Geen directe actie", budget: "Tot € 200.000", doelAankoop: "Emigratie" });
  fake.__setDoc("leads/heerschap", { naam: "Ed en Norma Heerschap", email: "heerschap@example.nl", regio: "Valencia", status: "Doorgegeven", leadscore: "Warm lead", leadbron: "Website", volgendeActie: "Later opnieuw benaderen", geenStrengeDatum: true, budget: "€ 200.000 – € 300.000", doelAankoop: "Emigratie" });
}

async function cardTitle(name) {
  const els = await screen.findAllByText(name);
  return els.find((el) => el.tagName === "DIV");
}

beforeEach(() => {
  seed();
  window.localStorage.clear();
  window.location.hash = "#/leads";
  mockAuth.current = { status: "ready", user: LUKE, authUser: { uid: "uLuke" }, signIn: jest.fn(), signOut: jest.fn(), resetPassword: jest.fn() };
  window.confirm = jest.fn(() => true);
});

test("toont inlogscherm als je niet bent ingelogd", () => {
  mockAuth.current = { status: "signed_out", signIn: jest.fn(), resetPassword: jest.fn() };
  render(<App />);
  expect(screen.getByRole("button", { name: /inloggen/i })).toBeInTheDocument();
});

test("leads-pagina en dashboard renderen oude leads, zonder dubbele KPI's", async () => {
  render(<App />);
  expect(await cardTitle("Ewoud Kremer")).toBeTruthy();
  expect(await cardTitle("Ed en Norma Heerschap")).toBeTruthy();
  // William is 'Gestopt' (gesloten): geen kaart in de open lijst.
  expect(screen.queryAllByText("William de Wit").filter((el) => el.tagName === "DIV")).toHaveLength(0);
  expect(screen.getAllByText("Doorgestuurd").length).toBeGreaterThan(0);
  // Leads-pagina: geen dashboard-KPI's, geen Partners-/Commissiesknoppen in de kop
  expect(screen.queryByText(/Vandaag opvolgen/i)).not.toBeInTheDocument();
  expect(within(screen.getByRole("main")).queryByRole("button", { name: /^Commissies$/ })).not.toBeInTheDocument();

  // Navigatie naar Dashboard
  fireEvent.click(within(screen.getByRole("navigation", { name: "Hoofdnavigatie" })).getByRole("button", { name: /Dashboard/ }));
  expect(await screen.findByText(/Goede(morgen|middag|navond)/)).toBeInTheDocument();
  expect(screen.getAllByText(/Vandaag opvolgen/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/Recent binnengekomen/)).toBeInTheDocument();
  expect(screen.queryByText(/Afsluitreden ontbreekt/)).not.toBeInTheDocument();
});

test("leaddossier: nieuwe tabs, tijdlijn en autosave (migratie)", async () => {
  render(<App />);
  fireEvent.click(await cardTitle("Ewoud Kremer"));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText(/oude CRM-versie/i)).toBeInTheDocument();

  // Exact deze tabs, geen Details meer, geen Opslaan-knop
  expect(within(dialog).getAllByRole("tab").map((t) => t.textContent.replace(/\d+$/, ""))).toEqual(["Overzicht", "Zoekprofiel", "Opvolging", "Tijdlijn", "Partners", "Bestanden"]);
  expect(within(dialog).queryByRole("button", { name: /^Opslaan$/ })).not.toBeInTheDocument();
  for (const tab of ["Zoekprofiel", "Opvolging", "Partners", "Bestanden", "Tijdlijn"]) {
    fireEvent.click(within(dialog).getByRole("tab", { name: new RegExp(tab) }));
  }

  // Tijdlijn: + Activiteit → Telefoongesprek
  fireEvent.click(within(dialog).getByRole("button", { name: /^Activiteit$/ }));
  fireEvent.click(within(dialog).getByRole("menuitem", { name: /Telefoongesprek/ }));
  fireEvent.change(within(dialog).getByPlaceholderText(/Wat is er besproken/), { target: { value: "Gebeld over bezoek" } });
  const outcome = within(dialog).getAllByRole("combobox").find((sel) => within(sel).queryByText("Gesproken"));
  fireEvent.change(outcome, { target: { value: "spoken" } });
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: /Activiteit opslaan/ }));
  });
  await waitFor(() => expect(within(dialog).getByText("Gebeld over bezoek")).toBeInTheDocument());
  expect(fake.__getDoc("leads/ewoud").lastContactAt).toBeInstanceOf(Date);

  // Autosave: samenvatting typen. De volgende actie mist nog een datum → niet opgeslagen, met uitleg.
  fireEvent.click(within(dialog).getByRole("tab", { name: /Overzicht/ }));
  fireEvent.change(within(dialog).getByPlaceholderText(/Wil samen met partner/), { target: { value: "Wil emigreren, woning moet eerst verkocht." } });
  await waitFor(() => expect(within(dialog).getByText(/Nog niet opgeslagen/)).toBeInTheDocument(), { timeout: 3000 });
  expect(fake.__getDoc("leads/ewoud").schemaVersion).toBeUndefined();

  // Datum kiezen via Opvolging → wordt direct opgeslagen, samen met de samenvatting
  fireEvent.click(within(dialog).getByRole("button", { name: /naar Opvolging/ }));
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: "Morgen" }));
  });
  await waitFor(() => expect(fake.__getDoc("leads/ewoud").schemaVersion).toBe(2), { timeout: 3000 });
  const raw = fake.__getDoc("leads/ewoud");
  expect(raw.leadSummary).toBe("Wil emigreren, woning moet eerst verkocht.");
  expect(raw.pipelineStage).toBe("partner_connected");
  expect(raw.naam).toBe("Ewoud Kremer"); // oud veld blijft staan
  await waitFor(() => expect(within(dialog).getByText(/Opgeslagen/)).toBeInTheDocument());

  // Systeemactiviteiten zijn traceerbaar: wie (actorType/actorId) en wat (actionType)
  const acts = Array.from(fake.__dump().docs.entries()).filter(([p]) => p.startsWith("leads/ewoud/activities/")).map(([, d]) => d);
  expect(acts.length).toBeGreaterThan(0);
  acts.forEach((a) => expect(a).toMatchObject({ actorType: "human", actorId: "uLuke" }));
  expect(acts.every((a) => a.actionType)).toBe(true);
});

test("nieuwe lead met duplicaatwaarschuwing", async () => {
  render(<App />);
  await cardTitle("Ewoud Kremer");
  fireEvent.click(screen.getByRole("button", { name: /^Nieuwe lead$/ }));
  const dialog = await screen.findByRole("dialog");
  const inputs = within(dialog).getAllByRole("textbox");
  fireEvent.change(inputs[0], { target: { value: "E. Kremer" } });
  fireEvent.change(dialog.querySelector("input[type=email]"), { target: { value: "EWOUD@example.nl" } });
  // Zonder expliciete toestemmingskeuze kan de lead niet worden aangemaakt
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: /Lead aanmaken/ }));
  });
  expect(within(dialog).getAllByText(/toestemming voor contact/i).length).toBeGreaterThan(0);
  const consent = within(dialog).getAllByRole("combobox").find((sel) => within(sel).queryByText("Onbekend") && within(sel).queryByText("Kies..."));
  fireEvent.change(consent, { target: { value: "unknown" } });
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: /Lead aanmaken/ }));
  });
  expect(within(dialog).getByText(/Er bestaat mogelijk al een lead/)).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: /Bestaande lead openen/ })).toBeInTheDocument();
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: /Toch nieuwe lead aanmaken/ }));
  });
  await waitFor(() => expect(screen.getByText(/Wijzigingen worden vanaf nu automatisch opgeslagen/)).toBeInTheDocument());
  const created = Array.from(fake.__dump().docs.entries()).find(([p, d]) => /^leads\/[^/]+$/.test(p) && d.name === "E. Kremer");
  expect(created).toBeTruthy();
  expect(created[1]).toMatchObject({ ownerId: "uLuke", pipelineStage: "new_lead", emailNormalized: "ewoud@example.nl", schemaVersion: 2 });
});

test("archiveren via kaart vraagt bevestiging en verwijdert niets", async () => {
  render(<App />);
  await cardTitle("Ed en Norma Heerschap");
  fireEvent.click(screen.getAllByRole("button", { name: /Meer acties voor/ })[0]);
  await act(async () => {
    fireEvent.click(screen.getByRole("menuitem", { name: /Archiveren/ }));
  });
  expect(window.confirm).toHaveBeenCalled();
  const archived = ["ewoud", "heerschap"].map((id) => fake.__getDoc(`leads/${id}`)).filter((d) => d.archived);
  expect(archived).toHaveLength(1);
});

test("verwijderen via kaart: na bevestiging is de lead echt weg, zonder bevestiging niet", async () => {
  render(<App />);
  await cardTitle("Ed en Norma Heerschap");
  window.confirm = jest.fn(() => false);
  fireEvent.click(screen.getAllByRole("button", { name: /Meer acties voor/ })[0]);
  await act(async () => {
    fireEvent.click(screen.getByRole("menuitem", { name: /Lead verwijderen/ }));
  });
  expect(["ewoud", "heerschap"].every((id) => fake.__getDoc(`leads/${id}`))).toBe(true);

  window.confirm = jest.fn(() => true);
  fireEvent.click(screen.getAllByRole("button", { name: /Meer acties voor/ })[0]);
  await act(async () => {
    fireEvent.click(screen.getByRole("menuitem", { name: /Lead verwijderen/ }));
  });
  await waitFor(() => expect(["ewoud", "heerschap"].filter((id) => fake.__getDoc(`leads/${id}`))).toHaveLength(1));
});

test("Aankoop afgerond: vastleggen en terugzien onder Commissies", async () => {
  fake.__setDoc("partners/p1", { name: "Costa Homes", type: "realtor", active: true });
  fake.__setDoc("leads/devos", { schemaVersion: 2, name: "Jan de Vos", email: "jan@devos.nl", pipelineStage: "purchase_process", nextActionType: "follow_up_lead", nextActionDate: "2099-01-01", partnerIds: ["p1"], partnerNames: ["Costa Homes"] });
  render(<App />);
  await cardTitle("Jan de Vos");
  fireEvent.click(screen.getByRole("button", { name: /Meer acties voor Jan de Vos/ }));
  fireEvent.click(screen.getByRole("menuitem", { name: /Aankoop afgerond vastleggen/ }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByPlaceholderText(/Calle del Mar/), { target: { value: "Calle del Mar 12" } });
  fireEvent.change(within(dialog).getByPlaceholderText(/245000/), { target: { value: "250000" } });
  const status = within(dialog).getAllByRole("combobox").find((sel) => within(sel).queryByText("Verwacht"));
  fireEvent.change(status, { target: { value: "expected" } });
  const commission = within(dialog).getAllByRole("spinbutton")[1];
  fireEvent.change(commission, { target: { value: "7500" } });
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: /Aankoop opslaan/ }));
  });
  await waitFor(() => expect(fake.__getDoc("leads/devos").pipelineStage).toBe("completed"));
  expect(fake.__getDoc("leads/devos")).toMatchObject({ salePrice: 250000, saleCommission: 7500, commissionExpectedAmount: 7500, commissionStatus: "expected", commissionPartnerId: "p1", saleProperty: "Calle del Mar 12" });
  expect(fake.__getDoc("leads/devos").purchaseCompletedAt).toBeInstanceOf(Date);

  // Commissies-pagina via de hoofdnavigatie
  fireEvent.click(within(screen.getByRole("navigation", { name: "Hoofdnavigatie" })).getByRole("button", { name: /Commissies/ }));
  const main = screen.getByRole("main");
  expect(await within(main).findByRole("button", { name: "Jan de Vos" })).toBeInTheDocument();
  expect(within(main).getAllByText("€ 7.500").length).toBeGreaterThan(0);
});

test("tabbladen per pipelinefase filteren de lijst", async () => {
  fake.__setDoc("leads/a1", { schemaVersion: 2, name: "Anna Doorgestuurd", email: "a@a.nl", pipelineStage: "partner_connected", nextActionType: "check_realtor", nextActionDate: "2099-01-01" });
  fake.__setDoc("leads/a2", { schemaVersion: 2, name: "Bert Nieuw", email: "b@b.nl", pipelineStage: "new_lead", nextActionType: "first_contact", nextActionDate: "2099-01-01" });
  render(<App />);
  await cardTitle("Anna Doorgestuurd");
  expect(await cardTitle("Bert Nieuw")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: /^Doorgestuurd/ }));
  await waitFor(() => expect(screen.queryAllByText("Bert Nieuw").filter((el) => el.tagName === "DIV")).toHaveLength(0));
  expect(await cardTitle("Anna Doorgestuurd")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: /^Alle open/ }));
  expect(await cardTitle("Bert Nieuw")).toBeTruthy();
});

test("import uit Google Sheet: nieuwe lead, daarna geen dubbele bij tweede import", async () => {
  const csv = [
    "Submission ID,Submission time,name,Telefoonnummer,email,region,max_budget,aankooptijd,utm_source,utm_medium,form_source,toestemming,pdf_url,pdf_sent",
    'sub-77,2026-10-01 19:14,Rory de Leon,31657968628,rory@example.com,Costa Cálida,"0 - 200.000",Binnen 3-6 maanden,fb,paid_social,Website,Ja,https://drive.google.com/x,TRUE',
  ].join("\n");
  render(<App />);
  await cardTitle("Ewoud Kremer");
  fireEvent.click(screen.getByRole("button", { name: /Importeren/ }));
  let dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Rijen uit de Sheet"), { target: { value: csv } });
  expect(within(dialog).getByText("Nieuw: 1")).toBeInTheDocument();
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: /1 lead importeren/ }));
  });
  await waitFor(() => expect(within(dialog).getByText(/geïmporteerd/)).toBeInTheDocument());

  const created = Array.from(fake.__dump().docs.entries()).find(([p, d]) => /^leads\/[^/]+$/.test(p) && d.sourceSubmissionId === "sub-77");
  expect(created[1]).toMatchObject({ name: "Rory de Leon", phone: "+31 6 57968628", phoneNormalized: "31657968628", budgetMax: 200000, regions: ["costa_calida"], leadSource: "meta_ads", consentContact: true, purchaseTimeline: "3_to_6_months" });
  expect(created[1].searchProfilePdf).toMatchObject({ url: "https://drive.google.com/x", sent: true });
  const act1 = Array.from(fake.__dump().docs.entries()).find(([p]) => p.startsWith(`${created[0]}/activities/`))[1];
  expect(act1).toMatchObject({ actorType: "system", actorId: "sheets_import", actionType: "lead_imported" });

  // Zelfde rij opnieuw → "Bestaat al", niets te importeren
  fireEvent.change(within(dialog).getByLabelText("Rijen uit de Sheet"), { target: { value: csv } });
  await waitFor(() => expect(within(dialog).getByText("Bestaat al: 1")).toBeInTheDocument());
  expect(within(dialog).getByRole("button", { name: /0 leads importeren/ })).toBeDisabled();
});
