// ─── ADVERTENTIEKOSTEN IN DE KPI'S ──────────────────────────────────────────
// Vul per maand in wat er aan Meta Ads is uitgegeven (optioneel per campagne).
// Het CRM rekent uit wat een lead en een doorgestuurde lead kost.

import { useMemo, useState } from "react";
import { adPerformance, isPaidLead, monthTotal } from "../../crm/analytics";
import { leadArrivedAt } from "../../crm/milestones";
import { saveAdSpendMonth } from "../../crm/services";
import { formatEuro, Icon, btnStyle, inputStyle, linkBtnStyle, Notice, C } from "../ui";
import { InfoTip, NoData } from "../charts";

const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
function euro(v) {
  return v === null || v === undefined ? "–" : formatEuro(Math.round(v));
}

function Tile({ label, value, sub, strong, info }) {
  return (
    <div style={{ background: strong ? C.navy : C.surfaceSoft, border: `1px solid ${strong ? C.navy : C.borderSoft}`, borderRadius: 12, padding: "11px 13px", minWidth: 0 }}>
      <div style={{ fontSize: 12, color: strong ? "rgba(255,255,255,.75)" : C.textMuted, display: "flex", gap: 5, alignItems: "center" }}>
        {label}
        {info && <InfoTip text={info} label={label} />}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: strong ? "#fff" : C.navy, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: strong ? "rgba(255,255,255,.7)" : C.textSubtle }}>{sub}</div>}
    </div>
  );
}

