import { useState } from "react";
import {
  PIPELINE_STAGES,
  PURCHASE_INTENTS,
  PRIORITIES,
  REGIONS,
  PURCHASE_GOALS,
  PURCHASE_TIMELINES,
  LEAD_SOURCES,
  NEXT_ACTION_TYPES,
} from "../crm/constants";
import { DEFAULT_FILTERS, countActiveFilters } from "../crm/filters";
import { QUICK_FILTERS } from "../crm/signals";
import { Icon, selectStyle, btnStyle, Badge, C, cardStyle, linkBtnStyle } from "./ui";

function Sel({ value, onChange, allLabel, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle} aria-label={allLabel}>
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function LeadFilters({ filters, setFilters, users, partners, places, currentUser, resultCount, loading, view, setView }) {
  const [more, setMore] = useState(false);
  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));
  const active = countActiveFilters(filters);

  return (
    <div
      id="lead-list"
      style={{ ...cardStyle, padding: "16px 18px", marginBottom: 18, scrollMarginTop: 84 }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <div
          className="msk-search"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            flex: "2 1 300px",
            minWidth: 0,
            height: 38,
            background: C.surfaceSoft,
            borderRadius: 9,
            border: `1px solid ${C.border}`,
            padding: "0 12px",
            color: C.textSubtle,
            transition: "border-color .15s ease, box-shadow .15s ease",
          }}
        >
          <Icon name="search" size={15} />
          <input
            className="msk-bare"
            value={filters.search}
            onChange={(e) => set("search")(e.target.value)}
            placeholder="Zoek op naam, e-mail, telefoon, regio, plaats, tag of partner..."
            aria-label="Leads zoeken"
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 13.5, flex: 1, minWidth: 0, color: C.text, fontFamily: "inherit", height: "100%" }}
          />
        </div>

        <select value={filters.scope} onChange={(e) => set("scope")(e.target.value)} style={selectStyle} aria-label="Welke leads">
          <option value="open">Open leads</option>
          <option value="closed">Gesloten leads</option>
          <option value="archived">Archief</option>
          <option value="all">Alles (incl. archief)</option>
        </select>

        <select value={filters.owner} onChange={(e) => set("owner")(e.target.value)} style={selectStyle} aria-label="Verantwoordelijke">
          <option value="all">Alle verantwoordelijken</option>
          <option value="me">Mijn leads</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
            </option>
          ))}
          <option value="none">Geen verantwoordelijke</option>
        </select>

        <Sel value={filters.stage} onChange={set("stage")} allLabel="Alle fases" options={PIPELINE_STAGES} />
        <Sel value={filters.priority} onChange={set("priority")} allLabel="Alle prioriteiten" options={PRIORITIES} />

        <select value={filters.followUp} onChange={(e) => set("followUp")(e.target.value)} style={selectStyle} aria-label="Opvolgdatum">
          <option value="">Alle opvolgdata</option>
          <option value="overdue">Te laat</option>
          <option value="today">Vandaag</option>
          <option value="week">Komende 7 dagen</option>
          <option value="later">Later</option>
          <option value="nodate">Actie zonder datum</option>
          <option value="none">Geen actie gepland</option>
        </select>

        <select value={filters.sort} onChange={(e) => set("sort")(e.target.value)} style={selectStyle} aria-label="Sorteren">
          <option value="followup">Sorteren: eerst opvolgen</option>
          <option value="newest">Sorteren: nieuwste eerst</option>
          <option value="priority">Sorteren: prioriteit</option>
          <option value="last_activity">Sorteren: laatste activiteit</option>
          <option value="name">Sorteren: naam</option>
        </select>

        <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} style={{ ...btnStyle(active ? "gold" : "primary"), minHeight: 38 }}>
          <Icon name="filter" size={14} /> Meer filters{active ? ` (${active})` : ""}
        </button>
        <button type="button" onClick={() => setFilters({ ...DEFAULT_FILTERS })} style={{ ...btnStyle("neutral"), minHeight: 38, color: C.textMuted }}>
          Reset
        </button>
      </div>

      {more && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.borderSoft}` }}>
          <Sel value={filters.intent} onChange={set("intent")} allLabel="Alle koopintenties" options={PURCHASE_INTENTS} />
          <Sel value={filters.region} onChange={set("region")} allLabel="Alle regio's" options={REGIONS} />
          <Sel value={filters.place} onChange={set("place")} allLabel="Alle plaatsen" options={places.map((p) => ({ value: p, label: p }))} />
          <Sel value={filters.goal} onChange={set("goal")} allLabel="Alle aankoopdoelen" options={PURCHASE_GOALS} />
          <Sel value={filters.timeline} onChange={set("timeline")} allLabel="Alle aankooptermijnen" options={PURCHASE_TIMELINES} />
          <Sel value={filters.source} onChange={set("source")} allLabel="Alle leadbronnen" options={LEAD_SOURCES} />
          <Sel value={filters.partner} onChange={set("partner")} allLabel="Alle partners" options={partners.map((p) => ({ value: p.id, label: p.name }))} />
          <Sel value={filters.nextAction} onChange={set("nextAction")} allLabel="Alle volgende acties" options={NEXT_ACTION_TYPES} />
          <select value={filters.lastActivity} onChange={(e) => set("lastActivity")(e.target.value)} style={selectStyle} aria-label="Laatste activiteit">
            <option value="">Laatste activiteit: alles</option>
            <option value="7">Laatste 7 dagen</option>
            <option value="30">Laatste 30 dagen</option>
            <option value="older30">Langer dan 30 dagen geleden</option>
            <option value="never">Nog nooit</option>
          </select>
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: `1px solid ${C.borderSoft}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 12.5, color: C.textMuted, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {loading ? (
            "Leads laden..."
          ) : (
            <span>
              <strong style={{ color: C.text, fontWeight: 600 }}>{resultCount} resultaten</strong>
              <span className="msk-hide-sm" style={{ color: C.textSubtle }}> · Gepinde leads staan altijd bovenaan</span>
            </span>
          )}
          {filters.quick && (
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <Badge color="#8c6010" bg="#fcf7e8">Snelfilter: {QUICK_FILTERS[filters.quick].label}</Badge>
              <button type="button" onClick={() => set("quick")(null)} className="msk-link" style={linkBtnStyle}>
                wissen
              </button>
            </span>
          )}
          {filters.owner === "me" && currentUser && <Badge color="#33506b" bg="#edf1f5">Alleen leads van {currentUser.displayName}</Badge>}
        </div>

        <div role="group" aria-label="Weergave" style={{ display: "flex", background: C.surfaceSunken, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: 3, gap: 2 }}>
          {[
            ["kaarten", "grid", "Kaarten"],
            ["tabel", "table", "Tabel"],
          ].map(([key, icon, label]) => {
            const on = view === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                aria-pressed={on}
                style={{
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: on ? 600 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "inherit",
                  background: on ? C.surface : "transparent",
                  color: on ? C.navy : C.textMuted,
                  boxShadow: on ? "0 1px 2px rgba(16,42,67,0.08), 0 0 0 1px rgba(16,42,67,0.04)" : "none",
                }}
              >
                <Icon name={icon} size={14} /> {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
