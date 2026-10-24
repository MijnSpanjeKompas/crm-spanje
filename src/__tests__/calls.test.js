// Tests voor "Gesprek verwerken": teksthulpen, tegoed, en de Gesprek-tab in de UI.
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import * as fake from "../testing/fakeFirebase";
import { markdownToHtml, toWhatsApp, creditStatus, audioMeta, formatUsd } from "../crm/calls";
import { buildSystemPrompt, buildUserMessage, costUsd, OUTPUT_TOOL } from "../crm/gesprekPrompt";
import App from "../App";

jest.mock("../firebase", () => ({ db: {}, storage: {}, auth: {}, app: {} }));
jest.mock("firebase/firestore", () => require("../testing/fakeFirebase"));
jest.mock("firebase/storage", () => require("../testing/fakeFirebase"));
const mockCallable = jest.fn(() => Promise.resolve({ data: { status: "done" } }));
jest.mock("firebase/functions", () => ({ getFunctions: () => ({}), httpsCallable: () => (...args) => mockCallable(...args) }));
const mockAuth = { current: null };
jest.mock("../crm/useCrmAuth", () => ({ useCrmAuth: () => mockAuth.current }));

const LUKE = { id: "uLuke", email: "luke@msk.nl", displayName: "Luke van Spronsen", role: "admin", isAdmin: true };

