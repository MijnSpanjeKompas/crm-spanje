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
  mockAuth.current = { status: "ready", user: LUKE, authUser: { uid: "uLuke" }, signIn: jest.fn(), signOut: jest.fn(), resetPassword: jest.fn() };
  window.confirm = jest.fn(() => true);
});

test("toont inlogscherm als je niet bent ingelogd", () => {
  mockAuth.current = { status: "signed_out", signIn: jest.fn(), resetPassword: jest.fn() };
  render(<App />);
  expect(screen.getByRole("button", { name: /inloggen/i })).toBeInTheDocument();
});

test("toont geen-toegang scherm voor gebruiker zonder users-document", () => {
  mockAuth.current = { status: "no_access", authUser: { uid: "abc123", email: "x@y.nl" }, signOut: jest.fn() };
  render(<App />);
  expect(screen.getByText(/abc123/)).toBeInTheDocument();
});

test("dashboard en lijst renderen oude leads", async () => {
  render(<App />);
  expect(await cardTitle("Ewoud Kremer")).toBeTruthy();
  expect(await cardTitle("Ed en Norma Heerschap")).toBeTruthy();
  // William is 'Gestopt' (gesloten): geen kaart in de open lijst, wel een signaal
  // onder "Aandacht nodig" omdat de afsluitreden ontbreekt.
  expect(screen.getAllByText("William de Wit").filter((el) => el.tagName === "DIV")).toHaveLength(0);
  expect(screen.getByText(/Afsluitreden ontbreekt/)).toBeInTheDocument();
  expect(screen.getAllByText(/Vandaag opvolgen/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Aandacht nodig/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Gekoppeld aan partner").length).toBeGreaterThan(0);
  expect(screen.queryByText(/Geen strenge datum/i)).not.toBeInTheDocument();
});

test("leaddetail: alle tabbladen, activiteit toevoegen en opslaan (migratie)", async () => {
  render(<App />);
  fireEvent.click(await cardTitle("Ewoud Kremer"));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText(/oude CRM-versie/i)).toBeInTheDocument();

  for (const tab of ["Zoekprofiel", "Opvolging", "Partners", "Bestanden", "Details", "Activiteiten"]) {
    fireEvent.click(within(dialog).getByRole("tab", { name: new RegExp(tab) }));
  }

  // Activiteit toevoegen
  fireEvent.click(within(dialog).getByRole("button", { name: /Activiteit toevoegen/ }));
  fireEvent.change(within(dialog).getByPlaceholderText(/Wat is er besproken/), { target: { value: "Gebeld over bezoek" } });
  const outcome = within(dialog).getAllByRole("combobox").find((sel) => within(sel).queryByText("Gesproken"));
  fireEvent.change(outcome, { target: { value: "spoken" } });
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: /Activiteit opslaan/ }));
  });
  await waitFor(() => expect(within(dialog).getByText("Gebeld over bezoek")).toBeInTheDocument());
  expect(fake.__getDoc("leads/ewoud").lastContactAt).toBeInstanceOf(Date);

  // Opslaan zonder datum bij actie → validatiefout op tab Opvolging
  fireEvent.click(within(dialog).getByRole("tab", { name: /Overzicht/ }));
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: /^Opslaan$/ }));
  });
  expect(within(dialog).getByText(/Kies een datum voor de volgende actie/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Morgen" }));
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: /^Opslaan$/ }));
  });
  await waitFor(() => expect(fake.__getDoc("leads/ewoud").schemaVersion).toBe(2));
  const raw = fake.__getDoc("leads/ewoud");
  expect(raw.pipelineStage).toBe("partner_connected");
  expect(raw.naam).toBe("Ewoud Kremer"); // oud veld blijft staan
});

test("nieuwe lead met duplicaatwaarschuwing", async () => {
  render(<App />);
  await cardTitle("Ewoud Kremer");
  fireEvent.click(screen.getByRole("button", { name: /^Nieuwe lead$/ }));
  const dialog = await screen.findByRole("dialog");
  const inputs = within(dialog).getAllByRole("textbox");
  fireEvent.change(inputs[0], { target: { value: "E. Kremer" } });
  fireEvent.change(dialog.querySelector("input[type=email]"), { target: { value: "EWOUD@example.nl" } });
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: /Lead aanmaken/ }));
  });
  expect(within(dialog).getByText(/Er bestaat mogelijk al een lead/)).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: /Bestaande lead openen/ })).toBeInTheDocument();
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: /Toch nieuwe lead aanmaken/ }));
  });
  await waitFor(() => expect(screen.getByText(/Leg hier direct het eerste contact vast/)).toBeInTheDocument());
  const created = Array.from(fake.__dump().docs.entries()).find(([p, d]) => /^leads\/[^/]+$/.test(p) && d.name === "E. Kremer");
  expect(created).toBeTruthy();
  expect(created[1]).toMatchObject({ ownerId: "uLuke", pipelineStage: "new_lead", emailNormalized: "ewoud@example.nl", schemaVersion: 2 });
});

test("archiveren via kaart vraagt bevestiging en verwijdert niets", async () => {
  render(<App />);
  await cardTitle("Ed en Norma Heerschap");
  const btns = screen.getAllByTitle("Archiveren");
  await act(async () => {
    fireEvent.click(btns[0]);
  });
  expect(window.confirm).toHaveBeenCalled();
  const archived = ["ewoud", "heerschap"].map((id) => fake.__getDoc(`leads/${id}`)).filter((d) => d.archived);
  expect(archived).toHaveLength(1);
});
