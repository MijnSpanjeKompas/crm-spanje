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
import { Icon, selectStyle, btnStyle, Badge } from "./ui";

function Sel({ value, onChange, allLabel, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
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
      style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #f1f5f9", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 18 }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: 1,
            minWidth: 230,
            background: "#f8fafc",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            padding: "8px 12px",
          }}
        >
          <Icon name="search" size={14} />
          <input
            value={filters.search}
            onChange={(e) => set("search")(e.target.value)}
            placeholder="Zoek op naam, e-mail, telefoon, regio, plaats, tag of partner..."
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, flex: 1, color: "#0f172a", fontFamily: "inherit" }}
          />
        </div>

        <select value={filters.scope} onChange={(e) => set("scope")(e.target.value)} style={selectStyle}>
          <option value="open">Open leads</option>
          <option value="closed">Gesloten leads</option>
          <option value="archived">Archief</option>
          <option value="all">Alles (incl. archief)</option>
        </select>

        <select value={filters.owner} onChange={(e) => set("owner")(e.target.value)} style={selectStyle}>
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

        <select value={filters.followUp} onChange={(e) => set("followUp")(e.target.value)} style={selectStyle}>
          <option value="">Alle opvolgdata</option>
          <option value="overdue">Te laat</option>
          <option value="today">Vandaag</option>
          <option value="week">Komende 7 dagen</option>
          <option value="later">Later</option>
          <option value="nodate">Actie zonder datum</option>
          <option value="none">Geen actie gepland</option>
        </select>

        <select value={filters.sort} onChange={(e) => set("sort")(e.target.value)} style={selectStyle}>
          <option value="followup">Sorteren: eerst opvolgen</option>
          <option value="newest">Sorteren: nieuwste eerst</option>
          <option value="priority">Sorteren: prioriteit</option>
          <option value="last_activity">Sorteren: laatste activiteit</option>
          <option value="name">Sorteren: naam</option>
        </select>

        <button type="button" onClick={() => setMore((v) => !v)} style={btnStyle("#6366f1")}>
          <Icon name="filter" size={13} /> Meer filters{active ? ` (${active})` : ""}
        </button>
        <button type="button" onClick={() => setFilters({ ...DEFAULT_FILTERS })} style={btnStyle("#64748b")}>
          Reset
        </button>
      </div>

      {more && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
          <Sel value={filters.intent} onChange={set("intent")} allLabel="Alle koopintenties" options={PURCHASE_INTENTS} />
          <Sel value={filters.region} onChange={set("region")} allLabel="Alle regio's" options={REGIONS} />
          <Sel value={filters.place} onChange={set("place")} allLabel="Alle plaatsen" options={places.map((p) => ({ value: p, label: p }))} />
          <Sel value={filters.goal} onChange={set("goal")} allLabel="Alle aankoopdoelen" options={PURCHASE_GOALS} />
          <Sel value={filters.timeline} onChange={set("timeline")} allLabel="Alle aankooptermijnen" options={PURCHASE_TIMELINES} />
          <Sel value={filters.source} onChange={set("source")} allLabel="Alle leadbronnen" options={LEAD_SOURCES} />
          <Sel value={filters.partner} onChange={set("partner")} allLabel="Alle partners" options={partners.map((p) => ({ value: p.id, label: p.name }))} />
          <Sel value={filters.nextAction} onChange={set("nextAction")} allLabel="Alle volgende acties" options={NEXT_ACTION_TYPES} />
          <select value={filters.lastActivity} onChange={(e) => set("lastActivity")(e.target.value)} style={selectStyle}>
            <option value="">Laatste activiteit: alles</option>
            <option value="7">Laatste 7 dagen</option>
            <option value="30">Laatste 30 dagen</option>
            <option value="older30">Langer dan 30 dagen geleden</option>
            <option value="never">Nog nooit</option>
          </select>
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {loading ? "Leads laden..." : `${resultCount} resultaten · Gepinde leads staan altijd bovenaan`}
          {filters.quick && (
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <Badge color="#6366f1" bg="#eef2ff">Snelfilter: {QUICK_FILTERS[filters.quick].label}</Badge>
              <button type="button" onClick={() => set("quick")(null)} style={{ border: "none", background: "none", color: "#6366f1", cursor: "pointer", fontSize: 11, fontWeight: 800 }}>
                wissen
              </button>
            </span>
          )}
          {filters.owner === "me" && currentUser && <Badge color="#0ea5e9" bg="#e0f2fe">Alleen leads van {currentUser.displayName}</Badge>}
        </div>

        <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: 9, overflow: "hidden" }}>
          {[
            ["kaarten", "grid", "Kaarten"],
            ["tabel", "table", "Tabel"],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              style={{
                border: "none",
                padding: "8px 11px",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "inherit",
                background: view === key ? "#eef2ff" : "#fff",
                color: view === key ? "#6366f1" : "#64748b",
              }}
            >
              <Icon name={icon} size={13} /> {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
