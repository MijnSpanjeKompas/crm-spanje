import { useMemo, useState } from "react";
import {
  PERIODS,
  TREND_SERIES,
  ATTRIBUTION,
  getPeriod,
  allTimePeriod,
  previousPeriod,
  cohort,
  cohortFunnel,
  kpiSummary,
  trend,
  followUpStats,
  formatDuration,
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
import { PARTNER_TYPES, labelOf } from "../../crm/constants";
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
/**
 * Van lead tot aankoop in vier stappen. Per stap één getal en één percentage:
 * het deel van de VORIGE stap ("15 van de 27"). Geen dubbele tellingen.
 */
function Funnel({ funnel, prevFunnel, onStep }) {
  const blocks = [{ key: "new", label: "Nieuwe leads", count: funnel.total, prevCount: null }, ...funnel.stages];
  return (
    <div>
      <div className="msk-funnel" style={{ display: "grid", gridTemplateColumns: `repeat(${blocks.length}, minmax(0, 1fr))`, gap: 10 }}>
        {blocks.map((b, i) => {
          const share = funnel.total ? b.count / funnel.total : 0;
          const prevStep = prevFunnel ? (i === 0 ? prevFunnel.total : prevFunnel.stages[i - 1].count) : null;
          const d = prevStep !== null ? change(b.count, prevStep) : null;
          return (
            <div
              key={b.key}
              role="button"
              tabIndex={0}
              aria-label={`${b.label}: ${b.count}. Toon deze leads`}
              onClick={() => onStep(b.key)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onStep(b.key))}
              className="msk-kpi"
              style={{ position: "relative", background: i === 0 ? C.navy : C.surface, color: i === 0 ? "#fff" : C.text, border: `1px solid ${i === 0 ? C.navy : C.border}`, borderRadius: 14, padding: "14px 14px 12px", cursor: "pointer", minWidth: 0 }}
            >
              {i > 0 && (
                <span aria-hidden="true" className="msk-funnel-arrow" style={{ position: "absolute", left: -11, top: 22, width: 12, color: C.textSubtle, display: "flex" }}>
                  <Icon name="chevronRight" size={14} />
                </span>
              )}
              <div style={{ fontSize: 12.5, color: i === 0 ? "rgba(255,255,255,.75)" : C.textMuted, fontWeight: 500 }}>{b.label}</div>
              <div style={{ fontFamily: C.fontDisplay, fontSize: 32, fontWeight: 600, lineHeight: 1.1, margin: "2px 0 6px", color: i === 0 ? "#fff" : C.navy }}>{b.count}</div>
              <div style={{ fontSize: 12.5, minHeight: 34, color: i === 0 ? "rgba(255,255,255,.75)" : C.textBody, lineHeight: 1.35 }}>
                {i === 0 ? (
                  "binnengekomen"
                ) : b.prevCount ? (
                  <>
                    <strong style={{ fontWeight: 700, color: C.navy }}>{pct(b.count / b.prevCount)}</strong> van de {b.prevCount} {i === 1 ? "nieuwe leads" : blocks[i - 1].short}
                  </>
                ) : (
                  <span style={{ color: C.textSubtle }}>vorige stap is 0</span>
                )}
              </div>
              <div style={{ height: 6, background: i === 0 ? "rgba(255,255,255,.2)" : C.surfaceSunken, borderRadius: 99, overflow: "hidden", marginTop: 8 }} title={`${pct(share)} van alle nieuwe leads`}>
                <div style={{ width: `${share * 100}%`, height: "100%", background: i === 0 ? C.gold : i === blocks.length - 1 ? C.gold : CHART_COLORS.primary, borderRadius: 99 }} />
              </div>
              {d && <div style={{ marginTop: 6 }}><Delta c={d} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function funnelSentence(f) {
  if (!f.total) return "";
  const [contact, forwarded, reserved, purchased] = f.stages.map((s) => s.count);
  return `${f.total === 1 ? "Van de 1 lead hebben we er" : `Van de ${f.total} leads hebben we er`} ${contact} gesproken. ${forwarded} daarvan ${forwarded === 1 ? "is" : "zijn"} doorgestuurd naar een partner, ${reserved} ${reserved === 1 ? "heeft" : "hebben"} gereserveerd en ${purchased} ${purchased === 1 ? "heeft" : "hebben"} gekocht.`;
}

// ─── PAGINA ──────────────────────────────────────────────────────────────────
/**
 * KPI-dashboard. Alle cijfers komen uit crm/analytics.js; hier alleen weergave.
 * onShowLeads(patch) opent de Leads-pagina met een filter (click-through).
 */
export function KpiPage({ leads, links, partners, users, now, navigate, onOpenPartner, onShowLeads }) {
  const [periodKey, setPeriodKey] = useState("all");
  const [custom, setCustom] = useState({ from: `${todayISO(now).slice(0, 7)}-01`, to: todayISO(now) });
  const [compare, setCompare] = useState(false);
  const [dim, setDim] = useState("source");
  const [trendKeys, setTrendKeys] = useState(["newLeads"]);
  const [regionScope, setRegionScope] = useState("all");

  const isAll = periodKey === "all";
  const period = useMemo(() => (isAll ? allTimePeriod(leads, now) : getPeriod(periodKey, now, custom)), [isAll, leads, periodKey, now, custom]);
  const doCompare = compare && !isAll;
  const prev = useMemo(() => (doCompare ? previousPeriod(period, periodKey) : null), [doCompare, period, periodKey]);
  const coh = useMemo(() => cohort(leads, period), [leads, period]);
  const prevCoh = useMemo(() => (prev ? cohort(leads, prev) : null), [leads, prev]);
  const funnel = useMemo(() => cohortFunnel(coh), [coh]);
  const prevFunnel = useMemo(() => (prevCoh ? cohortFunnel(prevCoh) : null), [prevCoh]);
  const kpi = useMemo(() => kpiSummary(coh), [coh]);
  const tr = useMemo(() => trend(leads, period, prev), [leads, period, prev]);
  const follow = useMemo(() => followUpStats(coh, leads, now), [coh, leads, now]);
  const groups = useMemo(() => groupStats(coh, dim), [coh, dim]);
  const regionLeads = useMemo(() => (regionScope === "all" ? coh : coh.filter((l) => reached(l, regionScope))), [coh, regionScope]);
  const partnerRows = useMemo(() => partnerStats(partners, links, leads, now).filter((r) => r.forwarded > 0).sort((a, b) => b.forwarded - a.forwarded), [partners, links, leads, now]);
  const fin = useMemo(() => commissionSummary(leads, isAll ? null : period), [leads, isAll, period]);
  const showTeam = useMemo(() => distinctOwners(leads) > 1, [leads]);
  const team = useMemo(() => (showTeam ? teamStats(leads, period, users.filter((u) => u.active !== false), now) : []), [showTeam, leads, period, users, now]);
  const dq = useMemo(() => dataQuality(coh), [coh]);

  const knownTerm = coh.filter((l) => l.purchaseTimeline && l.purchaseTimeline !== "unknown");
  const shortTerm = knownTerm.filter((l) => ["immediate", "within_3_months", "3_to_6_months"].includes(l.purchaseTimeline)).length;
  const budgets = coh.map((l) => Number(l.budgetMax)).filter((v) => Number.isFinite(v) && v > 0);
  const avgBudget = budgets.length ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length) : null;

  const range = isAll ? `Alles sinds ${formatDate(period.start)}` : `${formatDate(period.start)} – ${formatDate(new Date(period.end - 1))}`;
  const cohortFilter = isAll ? { scope: "all" } : { arrivedFrom: todayISO(period.start), arrivedTo: todayISO(new Date(period.end - 1)), scope: "all" };
  const showCohort = (extra = {}) => onShowLeads({ ...cohortFilter, ...extra });
  const periodWord = isAll ? "alle leads" : "leads uit deze periode";

  const trendSeries = trendKeys.flatMap((k, i) => {
    const color = [CHART_COLORS.primary, CHART_COLORS.accent, CHART_COLORS.secondary, CHART_COLORS.positive][i % 4];
    const label = TREND_SERIES.find((s) => s.key === k).label;
    const main = { key: k, label, values: tr.series[k], color };
    return doCompare ? [main, { key: `${k}-prev`, label: `${label} (vorige periode)`, values: tr.previous[k], color, dashed: true }] : [main];
  });

  return (
    <div>
      <PageHeader title="KPI's" subtitle="Inzicht in leadkwaliteit, conversie en resultaten." />

      {/* TOOLBAR */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 12px" }}>
        <select value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} style={{ ...selectStyle, height: 34 }} aria-label="Periode">
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {periodKey === "custom" && (
          <>
            <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} style={{ ...inputStyle, width: "auto", minHeight: 34 }} aria-label="Van" />
            <span style={{ color: C.textMuted, fontSize: 13 }}>t/m</span>
            <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} style={{ ...inputStyle, width: "auto", minHeight: 34 }} aria-label="Tot en met" />
          </>
        )}
        {!isAll && (
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: C.textBody }}>
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Vergelijk met vorige periode
          </label>
        )}
        <span style={{ marginLeft: "auto", fontSize: 13, color: C.textMuted, display: "flex", gap: 6, alignItems: "center" }}>
          <Icon name="calendar" size={14} /> {range}
        </span>
      </div>

      {/* FUNNEL */}
      <Section
        title="Van lead tot aankoop"
        subtitle={funnel.total ? funnelSentence(funnel) : undefined}
        info={`Voor ${periodWord}: hoeveel zijn we elke stap verder gekomen? Het percentage is steeds het deel van de stap ervoor. Een lead die al verder is (bijv. doorgestuurd), telt ook mee bij de stappen ervoor. Klik op een blok om die leads te zien.`}
        style={{ marginBottom: 16 }}
      >
        {funnel.total === 0 ? (
          <NoData text="Er zijn nog geen leads binnengekomen in deze periode." />
        ) : (
          <>
            <Funnel funnel={funnel} prevFunnel={prevFunnel} onStep={(k) => showCohort(k === "new" ? {} : { reached: k })} />
            <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: C.textBody, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.borderSoft}` }}>
              <Icon name="checkCircle" size={15} /> Van nieuwe lead tot aankoop:
              <strong style={{ color: C.navy }}>{pct(kpi.purchased.pct)}</strong>
              <span style={{ color: C.textMuted }}>
                ({kpi.purchased.count} van {kpi.purchased.total})
              </span>
            </div>
          </>
        )}
      </Section>

      {/* TREND + OPVOLGING */}
      <div className="msk-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginBottom: 16 }}>
        <Section
          title="Leadontwikkeling"
          subtitle={`Aantal per ${tr.unit}`}
          info="Geteld op de datum waarop het gebeurde (binnenkomst, contact, doorsturen, aankoop)."
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
                    style={{ border: `1px solid ${on ? C.navy : C.border}`, background: on ? C.navySoft : C.surface, color: on ? C.navy : C.textMuted, borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "inherit" }}
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

        <Section title="Hoe snel reageren we?" subtitle="Benaderen = bellen, appen of mailen, ook als er niet wordt opgenomen.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <Tile
              label="Reactietijd"
              value={formatDuration(follow.medianFirstAttemptMs)}
              sub={follow.sample ? `Typische tijd tot we een nieuwe lead benaderen (${follow.sample} leads)` : "Nog geen contactpogingen vastgelegd"}
              info="De mediaan: de helft van de leads benaderen we sneller dan dit, de andere helft langzamer. Minder gevoelig voor één uitschieter dan een gemiddelde."
            />
            <Tile
              label="Binnen 24 uur benaderd"
              value={pct(follow.within24h.pct)}
              sub={follow.within24h.total ? `${follow.within24h.count} van ${follow.within24h.total} leads` : "–"}
              tone={follow.within24h.pct !== null && follow.within24h.pct < 0.8 ? "warn" : undefined}
            />
            <Tile label="Nooit benaderd" value={follow.noAttempt} tone={follow.noAttempt ? "danger" : undefined} sub="Al langer dan 24 uur binnen, nog geen enkele poging" />
            <Tile label="Achterstallige acties" value={follow.overdue} tone={follow.overdue ? "danger" : undefined} sub="Open leads waarvan de geplande actie over datum is" />
          </div>
          {follow.overdue > 0 && (
            <button type="button" onClick={() => navigate("agenda", "today")} className="msk-link" style={{ border: "none", background: "none", color: C.goldText, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 10, padding: 0, display: "flex", gap: 4, alignItems: "center" }}>
              Bekijk in Agenda <Icon name="arrowRight" size={13} />
            </button>
          )}
        </Section>
      </div>

      {/* BRONNEN */}
      <Section
        title="Waar komen de beste leads vandaan?"
        subtitle={`${isAll ? "Alle leads" : "Leads uit deze periode"}, per ${ATTRIBUTION[dim].col.toLowerCase()}. Klik op een rij om de leads te zien.`}
        right={<Segmented label="Indeling" value={dim} onChange={setDim} options={Object.entries(ATTRIBUTION).map(([value, d]) => ({ value, label: d.label }))} />}
        style={{ marginBottom: 16 }}
      >
        {groups.length === 0 ? (
          <NoData text="Geen leads in deze periode." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18 }}>
            <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left" }}>{ATTRIBUTION[dim].col}</th>
                    <th style={th}>Leads</th>
                    <th style={th}>Contact gehad</th>
                    <th style={th}>Doorgestuurd</th>
                    <th style={th}>Gereserveerd</th>
                    <th style={th}>Aankopen</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.key} className="msk-row" onClick={() => showCohort({ [dim]: g.key === "__unknown" ? "__none" : g.key })} style={{ cursor: "pointer" }}>
                      <td style={{ ...td, textAlign: "left", fontWeight: 600, color: g.key === "__unknown" ? C.textSubtle : C.text, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }} title={g.label}>
                        {g.label}
                      </td>
                      <td style={td}>{g.leads}</td>
                      <td style={td}>
                        <RatioCell r={g.contact} />
                      </td>
                      <td style={td}>
                        <RatioCell r={g.toForwarded} />
                      </td>
                      <td style={td}>{g.reserved}</td>
                      <td style={td}>{g.purchased}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ maxWidth: 760 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>Doorgestuurde leads per {ATTRIBUTION[dim].col.toLowerCase()}</div>
              <HBarChart rows={groups.map((g) => ({ key: g.key, label: g.label, value: g.forwarded }))} total={kpi.forwarded.count} labelWidth={220} emptyText="Nog geen leads doorgestuurd." />
            </div>
          </div>
        )}
      </Section>

      {/* VERDELINGEN */}
      <div className="msk-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginBottom: 16 }}>
        <Section title="Wanneer willen leads kopen?" subtitle={knownTerm.length ? `${pct(shortTerm / knownTerm.length)} wil binnen 6 maanden kopen (${shortTerm} van ${knownTerm.length} met bekende termijn)` : "Aankooptermijn"}>
          <HBarChart rows={distribution(coh, "timeline")} color={CHART_COLORS.primary} emptyText="Geen leads in deze periode." />
        </Section>
        <Section title="Interesse per regio" subtitle="Een lead met meerdere regio's telt bij elke regio." right={<Segmented label="Regio-selectie" value={regionScope} onChange={setRegionScope} options={[{ value: "all", label: "Alle leads" }, { value: "forwarded", label: "Doorgestuurd" }]} />}>
          <HBarChart rows={distribution(regionLeads, "region")} total={regionLeads.length} color={CHART_COLORS.secondary} emptyText="Geen leads in deze selectie." />
        </Section>
        <Section title="Aankoopdoel">
          {coh.filter((l) => l.purchaseGoal).length < 3 ? <NoData text="Nog onvoldoende gegevens (minder dan 3 leads met een aankoopdoel)." /> : <HBarChart rows={distribution(coh, "goal")} color={CHART_COLORS.primary} />}
        </Section>
        <Section title="Budget van leads" subtitle={avgBudget ? `Gemiddeld maximaal budget ${formatEuro(avgBudget)} (${budgets.length} leads)` : undefined} info="Ingedeeld op maximaal budget (of minimaal budget als er geen maximum is).">
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
                  <th style={th}>Doorgestuurd → aankoop</th>
                  <th style={th}>Open opvolging</th>
                </tr>
              </thead>
              <tbody>
                {partnerRows.map((r) => (
                  <tr key={r.partner.id} className="msk-row">
                    <td style={{ ...td, textAlign: "left" }}>
                      <button type="button" onClick={() => onOpenPartner(r.partner)} style={{ border: "none", background: "none", padding: 0, color: C.navy, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
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
                    <td style={td}>{r.followUpDue ? <span style={{ color: C.danger, fontWeight: 600 }}>{r.openFollowUps} ({r.followUpDue} nu)</span> : r.openFollowUps}</td>
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
          <button type="button" onClick={() => navigate("commissies")} className="msk-link" style={{ border: "none", background: "none", color: C.goldText, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", gap: 4, alignItems: "center" }}>
            Naar Commissies <Icon name="arrowRight" size={13} />
          </button>
        }
        style={{ marginBottom: 16 }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <Tile label="Verwachte commissie" value={formatEuro(fin.expected)} sub="huidige stand" />
          <Tile label="Openstaand" value={formatEuro(fin.outstanding)} sub="nog niet betaald" />
          <Tile label={isAll ? "Ontvangen (totaal)" : "Ontvangen in periode"} value={formatEuro(fin.received)} />
          <Tile label="Aankopen afgerond" value={fin.purchasesInPeriod} sub={isAll ? "totaal" : "in deze periode (op aankoopdatum)"} />
        </div>
      </Section>

      {/* TEAM (alleen bij meerdere verantwoordelijken) */}
      {showTeam && team.length > 0 && (
        <Section title="Team" subtitle="Per verantwoordelijke. Geen score of ranking." style={{ marginBottom: 16 }}>
          <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr>
                  {["Verantwoordelijke", "Nieuwe leads", "Contact gehad", "Doorgestuurd", "Open follow-ups", "Achterstallig"].map((h, i) => (
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
          <Icon name="info" size={13} /> Datakwaliteit ({dq.total} leads): {dq.unknownSource} zonder bekende bron · {dq.unknownTimeline} zonder termijn · {dq.noBudget} zonder budget
          {dq.possibleDuplicates ? ` · ${dq.possibleDuplicates} mogelijk dubbel` : ""}. Deze staan als "Onbekend" in de overzichten.
        </div>
      )}
    </div>
  );
}
