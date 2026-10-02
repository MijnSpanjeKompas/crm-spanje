import { useState } from "react";
import { MILESTONES } from "../../crm/constants";
import { backfillMilestones } from "../../crm/services";
import { Card, InfoRow, Notice, Icon, btnStyle, C } from "../ui";
import { PageHeader } from "../shell/AppShell";

/** Instellingen: account, voorkeuren en databeheer. */
export function SettingsPage({ user, leads, view, setView, onImport, onResetNotifications }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const label = (k) => MILESTONES.find((m) => m.key === k)?.label || k;

  async function run(dryRun) {
    setBusy(true);
    setError("");
    try {
      const res = await backfillMilestones(leads, user, { dryRun });
      if (dryRun) setPreview(res);
      else {
        setResult(res);
        setPreview(null);
      }
    } catch (e) {
      setError(e.message || "Mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Instellingen" subtitle="Account, voorkeuren en databeheer." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", gap: 16, alignItems: "start" }}>
        <Card icon="user" title="Account">
          <InfoRow label="Naam">{user.displayName}</InfoRow>
          <InfoRow label="E-mail">{user.email}</InfoRow>
          <InfoRow label="Rol">{user.isAdmin ? "Beheerder" : "Medewerker"}</InfoRow>
        </Card>
        <Card icon="cog" title="Voorkeuren">
          <InfoRow
            label="Leadweergave"
            action={
              <select value={view} onChange={(e) => setView(e.target.value)} aria-label="Leadweergave" style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 30px 5px 10px", fontFamily: "inherit" }}>
                <option value="kaarten">Kaarten</option>
                <option value="tabel">Tabel</option>
              </select>
            }
          >
            Wordt per gebruiker onthouden
          </InfoRow>
          <InfoRow label="Notificaties" action={<button type="button" onClick={onResetNotifications} style={btnStyle("neutral")}>Opnieuw tonen</button>}>
            Gelezen-status wissen
          </InfoRow>
        </Card>
        <Card icon="upload" title="Import">
          <div style={{ fontSize: 13, color: C.textBody, marginBottom: 10 }}>Leads uit de Google Sheet importeren. Bestaande Submission ID's worden overgeslagen.</div>
          <button type="button" onClick={onImport} style={btnStyle("primary", true)}>
            <Icon name="upload" size={14} /> Importeren
          </button>
        </Card>
        <Card icon="chart" title="Mijlpalen afleiden (eenmalig)">
          <div style={{ fontSize: 13, color: C.textBody, lineHeight: 1.6, marginBottom: 10 }}>
            Voor KPI's over het verleden: leest de tijdlijn van bestaande leads en vult alleen lege mijlpalen (eerste contact, doorgestuurd, gereserveerd, …) op basis van gelogde statuswijzigingen en contactmomenten. Er wordt niets verzonnen of overschreven.
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          {preview && (
            <Notice tone="info">
              {preview.updated} van {preview.leads} leads krijgen mijlpalen: {Object.entries(preview.fields).map(([k, n]) => `${label(k)} (${n})`).join(", ") || "geen"}.
            </Notice>
          )}
          {result && (
            <Notice tone="ok">
              Klaar: {result.updated} leads bijgewerkt. In de tijdlijn staat per lead welke velden zijn afgeleid.
            </Notice>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" disabled={busy} onClick={() => run(true)} style={btnStyle("neutral")}>
              {busy && !preview ? "Bezig..." : "Eerst bekijken"}
            </button>
            {preview && preview.updated > 0 && (
              <button type="button" disabled={busy} onClick={() => run(false)} style={btnStyle("primary", true)}>
                {busy ? "Bezig..." : `${preview.updated} leads bijwerken`}
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function HelpPage() {
  const sections = [
    ["Dashboard", "Wat moet er vandaag gebeuren: nieuwe leads, opvolging, achterstallige acties, gesprekken en recente leads."],
    ["Leads", "Zoeken, filteren per fase en direct bellen, WhatsAppen of mailen. Klik op de fasebadge om de fase te wijzigen; zeldzame acties staan onder ⋯."],
    ["Leaddossier", "Overzicht, Zoekprofiel, Opvolging, Tijdlijn, Partners en Bestanden. Wijzigingen worden automatisch opgeslagen."],
    ["Fases en verplichte gegevens", "Bij aanmaken: naam, telefoon of e-mail, bron en toestemming. Voor 'Doorgestuurd': aankoopdoel, termijn, budget, regio, woningtype, bouwtype, financiering, samenvatting, partner en toestemming = Ja. 'Later opvolgen' vraagt een opvolgdatum, 'Gestopt' een reden, 'Gereserveerd' een partner. 'Aankoop afgerond' vraagt datum, partner en commissiestatus."],
    ["Agenda", "Gesprekken, follow-ups, taken en partneropvolgingen per dag, week of maand. Verlopen items staan rechts."],
    ["KPI's", "Gebeurtenissen per periode en conversie van leads die in de periode binnenkwamen (cohort), per bron, campagne, regio en meer."],
    ["Partners en Commissies", "Partnerdossiers met resultaten en opvolging; commissies per afgeronde aankoop met status en betaling."],
  ];
  return (
    <div>
      <PageHeader title="Help / handleiding" subtitle="Hoe het Command Center werkt." />
      <div style={{ display: "grid", gap: 12 }}>
        {sections.map(([t, d]) => (
          <Card key={t} title={t}>
            <div style={{ fontSize: 13.5, color: C.textBody, lineHeight: 1.6 }}>{d}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