/** Invoer per maand. */
function MonthRow({ month, entry, campaigns, user }) {
  const [total, setTotal] = useState(entry?.total ?? "");
  const [perCampaign, setPerCampaign] = useState(() => ({ ...(entry?.campaigns || {}) }));
  const [open, setOpen] = useState(false);
  const [state, setState] = useState("");
  const names = Array.from(new Set([...campaigns, ...Object.keys(entry?.campaigns || {})])).sort();

  async function save(nextTotal = total, nextCampaigns = perCampaign) {
    setState("saving");
    try {
      await saveAdSpendMonth(month, { total: nextTotal === "" ? null : Number(nextTotal), campaigns: nextCampaigns }, user);
      setState("saved");
      setTimeout(() => setState(""), 1500);
    } catch (e) {
      setState(`error:${e.message || "Opslaan mislukt"}`);
    }
  }

  const campaignSum = Object.values(perCampaign).reduce((s, v) => s + (Number(v) || 0), 0);
  return (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.borderSoft}` }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ flex: "1 1 120px", fontSize: 13.5, fontWeight: 600, color: C.text, textTransform: "capitalize" }}>{monthLabel(month)}</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textMuted }}>
          €
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={total}
            placeholder={campaignSum ? String(campaignSum) : "0"}
            onChange={(e) => setTotal(e.target.value)}
            onBlur={() => save()}
            aria-label={`Advertentiekosten ${monthLabel(month)}`}
            style={{ ...inputStyle, width: 120, minHeight: 36 }}
          />
        </label>
        <span style={{ width: 70, fontSize: 12, color: state.startsWith("error") ? C.danger : C.success }}>{state === "saving" ? "Opslaan…" : state === "saved" ? "Opgeslagen" : state.startsWith("error") ? "Mislukt" : ""}</span>
        {names.length > 0 && (
          <button type="button" onClick={() => setOpen((v) => !v)} className="msk-link" style={{ ...linkBtnStyle, fontSize: 12.5 }}>
            {open ? "Verberg campagnes" : `Per campagne (${names.length})`}
          </button>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: `2px solid ${C.borderSoft}`, display: "flex", flexDirection: "column", gap: 6 }}>
          {names.map((n) => (
            <label key={n} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: C.textBody, flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 140px", overflowWrap: "anywhere" }}>{n}</span>€
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={perCampaign[n] ?? ""}
                onChange={(e) => setPerCampaign((p) => ({ ...p, [n]: e.target.value }))}
                onBlur={() => save()}
                aria-label={`Kosten campagne ${n} in ${monthLabel(month)}`}
                style={{ ...inputStyle, width: 110, minHeight: 32 }}
              />
            </label>
          ))}
          <div style={{ fontSize: 11.5, color: C.textSubtle }}>Laat het totaal leeg om de som van de campagnes te gebruiken.</div>
        </div>
      )}
      {state.startsWith("error:") && (
        <div style={{ marginTop: 6 }}>
          <Notice tone="error">{state.slice(6)}</Notice>
        </div>
      )}
    </div>
  );
}

export function AdSpendSection({ coh, leads, months, period, isAll, user, onShowLeads, Section }) {
  const [editing, setEditing] = useState(false);
  const perf = useMemo(() => adPerformance(coh, months, period), [coh, months, period]);

  // Maanden om in te vullen: vanaf de eerste Meta-lead (max. 12 maanden terug) t/m deze maand.
  const monthList = useMemo(() => {
    const now = new Date();
    const firstPaid = leads.filter(isPaidLead).map(leadArrivedAt).filter(Boolean).sort((a, b) => a - b)[0];
    const start = new Date(Math.max(firstPaid ? new Date(firstPaid.getFullYear(), firstPaid.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth() - 2, 1), new Date(now.getFullYear(), now.getMonth() - 11, 1)));
    const out = [];
    for (let d = new Date(now.getFullYear(), now.getMonth(), 1); d >= start; d = new Date(d.getFullYear(), d.getMonth() - 1, 1)) out.push(monthKey(d));
    Object.keys(months || {}).forEach((k) => !out.includes(k) && out.push(k));
    return out.sort().reverse();
  }, [leads, months]);

  const campaignsByMonth = useMemo(() => {
    const map = {};
    leads.filter(isPaidLead).forEach((l) => {
      const d = leadArrivedAt(l);
      const c = String(l.utmCampaign || "").trim();
      if (!d || !c) return;
      const k = monthKey(d);
      (map[k] = map[k] || new Set()).add(c);
    });
    return map;
  }, [leads]);

  const hasSpend = Object.values(months || {}).some((e) => monthTotal(e) > 0);

  return (
    <Section
      title="Wat kost een lead?"
      subtitle={hasSpend ? `${isAll ? "Alle leads" : "Leads uit deze periode"} via Meta Ads, afgezet tegen het advertentiebudget.` : "Vul het advertentiebudget per maand in om de kosten per lead te zien."}
      info="Alleen leads met bron 'Meta Ads' tellen mee. Is de periode een deel van een maand, dan telt het budget naar rato van het aantal dagen."
      right={
        <button type="button" onClick={() => setEditing((v) => !v)} style={btnStyle(editing ? "primary" : "gold", editing)}>
          <Icon name={editing ? "check" : "euro"} size={14} /> {editing ? "Klaar" : "Budget invullen"}
        </button>
      }
      style={{ marginBottom: 16 }}
    >
      {editing && (
        <div style={{ background: C.surfaceSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: "4px 14px 8px", marginBottom: 14 }}>
          {monthList.map((m) => (
            <MonthRow key={m} month={m} entry={months?.[m]} campaigns={Array.from(campaignsByMonth[m] || [])} user={user} />
          ))}
        </div>
      )}

      {!hasSpend && !editing ? (
        <NoData text="Nog geen advertentiekosten ingevuld." />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <Tile label="Uitgegeven" value={euro(perf.spend)} sub={isAll ? "totaal" : "in deze periode"} />
            <Tile label="Leads via Meta" value={perf.leads} sub={perf.forwarded ? `${perf.forwarded} doorgestuurd` : "nog geen doorgestuurd"} />
            <Tile label="Kosten per lead" value={euro(perf.perLead)} />
            <Tile label="Kosten per doorgestuurde lead" value={euro(perf.perForwarded)} strong info="Het belangrijkste cijfer: wat kost het om een lead te krijgen die echt naar een makelaar gaat?" />
            <Tile label="Kosten per aankoop" value={euro(perf.perPurchase)} sub={perf.purchased ? `${perf.purchased} aankopen` : "nog geen aankopen"} />
          </div>
          {perf.campaigns.length > 0 && (
            <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 12, marginTop: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                <thead>
                  <tr>
                    {["Campagne", "Kosten", "Leads", "Per lead", "Doorgestuurd", "Per doorgestuurde"].map((h, i) => (
                      <th key={h} style={{ textAlign: i ? "right" : "left", padding: "9px 10px", fontSize: 11.5, fontWeight: 600, color: C.textMuted, background: C.surfaceSoft, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perf.campaigns.map((c) => (
                    <tr key={c.name} className="msk-row" onClick={() => onShowLeads && onShowLeads({ campaign: c.name })} style={{ cursor: onShowLeads ? "pointer" : "default" }}>
                      {[c.name, c.spend ? euro(c.spend) : "–", c.leads, euro(c.perLead), c.forwarded, euro(c.perForwarded)].map((v, i) => (
                        <td key={i} style={{ padding: "9px 10px", fontSize: 13, color: i ? C.textBody : C.text, fontWeight: i ? 400 : 600, borderBottom: `1px solid ${C.borderSoft}`, textAlign: i ? "right" : "left", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {perf.campaigns.some((c) => c.leads && !c.spend) && hasSpend && (
            <div style={{ fontSize: 12, color: C.textSubtle, marginTop: 8 }}>Campagnes zonder bedrag: vul onder "Budget invullen" per campagne in wat ze kostten om ook daar de kosten per lead te zien.</div>
          )}
        </>
      )}
    </Section>
  );
}
