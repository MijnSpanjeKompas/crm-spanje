import { useMemo, useState } from "react";
import { PERIODS, FUNNEL_STEPS, BREAKDOWNS, getPeriod, previousPeriod, periodCounts, cohort, cohortFunnel, teamStats, partnerStats, commissionSummary, pct, delta } from "../../crm/analytics";
import { PARTNER_TYPES, labelOf } from "../../crm/constants";
import { formatDate, todayISO } from "../../crm/dates";
import { Card, Icon, selectStyle, inputStyle, formatEuro, C } from "../ui";
import { PageHeader } from "../shell/AppShell";

const th = { textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 600, color: C.textMuted, background: C.surfaceSoft, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
const td = { padding: "10px 12px", fontSize: 13, color: C.textBody, borderBottom: `1px solid ${C.borderSoft}` };
const num = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

function Table({ columns, rows, empty = "Geen gegevens in deze periode.", onRow }) {
  if (!rows.length) return <div style={{ fontSize: 13, color: C.textMuted }}>{empty}</div>;
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ ...th, textAlign: c.align || "left" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key || i} className={onRow ? "msk-row" : undefined} onClick={onRow ? () => onRow(r) : undefined} style={{ cursor: onRow ? "pointer" : "default" }}>
              {columns.map((c) => (
                <td key={c.key} style={c.align === "right" ? num : { ...td, fontWeight: c.strong ? 600 : 400, color: c.strong ? C.text : C.textBody }}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value, prev, compare, hint }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", boxShadow: C.shadowSm }}>
      <div style={{ fontSize: 12.5, color: C.textMuted }}>{label}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 4 }}>
        <span style={{ fontFamily: C.fontDisplay, fontSize: 28, fontWeight: 600, color: C.navy }}>{value}</span>
        {compare && (
          <span style={{ fontSize: 12, fontWeight: 600, color: value > prev ? C.success : value < prev ? C.danger : C.textSubtle }}>
            {delta(value, prev)} <span style={{ fontWeight: 400, color: C.textSubtle }}>vs {prev}</span>
          </span>
        )}
      </div>
      {hint && <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

const funnelCols = [
  { key: "label", label: "", strong: true },
  { key: "leads", label: "Leads", align: "right" },
  { key: "contact", label: "Contact", align: "right" },
  { key: "meeting", label: "Gesprek", align: "right" },
  { key: "forwarded", label: "Doorgestuurd", align: "right" },
  { key: "reserved", label: "Gereserveerd", align: "right" },
  { key: "purchased", label: "Aankoop", align: "right" },
  { key: "conversion", label: "Lead → doorgestuurd", align: "right", render: (r) => pct(r.conversion) },
];

const DIMENSIONS = [
  { value: "source", label: "Leadbron", col: "Bron" },
  { value: "campaign", label: "Campagne (utm_campaign)", col: "Campagne" },
  { value: "content", label: "Advertentie (utm_content)", col: "Advertentie" },
  { value: "region", label: "Regio", col: "Regio" },
  { value: "goal", label: "Aankoopdoel", col: "Aankoopdoel" },
  { value: "timeline", label: "Aankooptermijn", col: "Termijn" },
  { value: "budget", label: "Budgetsegment", col: "Budget" },
  { value: "propertyType", label: "Woningtype", col: "Woningtype" },
];

/**
 * KPI's: prestaties en trends. Alle berekeningen komen uit crm/analytics.js.
 */
export function KpiPage({ leads, links, partners, users, now, navigate, onOpenPartner }) {
  const [periodKey, setPeriodKey] = useState("month");
  const [custom, setCustom] = useState({ from: `${todayISO(now).slice(0, 7)}-01`, to: todayISO(now) });
  const [compare, setCompare] = useState(false);
  const [dim, setDim] = useState("source");

  const live = useMemo(() => leads.filter((l) => !l.archived || l.pipelineStage === "completed"), [leads]);
  const period = useMemo(() => getPeriod(periodKey, now, custom), [periodKey, now, custom]);
  const prevPeriod = useMemo(() => previousPeriod(period, periodKey), [period, periodKey]);
  const counts = useMemo(() => periodCounts(leads, period), [leads, period]);
  const prevCounts = useMemo(() => periodCounts(leads, prevPeriod), [leads, prevPeriod]);
  const cohortLeads = useMemo(() => cohort(leads, period), [leads, period]);
  const funnel = useMemo(() => cohortFunnel(cohortLeads), [cohortLeads]);
  const breakdownRows = useMemo(() => BREAKDOWNS[dim](cohortLeads), [dim, cohortLeads]);
  const team = useMemo(() => teamStats(live, period, users.filter((u) => u.active !== false), now), [live, period, users, now]);
  const partnerRows = useMemo(() => partnerStats(partners, links, leads, now).filter((r) => r.forwarded > 0).sort((a, b) => b.forwarded - a.forwarded), [partners, links, leads, now]);
  const commission = useMemo(() => commissionSummary(leads, period), [leads, period]);
  const periodLabel = `${formatDate(period.start)} – ${formatDate(new Date(period.end - 1))}`;

  return (
    <div>
      <PageHeader title="KPI's" subtitle="Prestaties en trends, berekend uit de CRM-data." />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <select value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} style={selectStyle} aria-label="Periode">
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {periodKey === "custom" && (
          <>
            <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} style={{ ...inputStyle, width: "auto", minHeight: 38 }} aria-label="Van" />
            <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} style={{ ...inputStyle, width: "auto", minHeight: 38 }} aria-label="Tot en met" />
          </>
        )}
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: C.textBody }}>
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Vergelijk met vorige periode
        </label>
        <span style={{ fontSize: 12.5, color: C.textSubtle, marginLeft: "auto" }}>{periodLabel}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 6 }}>
        <Metric label="Nieuwe leads" value={counts.newLeads} prev={prevCounts.newLeads} compare={compare} />
        {FUNNEL_STEPS.map((s) => (
          <Metric key={s.key} label={s.label} value={counts[s.key]} prev={prevCounts[s.key]} compare={compare} />
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: C.textSubtle, marginBottom: 20 }}>
        Gebeurtenissen in de periode, op basis van de eerste keer dat een lead die stap bereikte. Oude leads zonder bekende datum tellen hier niet mee (zie Instellingen → Mijlpalen afleiden).
      </div>

      <Card icon="chart" title="Conversie" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 12 }}>
          Leads binnengekomen in de geselecteerde periode ({funnel.total}). Welk deel bereikte daarna elke stap?
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {FUNNEL_STEPS.map((s) => {
            const st = funnel.steps[s.key];
            return (
              <div key={s.key} style={{ display: "grid", gridTemplateColumns: "180px 1fr 90px", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: C.textBody }}>Lead → {s.label.toLowerCase()}</span>
                <span style={{ background: C.surfaceSoft, borderRadius: 99, height: 10, overflow: "hidden" }}>
                  <span style={{ display: "block", width: `${(st.pct || 0) * 100}%`, height: "100%", background: C.navy, borderRadius: 99, opacity: 0.85 }} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text, textAlign: "right" }}>
                  {pct(st.pct)} <span style={{ fontWeight: 400, color: C.textSubtle }}>({st.count})</span>
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        icon="filter"
        title="Waar komen goede leads vandaan?"
        right={
          <select value={dim} onChange={(e) => setDim(e.target.value)} style={{ ...selectStyle, height: 34 }} aria-label="Indeling">
            {DIMENSIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        }
        style={{ marginBottom: 16 }}
      >
        <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 10 }}>Leads binnengekomen in de geselecteerde periode, per {DIMENSIONS.find((d) => d.value === dim).label.toLowerCase()}.</div>
        <Table columns={[{ ...funnelCols[0], label: DIMENSIONS.find((d) => d.value === dim).col }, ...funnelCols.slice(1)]} rows={breakdownRows} />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        <Card icon="users" title="Team">
          <Table
            columns={[
              { key: "name", label: "Verantwoordelijke", strong: true },
              { key: "openLeads", label: "Open leads", align: "right" },
              { key: "newLeads", label: "Nieuw", align: "right" },
              { key: "contact", label: "Eerste contact", align: "right" },
              { key: "meeting", label: "Gesprekken", align: "right" },
              { key: "forwarded", label: "Doorgestuurd", align: "right" },
              { key: "openFollowUps", label: "Open follow-ups", align: "right" },
              { key: "overdue", label: "Achterstallig", align: "right", render: (r) => <span style={{ color: r.overdue ? C.danger : C.textBody, fontWeight: r.overdue ? 600 : 400 }}>{r.overdue}</span> },
            ]}
            rows={team.map((r) => ({ ...r, key: r.id }))}
          />
        </Card>
        <Card icon="briefcase" title="Partners">
          <Table
            columns={[
              { key: "name", label: "Partner", strong: true, render: (r) => r.partner.name },
              { key: "type", label: "Type", render: (r) => labelOf(PARTNER_TYPES, r.partner.type) },
              { key: "forwarded", label: "Doorgestuurd", align: "right" },
              { key: "reserved", label: "Gereserveerd", align: "right" },
              { key: "purchased", label: "Aankopen", align: "right" },
              { key: "conversion", label: "Conversie", align: "right", render: (r) => pct(r.conversion) },
              { key: "openFollowUps", label: "Open opvolging", align: "right" },
            ]}
            rows={partnerRows.map((r) => ({ ...r, key: r.partner.id }))}
            empty="Nog geen partnerkoppelingen."
            onRow={(r) => onOpenPartner(r.partner)}
          />
          <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 8 }}>Alle koppelingen (niet periodegebonden). Conversie = aankopen / doorgestuurde leads.</div>
        </Card>
      </div>

      <Card icon="euro" title="Commissie" style={{ marginTop: 16 }} right={<button type="button" onClick={() => navigate("commissies")} className="msk-link" style={{ border: "none", background: "none", color: C.goldText, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", gap: 4, alignItems: "center" }}>Naar Commissies <Icon name="arrowRight" size={13} /></button>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <Metric label="Verwacht" value={formatEuro(commission.expected)} />
          <Metric label="Openstaand" value={formatEuro(commission.outstanding)} />
          <Metric label="Ontvangen in periode" value={formatEuro(commission.received)} />
        </div>
      </Card>
    </div>
  );
}
