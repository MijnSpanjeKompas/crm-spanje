import { useEffect, useRef, useState } from "react";
import {
  PIPELINE_STAGES,
  PURCHASE_INTENTS,
  PRIORITIES,
  REGIONS,
  PURCHASE_GOALS,
  PURCHASE_TIMELINES,
  LEAD_SOURCES,
  NEXT_ACTION_TYPES,
  PROPERTY_TYPES,
  BUILD_PREFERENCES,
  labelOf,
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

// Pipelinetabs: de dagelijkse fases direct zichtbaar, de rest onder "Meer".
const PRIMARY_TABS = ["open", "new_lead", "contact_phase", "appointment_scheduled", "partner_connected", "follow_up_later"];
const MORE_TABS = ["purchase_process", "completed", "unreachable", "stopped", "archived"];

// Korte namen (volledige fasenaam in de tooltip).
const SHORT_LABELS = {
  open: "Alle open",
  new_lead: "Nieuw",
  contact_phase: "Contact",
  appointment_scheduled: "Gesprek",
  partner_connected: "Doorgestuurd",
  follow_up_later: "Later",
  unreachable: "Niet bereikbaar",
  archived: "Archief",
};

function tabLabel(key) {
  return SHORT_LABELS[key] || labelOf(PIPELINE_STAGES, key);
}

function tabTitle(key) {
  if (key === "open") return "Alle leads die nog lopen";
  if (key === "archived") return "Gearchiveerde leads";
  return `Fase: ${labelOf(PIPELINE_STAGES, key)}`;
}

/** Welk tabblad hoort bij de huidige filters (null als een snelfilter actief is). */
export function activeTabOf(filters) {
  if (filters.quick) return null;
  if (filters.scope === "archived") return "archived";
  if (filters.stage) return filters.stage;
  return filters.scope === "open" ? "open" : null;
}

export function filtersForTab(key) {
  if (key === "open") return { scope: "open", stage: "", quick: null };
  if (key === "archived") return { scope: "archived", stage: "", quick: null };
  return { scope: "open", stage: key, quick: null };
}

function TabButton({ k, active, count, onChange, inMenu }) {
  const on = active === k;
  return (
    <button
      role={inMenu ? "menuitem" : "tab"}
      type="button"
      aria-selected={inMenu ? undefined : on}
      title={tabTitle(k)}
      className={inMenu ? "msk-list-btn" : "msk-tab"}
      onClick={() => onChange(k)}
      style={
        inMenu
          ? { display: "flex", justifyContent: "space-between", gap: 12, width: "100%", border: "1px solid transparent", background: on ? C.navySoft : "none", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", color: on ? C.navy : C.text, fontWeight: on ? 600 : 500 }
          : { border: "none", borderBottom: `2px solid ${on ? C.gold : "transparent"}`, marginBottom: -1, background: "none", padding: "13px 9px 12px", fontSize: 13, fontWeight: on ? 600 : 500, color: on ? C.navy : count ? C.textBody : C.textSubtle, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", display: "flex", gap: 7, alignItems: "center" }
      }
    >
      {tabLabel(k)}
      <span style={{ background: on ? C.navy : C.surfaceSunken, color: on ? "#fff" : count ? C.textMuted : C.textSubtle, borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 600, minWidth: 20, textAlign: "center" }}>{count || 0}</span>
    </button>
  );
}

function StageTabs({ counts, active, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const moreActive = MORE_TABS.includes(active);
  return (
    <div role="tablist" aria-label="Pipelinefase" style={{ display: "flex", alignItems: "stretch", gap: 2, flexWrap: "wrap", borderBottom: `1px solid ${C.border}`, margin: "0 -18px", padding: "0 12px" }}>
      {PRIMARY_TABS.map((k) => (
        <TabButton key={k} k={k} active={active} count={counts[k]} onChange={onChange} />
      ))}
      <div ref={ref} style={{ position: "relative", display: "flex" }}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="msk-tab"
          style={{ border: "none", borderBottom: `2px solid ${moreActive ? C.gold : "transparent"}`, marginBottom: -1, background: "none", padding: "13px 9px 12px", fontSize: 13, fontWeight: moreActive ? 600 : 500, color: moreActive ? C.navy : C.textBody, cursor: "pointer", fontFamily: "inherit", display: "flex", gap: 5, alignItems: "center" }}
        >
          {moreActive ? tabLabel(active) : "Meer"} <Icon name="chevron" size={13} />
        </button>
        {open && (
          <div role="menu" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 40, minWidth: 220, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadowMd, padding: 6 }}>
            {MORE_TABS.map((k) => (
              <TabButton
                key={k}
                k={k}
                active={active}
                count={counts[k]}
                inMenu
                onChange={(key) => {
                  setOpen(false);
                  onChange(key);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function LeadFilters({ filters, setFilters, users, partners, places, currentUser, resultCount, loading, view, setView, tabCounts = {} }) {
  const [more, setMore] = useState(false);
  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));
  const active = countActiveFilters(filters);
  const tab = activeTabOf(filters);

  return (
    <div id="lead-list" style={{ ...cardStyle, padding: "0 18px 16px", marginBottom: 18, scrollMarginTop: 84 }}>
      <StageTabs counts={tabCounts} active={tab} onChange={(key) => setFilters((f) => ({ ...f, ...filtersForTab(key) }))} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 16 }}>
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
            placeholder="Zoek op naam, e-mail, telefoon, plaats of partner..."
            aria-label="Leads zoeken"
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 13.5, flex: 1, minWidth: 0, color: C.text, fontFamily: "inherit", height: "100%" }}
          />
        </div>

        <select value={filters.owner} onChange={(e) => set("owner")(e.target.value)} style={selectStyle} aria-label="Verantwoordelijke">
          <option value="all">Iedereen</option>
          <option value="me">Mijn leads</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
            </option>
          ))}
          <option value="none">Geen verantwoordelijke</option>
        </select>

        <select value={filters.followUp} onChange={(e) => set("followUp")(e.target.value)} style={selectStyle} aria-label="Opvolgdatum">
          <option value="">Alle opvolgdata</option>
          <option value="overdue">Te laat</option>
          <option value="today">Vandaag</option>
          <option value="week">Komende 7 dagen</option>
          <option value="month">Ergens deze maand</option>
          <option value="later">Later</option>
          <option value="nodate">Actie zonder datum</option>
          <option value="none">Geen actie gepland</option>
        </select>

        <select value={filters.sort} onChange={(e) => set("sort")(e.target.value)} style={selectStyle} aria-label="Sorteren">
          <option value="followup">Eerst opvolgen</option>
          <option value="newest">Nieuwste eerst</option>
          <option value="priority">Prioriteit</option>
          <option value="last_activity">Laatste activiteit</option>
          <option value="name">Naam A–Z</option>
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
          <Sel value={filters.priority} onChange={set("priority")} allLabel="Alle prioriteiten" options={PRIORITIES} />
          <Sel value={filters.intent} onChange={set("intent")} allLabel="Alle koopintenties" options={PURCHASE_INTENTS} />
          <Sel value={filters.region} onChange={set("region")} allLabel="Alle regio's" options={REGIONS} />
          <Sel value={filters.place} onChange={set("place")} allLabel="Alle plaatsen" options={places.map((p) => ({ value: p, label: p }))} />
          <Sel value={filters.goal} onChange={set("goal")} allLabel="Alle aankoopdoelen" options={PURCHASE_GOALS} />
          <Sel value={filters.timeline} onChange={set("timeline")} allLabel="Alle aankooptermijnen" options={PURCHASE_TIMELINES} />
          <Sel value={filters.propertyType} onChange={set("propertyType")} allLabel="Alle woningtypes" options={PROPERTY_TYPES} />
          <Sel value={filters.build} onChange={set("build")} allLabel="Nieuwbouw en bestaand" options={BUILD_PREFERENCES} />
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