describe("teksthulpen", () => {
  test("markdownToHtml escapet HTML en zet koppen, bullets en [check] om", () => {
    const html = markdownToHtml("# Titel\n\n## Budget\nMax **€300.000** [check]\n\n- tuin\n- zwembad\n\n<script>alert(1)</script>");
    expect(html).toContain("<h1>Titel</h1>");
    expect(html).toContain("<h2>Budget</h2>");
    expect(html).toContain("<strong>€300.000</strong>");
    expect(html).toContain('<mark class="check">[check]</mark>');
    expect(html).toContain("<ul><li>tuin</li><li>zwembad</li></ul>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("toWhatsApp maakt WhatsApp-opmaak", () => {
    expect(toWhatsApp("# Lead\n## Regio\nVoorkeur **Murcia**\n- tuin")).toBe("*Lead*\n*Regio*\nVoorkeur *Murcia*\n• tuin");
  });

  test("audioMeta herkent iPhone-opnames en bestanden", () => {
    expect(audioMeta("audio/mp4", "")).toEqual({ ext: "m4a", contentType: "audio/mp4" });
    expect(audioMeta("audio/x-m4a", "Opname 12.m4a")).toEqual({ ext: "m4a", contentType: "audio/x-m4a" });
    expect(audioMeta("", "gesprek.mp3")).toEqual({ ext: "mp3", contentType: "audio/mpeg" });
    expect(audioMeta("audio/webm;codecs=opus", "")).toEqual({ ext: "webm", contentType: "audio/webm" });
  });
});

describe("tegoed", () => {
  test("rekent resterend tegoed en waarschuwing uit", () => {
    const s = { creditUsd: 10, spentAtCreditSet: 2, spentUsd: 9.5, processedCount: 150, creditWarnUsd: 3 };
    const c = creditStatus(s);
    expect(c.spentSince).toBeCloseTo(7.5);
    expect(c.remainingUsd).toBeCloseTo(2.5);
    expect(c.low).toBe(true);
    expect(c.empty).toBe(false);
    expect(c.callsLeft).toBe(Math.floor(2.5 / (9.5 / 150)));
    expect(creditStatus({}).configured).toBe(false);
    expect(creditStatus({}).low).toBe(false);
    expect(formatUsd(0.0441)).toBe("$0.044");
  });

  test("kosten per gesprek: 12k in / 2k uit op Sonnet ≈ $0.044", () => {
    expect(costUsd("claude-sonnet-5-5", { input_tokens: 12000, output_tokens: 2000 })).toBeCloseTo(0.044, 5);
  });
});

describe("prompt", () => {
  test("bevat de harde regels, eigen woorden en de notitie", () => {
    const sys = buildSystemPrompt({ extraVocab: "Hondón de las Nieves\nLa Romana" });
    expect(sys).toMatch(/Niets verzinnen/);
    expect(sys).toMatch(/\[check\]/);
    expect(sys).toMatch(/verdienmodel/);
    expect(sys).toContain("Hondón de las Nieves, La Romana");
    expect(sys).toContain("Rojales");
    expect(sys).toContain("Uitgebreide samenvatting stuur ik mee.");
    const user = buildUserMessage({ naam: "Jan", telefoon: "06", zekerWeten: "budget max 350k", transcript: "hallo" });
    expect(user).toContain("budget max 350k");
    expect(user).toContain("<transcript>\nhallo\n</transcript>");
    expect(OUTPUT_TOOL.input_schema.required).toEqual(["uitgebreid", "kort", "appje", "checks", "leadtemperatuur", "leadtype"]);
  });
});

describe("Gesprek-tab", () => {
  beforeEach(() => {
    fake.__reset();
    fake.__setDoc("users/uLuke", { displayName: "Luke van Spronsen", email: "luke@msk.nl", role: "admin", active: true });
    fake.__setDoc("leads/maurice", { schemaVersion: 2, name: "Maurice van de Werd", phone: "0612345678", pipelineStage: "new", priority: "normal", leadSource: "website", archived: false, leadSummary: "" });
    window.localStorage.clear();
    window.location.hash = "#/leads";
    mockAuth.current = { status: "ready", user: LUKE, authUser: { uid: "uLuke" }, signIn: jest.fn(), signOut: jest.fn(), resetPassword: jest.fn() };
    window.confirm = jest.fn(() => true);
    mockCallable.mockImplementation(() => Promise.resolve({ data: { status: "done" } }));
  });

  async function openGesprekTab() {
    render(<App />);
    const card = (await screen.findAllByText("Maurice van de Werd")).find((el) => el.tagName === "DIV");
    fireEvent.click(card);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("tab", { name: /Gesprek/ }));
    return dialog;
  }

  test("leeg: toont opnemen/uploaden met naam en telefoon vooraf ingevuld", async () => {
    const dialog = await openGesprekTab();
    expect(within(dialog).getByRole("button", { name: /Audiobestand uploaden/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Opname starten/ })).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("Maurice van de Werd")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("0612345678")).toBeInTheDocument();
  });

  test("klaar: toont checks, 3 teksten, zet korte samenvatting in de lead en keurt goed", async () => {
    fake.__setDoc("leads/maurice/calls/c1", {
      status: "done",
      createdAt: new Date("2026-10-20T10:00:00"),
      audioPath: "leads/maurice/gesprekken/c1.m4a",
      transcript: "geheim transcript",
      costUsd: 0.05,
      result: {
        uitgebreid: "# Uitgebreide samenvatting lead – Maurice van de Werd\n\n## Situatie\nMaurice wil emigreren.",
        kort: "Maurice wil over 2,5 jaar emigreren.",
        appje: "Nieuwe lead: Maurice van de Werd. Emigratielead. Uitgebreide samenvatting stuur ik mee.",
        checks: ["Budget €350.000 of €305.000?"],
        leadtemperatuur: "warm",
        leadtype: "B&B/bedrijfsmatig",
      },
    });
    const dialog = await openGesprekTab();
    expect(await within(dialog).findByText(/Budget €350.000 of €305.000\?/)).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue(/Nieuwe lead: Maurice van de Werd/)).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: /Uitgebreide samenvatting lead/ })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /Zet in interne samenvatting/ }));
    await waitFor(() => expect(fake.__getDoc("leads/maurice").leadSummary).toBe("Maurice wil over 2,5 jaar emigreren."));

    fireEvent.click(within(dialog).getByRole("button", { name: /Goedkeuren/ }));
    await waitFor(() => expect(fake.__getDoc("leads/maurice/calls/c1").status).toBe("approved"));
    const call = fake.__getDoc("leads/maurice/calls/c1");
    expect(call.transcript).toBeUndefined();
    expect(call.audioDeleteAfter).toBeTruthy();
    expect(await within(dialog).findByText(/Goedgekeurd door Luke van Spronsen/)).toBeInTheDocument();
  });

  test("fout: toont uitleg en verwerkt opnieuw via de server", async () => {
    fake.__setDoc("leads/maurice/calls/c2", {
      status: "error",
      createdAt: new Date(),
      audioPath: "leads/maurice/gesprekken/c2.m4a",
      errorMessage: "Het Claude-tegoed is op.",
    });
    const dialog = await openGesprekTab();
    expect(await within(dialog).findByText(/Het Claude-tegoed is op/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole("button", { name: /Opnieuw verwerken/ })[0]);
    await waitFor(() => expect(mockCallable).toHaveBeenCalledWith({ leadId: "maurice", callId: "c2" }));
  });

  test("melding als het tegoed bijna op is", async () => {
    fake.__setDoc("settings/gesprekken", { creditUsd: 10, spentAtCreditSet: 0, spentUsd: 8, processedCount: 160 });
    render(<App />);
    expect(await screen.findByText(/Claude-tegoed bijna op/)).toBeInTheDocument();
  });
});
