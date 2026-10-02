import { useMemo, useState } from "react";
import {
  PERIODS,
  TREND_SERIES,
  ATTRIBUTION,
  getPeriod,
  previousPeriod,
  cohort,
  cohortFunnel,
  kpiSummary,
  trend,
  leadQuality,
  unqualifiedReasons,
  followUpStats,
  formatDuration,
  showUp,
  groupStats,
  distribution,
  partnerStats,
  teamStats,
  distinctOwners,
  commissionSummary,
  dataQuality,
  change,
  pct,
} from "../../crm/analytics";
import { reached } from "../../crm/milestones";
import { PARTNER_TYPES, UNQUALIFIED_REASONS, labelOf } from "../../crm/constants";
import { formatDate, todayISO } from "../../crm/dates";
import { Icon, selectStyle, inputStyle, formatEuro, C } from "../ui";
import { HBarChart, LineChart, InfoTip, NoData, CHART_COLORS } from "../charts";
import { PageHeader } from "../shell/AppShell";

// ─── BOUWSTENEN ──────────────────────────────────────────────────────────────
function Section({ title, subtitle, info, right, children, style }) {
  return (
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: C.shadowSm, padding: "16px 18px 18px", minWidth: 0, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 600, color: C.text, display: "flex", gap: 7, alignItems: "center" }}>
            {title}
            {info && <InfoTip text={info} label={title} />}
          </h2>
          {subtitle && <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Delta({ c }) {
  if (!c) return null;
  const color = c.dir > 0 ? C.success : c.dir < 0 ? C.danger : C.textSubtle;
  return <span style={{ fontSize: 11.5, fontWeight: 600, color }}>{c.text}</span>;
}

function KpiCard({ icon, label, value, sub, info, delta, onClick }) {
  // Geen <button>: de kaart bevat zelf een info-knop (geen geneste knoppen).
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${label}: ${value}. Toon deze leads` : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick()) : undefined}
      className={onClick ? "msk-kpi" : undefined}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        boxShadow: C.shadowSm,
        padding: "14px 16px",
        textAlign: "left",
        fontFamily: "inherit",
        cursor: onClick ? "pointer" : "default",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minHeight: 112,
      }}
    >
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12.5, color: C.textMuted, display: "flex", gap: 5, alignItems: "center" }}>
          {label}
          {info && <InfoTip text={info} label={label} />}
        </span>
        <span aria-hidden="true" style={{ color: C.textSubtle, display: "flex" }}>
          <Icon name={icon} size={15} />
        </span>
      </span>
      <span style={{ fontFamily: C.fontDisplay, fontSize: 30, fontWeight: 600, color: C.navy, lineHeight: 1.15 }}>{value}</span>
      <span style={{ fontSize: 12, color: C.textMuted }}>{sub}</span>
      {delta && <Delta c={delta} />}
    </div>
  );
}

function Tile({ label, value, sub, info, tone }) {
  return (
    <div style={{ background: C.surfaceSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: "11px 13px", minWidth: 0 }}>
      <div style={{ fontSize: 12, color: C.textMuted, display: "flex", gap: 5, alignItems: "center" }}>
        {label}
        {info && <InfoTip text={info} label={label} />}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: tone === "danger" ? C.danger : tone === "warn" ? C.goldText : C.navy, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: C.textSubtle }}>{sub}</div>}
    </div>
  );
}

function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", background: C.surfaceSunken, border: `1px solid ${C.borderSoft}`, borderRadius: 9, padding: 2, gap: 2 }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          style={{
            border: "none",
            padding: "4px 10px",
            borderRadius: 7,
            fontSize: 12,
            fontWeight: value === o.value ? 600 : 500,
            cursor: "pointer",
            fontFamily: "inherit",
            background: value === o.value ? C.surface : "transparent",
            color: value === o.value ? C.navy : C.textMuted,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const th = {
  textAlign: "right",
  padding: "9px 10px",
  fontSize: 11.5,
  fontWeight: 600,
  color: C.textMuted,
  background: C.surfaceSoft,
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: "nowrap",
};
const td = {
  padding: "9px 10px",
  fontSize: 13,
  color: C.textBody,
  borderBottom: `1px solid ${C.borderSoft}`,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

function RatioCell({ r }) {
  if (!r.total) return <span style={{ color: C.textSubtle }}>–</span>;
  return (
    <span title={`${r.count} van ${r.total}`}>
      {pct(r.pct)}{" "}
      <span style={{ color: C.textSubtle, fontSize: 11.5 }}>
        ({r.count}/{r.total})
      </span>
    </span>
  );
}

// ─── FUNNEL ──────────────────────────────────────────────────────────────────
const FUNNEL_SHADES = ["#0b304c", "#1f4c6e", "#3a6788", "#5f86a5", "#c9a24a", "#d9a83e"];

function Funnel({ funnel, onStage }) {
  const rows = [{ key: "new", label: "Nieuwe leads", count: funnel.total, pctOfCohort: funnel.total ? 1 : null }, ...funnel.stages];
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {rows.map((r, i) => {
        const w = funnel.total ? Math.max(14, (r.count / funnel.total) * 100) : 14;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onStage(r.key)}
            title={`${r.label}: ${r.count}${r.pctOfCohort !== null ? ` (${pct(r.pctOfCohort)} van nieuwe leads)` : ""}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 128px",
              alignItems: "center",
              gap: 12,
              border: "none",
              background: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            <span style={{ display: "flex", justifyContent: "center" }}>
              <span
                style={{
                  width: `${w}%`,
                  background: i === 0 ? CHART_COLORS.primary : FUNNEL_SHADES[Math.min(i - 1, FUNNEL_SHADES.length - 1)],
                  color: i >= 5 ? C.navyDark : "#fff",
                  borderRadius: 8,
                  padding: "7px 10px",
                  textAlign: "center",
                  fontSize: 15,
                  fontWeight: 700,
                  transition: "width .25s ease",
                  minWidth: 44,
                }}
              >
                {r.count}
              </span>
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12.5, color: C.text, fontWeight: 600, whiteSpace: "nowrap" }}>{r.label}</span>
              <span style={{ display: "block", fontSize: 11.5, color: C.textMuted }}>{pct(r.pctOfCohort)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── PAGINA ──────────────────────────────────────────────────────────────────
/**
 * KPI-dashboard. Alle cijfers komen uit crm/analytics.js; hier alleen weergave.
 * onShowLeads(patch) opent de Leads-pagina met een filter (click-through).
 */
export function KpiPage({ leads, links, partners, users, now, navigate, onOpenPartner, onShowLeads }) {
  const [periodKey, setPeriodKey] = useState("month");
  const [custom, setCustom] = useState({ from: `${todayISO(now).slice(0, 7)}-01`, to: todayISO(now) });
  const [compare, setCompare] = useState(false);
  const [dim, setDim] = useState("source");
  const [trendKeys, setTrendKeys] = useState(["newLeads"]);
  const [regionScope, setRegionScope] = useState("all");

  const period = useMemo(() => getPeriod(periodKey, now, custom), [periodKey, now, custom]);
  const prev = useMemo(() => previousPeriod(period, periodKey), [period, periodKey]);
  const coh = useMemo(() => cohort(leads, period), [leads, period]);
  const prevCoh = useMemo(() => cohort(leads, prev), [leads, prev]);
  const kpi = useMemo(() => kpiSummary(coh), [coh]);
  const prevKpi = useMemo(() => kpiSummary(prevCoh), [prevCoh]);
  const funnel = useMemo(() => cohortFunnel(coh), [coh]);
  const tr = useMemo(() => trend(leads, period, compare ? prev : null), [leads, period, prev, compare]);
  const quality = useMemo(() => leadQuality(coh), [coh]);
  const reasons = useMemo(() => unqualifiedReasons(coh, UNQUALIFIED_REASONS), [coh]);
  const follow = useMemo(() => followUpStats(coh, leads, now), [coh, leads, now]);
  const shows = useMemo(() => showUp(leads, period, now), [leads, period, now]);
  const groups = useMemo(() => groupStats(coh, dim), [coh, dim]);
  const regionLeads = useMemo(() => (regionScope === "all" ? coh : coh.filter((l) => reached(l, regionScope))), [coh, regionScope]);
  const partnerRows = useMemo(
    () =>
      partnerStats(partners, links, leads, now)
        .filter((r) => r.forwarded > 0)
        .sort((a, b) => b.forwarded - a.forwarded),
    [partners, links, leads, now],
  );
  const fin = useMemo(() => commissionSummary(leads, period), [leads, period]);
  const showTeam = useMemo(() => distinctOwners(leads) > 1, [leads]);
  const team = useMemo(
    () =>
      showTeam
        ? teamStats(
            leads,
            period,
            users.filter((u) => u.active !== false),
            now,
          )
        : [],
    [showTeam, leads, period, users, now],
  );
  const dq = useMemo(() => dataQuality(coh), [coh]);

  const range = `${formatDate(period.start)} – ${formatDate(new Date(period.end - 1))}`;
  const iso = (d) => todayISO(d);
  const cohortFilter = { arrivedFrom: iso(period.start), arrivedTo: iso(new Date(period.end - 1)), scope: "all" };
  const showCohort = (extra = {}) => onShowLeads({ ...cohortFilter, ...extra });
  const cmp = (a, b, rate) => (compare ? change(a, b, { asRate: rate }) : null);

  const trendSeries = trendKeys.flatMap((k, i) => {
    const color = [CHART_COLORS.primary, CHART_COLORS.accent, CHART_COLORS.secondary, CHART_COLORS.positive][i % 4];
    const label = TREND_SERIES.find((s) => s.key === k).label;
    const main = { key: k, label, values: tr.series[k], color };
    return compare ? [main, { key: `${k}-prev`, label: `${label} (vorige periode)`, values: tr.previous[k], color, dashed: true }] : [main];
  });

  const stepConversions = funnel.stages.map((s, i) => ({
    from: i === 0 ? "Nieuwe leads" : funnel.stages[i - 1].label,
    to: s.label,
    value: s.fromPrevious,
    count: s.count,
    base: i === 0 ? funnel.total : funnel.stages[i - 1].count,
  }));

  return (
    <div>
      <PageHeader title="KPI's" subtitle="Inzicht in leadkwaliteit, conversie en resultaten." />

      {/* TOOLBAR */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 18,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "8px 12px",
        }}
      >
        <select value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} style={{ ...selectStyle, height: 34 }} aria-label="Periode">
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {periodKey === "custom" && (
          <>
            <input
              type="date"
              value={custom.from}
              onChange={(e) => setCustom({ ...custom, from: e.target.value })}
              style={{ ...inputStyle, width: "auto", minHeight: 34 }}
              aria-label="Van"
            />
            <input
              type="date"
              value={custom.to}
              onChange={(e) => setCustom({ ...custom, to: e.target.value })}
              style={{ ...inputStyle, width: "auto", minHeight: 34 }}
              aria-label="Tot en met"
            />
          </>
        )}
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: C.textBody }}>
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Vergelijk met vorige periode
        </label>
        <span style={{ marginLeft: "auto", fontSize: 13, color: C.textMuted, display: "flex", gap: 6, alignItems: "center" }}>
          <Icon name="calendar" size={14} /> {range}
        </span>
      </div>

      {/* HOOFD-KPI'S (cohort) */}
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}>
        Leads binnengekomen in deze periode
        <InfoTip
          text="Cohort: alle leads die in de geselecteerde periode zijn binnengekomen. Per stap: welk deel heeft die stap (inmiddels) bereikt. Bij vergelijken heeft de vorige periode meer tijd gehad om te converteren."
          label="Cohort"
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 46%), 1fr))", gap: 12, marginBottom: 18 }}>
        <KpiCard icon="userPlus" label="Nieuwe leads" value={kpi.newLeads} sub="binnengekomen" delta={cmp(kpi.newLeads, prevKpi.newLeads)} onClick={() => showCohort()} />
        <KpiCard
          icon="phone"
          label="Contactpercentage"
          value={pct(kpi.contact.pct)}
          sub={kpi.contact.total ? `${kpi.contact.count} van ${kpi.contact.total} leads` : "Nog geen leads"}
          info="Deel van de nieuwe leads waarmee daadwerkelijk contact is geregistreerd (een poging zonder gehoor telt niet)."
          delta={cmp(kpi.contact.pct, prevKpi.contact.pct, true)}
          onClick={() => showCohort({ reached: "contact" })}
        />
        <KpiCard
          icon="calendar"
          label="Gesprekpercentage"
          value={pct(kpi.meeting.pct)}
          sub={kpi.meeting.total ? `${kpi.meeting.count} van ${kpi.meeting.total} leads` : "Nog geen leads"}
          info="Deel van de nieuwe leads met een gevoerd gesprek (of al verder in de funnel)."
          delta={cmp(kpi.meeting.pct, prevKpi.meeting.pct, true)}
          onClick={() => showCohort({ reached: "meeting" })}
        />
        <KpiCard
          icon="checkCircle"
          label="Gekwalificeerd"
          value={kpi.qualified.count}
          sub={kpi.qualified.total ? `${pct(kpi.qualified.pct)} van nieuwe leads` : "–"}
          info="Kwalificatie 'Gekwalificeerd', of al doorgestuurd."
          delta={cmp(kpi.qualified.count, prevKpi.qualified.count)}
          onClick={() => showCohort({ reached: "qualified" })}
        />
        <KpiCard
          icon="briefcase"
          label="Doorgestuurd"
          value={kpi.forwarded.count}
          sub={kpi.forwarded.total ? `${pct(kpi.forwarded.pct)} van nieuwe leads` : "–"}
          delta={cmp(kpi.forwarded.count, prevKpi.forwarded.count)}
          onClick={() => showCohort({ reached: "forwarded" })}
        />
        <KpiCard
          icon="home"
          label="Aankopen afgerond"
          value={kpi.purchased.count}
          sub={kpi.forwardedToPurchase.total ? `${pct(kpi.forwardedToPurchase.pct)} van doorgestuurd` : "Nog niets doorgestuurd"}
          info="Leads uit deze periode die inmiddels een aankoop afrondden. Aankopen ín de periode (ongeacht binnenkomst) staan onder Financieel."
          delta={cmp(kpi.purchased.count, prevKpi.purchased.count)}
          onClick={() => showCohort({ reached: "purchased" })}
        />
      </div>

      {/* FUNNEL + TREND */}
      <div className="msk-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginBottom: 16 }}>
        <Section
          title="Conversiefunnel"
          subtitle="Van nieuwe lead tot afgeronde aankoop."
          info="Elke stap telt leads die die stap óf een latere stap bereikten. Zo kan een stap nooit hoger zijn dan de vorige."
        >
          {funnel.total === 0 ? (
            <NoData text="Er zijn nog geen leads binnengekomen in deze periode." />
          ) : (
            <>
              <Funnel funnel={funnel} onStage={(k) => showCohort(k === "new" ? {} : { reached: k })} />
              <div style={{ borderTop: `1px solid ${C.borderSoft}`, marginTop: 14, paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>Conversie tussen stappen</div>
                <div style={{ display: "grid", gap: 5 }}>
                  {stepConversions.slice(1).map((s) => (
                    <div key={s.to} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5 }} title={`${s.count} van ${s.base}`}>
                      <span style={{ color: C.textBody }}>
                        {s.from.split(" ")[0]} → {s.to.split(" ")[0].toLowerCase()}
                      </span>
                      <span style={{ fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums" }}>
                        {pct(s.value)}{" "}
                        <span style={{ fontWeight: 400, color: C.textSubtle }}>
                          ({s.count}/{s.base})
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                {dq.impliedLeads > 0 && (
                  <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 8, display: "flex", gap: 5, alignItems: "center" }}>
                    {dq.impliedLeads} {dq.impliedLeads === 1 ? "lead telt" : "leads tellen"} in een eerdere stap mee via een latere stap
                    <InfoTip text="Bijvoorbeeld: doorgestuurd zonder geregistreerd gesprek. Zo blijft de funnel kloppend; registreer gesprekken en kwalificatie voor scherpere cijfers." />
                  </div>
                )}
              </div>
            </>
          )}
        </Section>

        <Section
          title="Leadontwikkeling"
          subtitle={`Gebeurtenissen per ${tr.unit}`}
          info="Telt op de datum van de gebeurtenis (binnenkomst, gesprek, doorsturen, aankoop). Gebeurtenissen zonder bekende datum (oude data) ontbreken hier."
          right={
            <div role="group" aria-label="Lijnen" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {TREND_SERIES.map((s) => {
                const on = trendKeys.includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTrendKeys((k) => (on ? (k.length > 1 ? k.filter((x) => x !== s.key) : k) : [...k, s.key]))}
                    style={{
                      border: `1px solid ${on ? C.navy : C.border}`,
                      background: on ? C.navySoft : C.surface,
                      color: on ? C.navy : C.textMuted,
                      borderRadius: 999,
                      padding: "3px 10px",
                      fontSize: 11.5,
                      fontWeight: on ? 600 : 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          }
        >
          <LineChart labels={tr.labels} series={trendSeries} />
        </Section>
      </div>

      {/* KWALITEIT + OPVOLGING */}
      <div className="msk-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginBottom: 16 }}>
        <Section title="Leadkwaliteit" subtitle="Leads binnengekomen in deze periode.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <Tile label="Gekwalificeerd" value={quality.qualified.count} sub={quality.unqualified ? `${quality.unqualified} niet gekwalificeerd` : undefined} />
            <Tile
              label="Kwalificatie"
              value={pct(quality.qualified.pct)}
              sub={quality.qualified.total ? `${quality.qualified.count} van ${quality.qualified.total} · ${quality.assessed.count} beoordeeld` : "–"}
              info="Gekwalificeerd gedeeld door alle nieuwe leads. 'Beoordeeld' = gekwalificeerd of niet gekwalificeerd."
            />
            <Tile
              label="Kooptermijn ≤ 6 maanden"
              value={pct(quality.shortTerm.pct)}
              sub={quality.shortTerm.total ? `${quality.shortTerm.count} van ${quality.shortTerm.total} met bekende termijn` : "Geen termijnen bekend"}
            />
            <Tile
              label="Gem. max. budget"
              value={quality.avgBudgetMax ? formatEuro(quality.avgBudgetMax) : "–"}
              sub={quality.budgetSample ? `op basis van ${quality.budgetSample} leads` : "Geen budgetten bekend"}
              info="Gemiddelde van het ingevulde maximale budget (alleen numerieke waarden)."
            />
            <Tile
              label="Show-up gesprekken"
              value={pct(shows.rate.pct)}
              sub={shows.rate.total ? `${shows.rate.count} van ${shows.rate.total}${shows.noShow ? ` · ${shows.noShow} no-show` : ""}` : "Geen gesprekken gepland"}
              info="Gevoerde gesprekken / gesprekken die in deze periode hadden moeten plaatsvinden. Het CRM bewaart één (laatste) afspraak per lead, dus dit is een benadering."
            />
            <Tile label="Gesprek nog niet afgerond" value={shows.unresolved} tone={shows.unresolved ? "warn" : undefined} sub="datum voorbij, status nog 'gepland'" />
          </div>
          {reasons.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>Redenen niet gekwalificeerd</div>
              <HBarChart rows={reasons} color={CHART_COLORS.negative} labelWidth={170} />
            </div>
          )}
        </Section>

        <Section title="Opvolging" subtitle="Snelheid (leads uit deze periode) en huidige werkvoorraad.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <Tile
              label="Gem. tot eerste poging"
              value={formatDuration(follow.avgFirstAttemptMs)}
              sub={follow.sample ? `mediaan ${formatDuration(follow.medianFirstAttemptMs)} · ${follow.sample} leads` : "Nog geen pogingen geregistreerd"}
              info="Tijd tussen binnenkomst en de eerste contactpoging (bellen, WhatsApp, e-mail), ook als er niet werd opgenomen."
            />
            <Tile
              label="Binnen 24 uur opgevolgd"
              value={pct(follow.within24h.pct)}
              sub={follow.within24h.total ? `${follow.within24h.count} van ${follow.within24h.total}` : "–"}
              tone={follow.within24h.pct !== null && follow.within24h.pct < 0.8 ? "warn" : undefined}
              info="Leads met een eerste contactpoging binnen 24 uur na binnenkomst. Leads die nog geen 24 uur binnen zijn, tellen pas mee als ze zijn opgevolgd."
            />
            <Tile label="Nog niet opgevolgd" value={follow.noAttempt} tone={follow.noAttempt ? "danger" : undefined} sub="> 24 uur, geen poging" />
            <Tile label="Niet bereikt" value={follow.notReached} sub="wel geprobeerd, nog geen contact" />
            <Tile label="Zonder volgende actie" value={follow.withoutNextAction} tone={follow.withoutNextAction ? "warn" : undefined} sub="open leads, nu" />
            <Tile label="Achterstallig" value={follow.overdue} tone={follow.overdue ? "danger" : undefined} sub="follow-ups, nu" />
          </div>
        </Section>
      </div>

      {/* BRONNEN */}
      <Section
        title="Leadkwaliteit per bron"
        subtitle="Leads binnengekomen in deze periode. Klik op een rij om de leads te zien."
        right={<Segmented label="Indeling" value={dim} onChange={setDim} options={Object.entries(ATTRIBUTION).map(([value, d]) => ({ value, label: d.label }))} />}
        style={{ marginBottom: 16 }}
      >
        {groups.length === 0 ? (
          <NoData text="Geen leads in deze periode." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18 }}>
            <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: dim === "content" ? 560 : 680 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left" }}>{ATTRIBUTION[dim].col}</th>
                    <th style={th}>Leads</th>
                    {dim !== "content" && <th style={th}>Contact</th>}
                    <th style={th}>Gesprek</th>
                    <th style={th}>Gekwal.</th>
                    <th style={th}>Doorgest.</th>
                    {dim === "source" && <th style={th}>Gereserv.</th>}
                    <th style={th}>Aankopen</th>
                    {dim === "source" && <th style={th}>Lead → doorgest.</th>}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr
                      key={g.key}
                      className="msk-row"
                      onClick={() => showCohort(g.key === "__unknown" ? { [dim === "source" ? "source" : dim]: "__none" } : { [dim === "source" ? "source" : dim]: g.key })}
                      style={{ cursor: "pointer" }}
                    >
                      <td
                        style={{
                          ...td,
                          textAlign: "left",
                          fontWeight: 600,
                          color: g.key === "__unknown" ? C.textSubtle : C.text,
                          maxWidth: 260,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={g.label}
                      >
                        {g.label}
                      </td>
                      <td style={td}>{g.leads}</td>
                      {dim !== "content" && (
                        <td style={td}>
                          <RatioCell r={g.contact} />
                        </td>
                      )}
                      <td style={td}>
                        <RatioCell r={g.meeting} />
                      </td>
                      <td style={td}>{g.qualified}</td>
                      <td style={td}>{g.forwarded}</td>
                      {dim === "source" && <td style={td}>{g.reserved}</td>}
                      <td style={td}>{g.purchased}</td>
                      {dim === "source" && (
                        <td style={td}>
                          <RatioCell r={g.toForwarded} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ maxWidth: 760 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>Doorgestuurde leads per {ATTRIBUTION[dim].col.toLowerCase()}</div>
              <HBarChart
                rows={groups.map((g) => ({ key: g.key, label: g.label, value: g.forwarded }))}
                total={kpi.forwarded.count}
                labelWidth={220}
                emptyText="Nog geen leads doorgestuurd in dit cohort."
              />
            </div>
          </div>
        )}
      </Section>

      {/* VERDELINGEN */}
      <div className="msk-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginBottom: 16 }}>
        <Section title="Wanneer willen leads kopen?" subtitle="Aankooptermijn, leads uit deze periode.">
          <HBarChart rows={distribution(coh, "timeline")} color={CHART_COLORS.primary} emptyText="Geen leads in deze periode." />
        </Section>
        <Section
          title="Interesse per regio"
          subtitle="Een lead met meerdere regio's telt bij elke regio."
          right={
            <Segmented
              label="Regio-selectie"
              value={regionScope}
              onChange={setRegionScope}
              options={[
                { value: "all", label: "Alle" },
                { value: "qualified", label: "Gekwal." },
                { value: "forwarded", label: "Doorgest." },
              ]}
            />
          }
        >
          <HBarChart rows={distribution(regionLeads, "region")} total={regionLeads.length} color={CHART_COLORS.secondary} emptyText="Geen leads in deze selectie." />
        </Section>
        <Section title="Aankoopdoel">
          {coh.filter((l) => l.purchaseGoal).length < 3 ? (
            <NoData text="Nog onvoldoende gegevens (minder dan 3 leads met een aankoopdoel)." />
          ) : (
            <HBarChart rows={distribution(coh, "goal")} color={CHART_COLORS.primary} />
          )}
        </Section>
        <Section title="Budget van leads" info="Ingedeeld op maximaal budget (of minimaal budget als er geen maximum is).">
          <HBarChart rows={distribution(coh, "budget")} color={CHART_COLORS.accent} labelWidth={170} emptyText="Geen leads in deze periode." />
        </Section>
      </div>

      {/* PARTNERS */}
      <Section title="Resultaten per partner" subtitle="Alle koppelingen tot nu toe. Feitelijke aantallen, geen ranking." style={{ marginBottom: 16 }}>
        {partnerRows.length === 0 ? (
          <NoData text="Er zijn nog geen leads aan partners doorgestuurd." />
        ) : (
          <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>Partner</th>
                  <th style={{ ...th, textAlign: "left" }}>Type</th>
                  <th style={th}>Doorgestuurd</th>
                  <th style={th}>Gereserveerd</th>
                  <th style={th}>Aankopen</th>
                  <th style={th}>Doorstuur → aankoop</th>
                  <th style={th}>Open opvolging</th>
                </tr>
              </thead>
              <tbody>
                {partnerRows.map((r) => (
                  <tr key={r.partner.id} className="msk-row">
                    <td style={{ ...td, textAlign: "left" }}>
                      <button
                        type="button"
                        onClick={() => onOpenPartner(r.partner)}
                        style={{ border: "none", background: "none", padding: 0, color: C.navy, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}
                      >
                        {r.partner.name}
                      </button>
                    </td>
                    <td style={{ ...td, textAlign: "left" }}>{labelOf(PARTNER_TYPES, r.partner.type)}</td>
                    <td style={td}>{r.forwarded}</td>
                    <td style={td}>{r.reserved}</td>
                    <td style={td}>{r.purchased}</td>
                    <td style={td}>
                      <RatioCell r={r.toPurchase} />
                    </td>
                    <td style={td}>
                      {r.followUpDue ? (
                        <span style={{ color: C.danger, fontWeight: 600 }}>
                          {r.openFollowUps} ({r.followUpDue} nu)
                        </span>
                      ) : (
                        r.openFollowUps
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* FINANCIEEL */}
      <Section
        title="Financieel"
        right={
          <button
            type="button"
            onClick={() => navigate("commissies")}
            className="msk-link"
            style={{
              border: "none",
              background: "none",
              color: C.goldText,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              gap: 4,
              alignItems: "center",
            }}
          >
            Naar Commissies <Icon name="arrowRight" size={13} />
          </button>
        }
        style={{ marginBottom: 16 }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <Tile label="Verwachte commissie" value={formatEuro(fin.expected)} sub="huidige stand" />
          <Tile label="Openstaand" value={formatEuro(fin.outstanding)} sub="nog niet betaald" />
          <Tile label="Ontvangen in periode" value={formatEuro(fin.received)} />
          <Tile label="Aankopen afgerond" value={fin.purchasesInPeriod} sub="in deze periode" info="Op aankoopdatum, ongeacht wanneer de lead binnenkwam (event)." />
        </div>
      </Section>

      {/* TEAM (alleen bij meerdere verantwoordelijken) */}
      {showTeam && team.length > 0 && (
        <Section title="Team" subtitle="Per verantwoordelijke. Geen score of ranking." style={{ marginBottom: 16 }}>
          <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr>
                  {["Verantwoordelijke", "Nieuwe leads", "Contact", "Gesprekken", "Doorgestuurd", "Open follow-ups", "Achterstallig"].map((h, i) => (
                    <th key={h} style={{ ...th, textAlign: i === 0 ? "left" : "right" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...td, textAlign: "left", fontWeight: 600, color: C.text }}>{r.name}</td>
                    <td style={td}>{r.newLeads}</td>
                    <td style={td}>{r.contact}</td>
                    <td style={td}>{r.meeting}</td>
                    <td style={td}>{r.forwarded}</td>
                    <td style={td}>{r.openFollowUps}</td>
                    <td style={{ ...td, color: r.overdue ? C.danger : C.textBody, fontWeight: r.overdue ? 600 : 400 }}>{r.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {(dq.unknownSource > 0 || dq.unknownTimeline > 0 || dq.noBudget > 0) && dq.total > 0 && (
        <div style={{ fontSize: 12, color: C.textSubtle, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Icon name="info" size={13} /> Datakwaliteit dit cohort ({dq.total}): {dq.unknownSource} zonder bekende bron · {dq.unknownTimeline} zonder termijn · {dq.noBudget} zonder
          budget
          {dq.possibleDuplicates ? ` · ${dq.possibleDuplicates} mogelijk dubbel` : ""}. Deze staan als "Onbekend" in de analyses.
        </div>
      )}
    </div>
  );
}
