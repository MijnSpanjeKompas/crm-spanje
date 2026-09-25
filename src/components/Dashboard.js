import { useState } from "react";
import { PIPELINE_STAGES } from "../crm/constants";
import { QUICK_FILTERS, SEVERITY_STYLE } from "../crm/signals";
import { Icon, cardStyle, Empty } from "./ui";

const KPI_CONFIG = [
  { key: "new", accent: "#6366f1", icon: "plus" },
  { key: "today", accent: "#f59e0b", icon: "bell" },
  { key: "overdue", accent: "#ef4444", icon: "alert" },
  { key: "appointments", accent: "#0891b2", icon: "calendar" },
  { key: "waiting_partner", accent: "#10b981", icon: "users" },
  { key: "active_search", accent: "#8b5cf6", icon: "search" },
];

function StatCard({ label, value, accent, icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Klik om de lijst hierop te filteren"
      style={{
        background: active ? `${accent}0d` : "#fff",
        borderRadius: 14,
        padding: "14px 16px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        border: `1px solid ${active ? accent : "#f1f5f9"}`,
        flex: 1,
        minWidth: 150,
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          color: accent,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: ".04em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        <Icon name={icon} size={13} />
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>{value}</div>
    </button>
  );
}

export function KpiRow({ kpis, activeQuick, onQuick }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
      {KPI_CONFIG.map((k) => (
        <StatCard
          key={k.key}
          label={QUICK_FILTERS[k.key].label}
          value={kpis[k.key] ?? 0}
          accent={k.accent}
          icon={k.icon}
          active={activeQuick === k.key}
          onClick={() => onQuick(activeQuick === k.key ? null : k.key)}
        />
      ))}
    </div>
  );
}

export function StageChart({ leads, onPick }) {
  const open = leads.filter((l) => !l.archived);
  const counts = {};
  PIPELINE_STAGES.forEach((s) => (counts[s.value] = open.filter((l) => l.pipelineStage === s.value).length));
  const max = Math.max(...Object.values(counts), 1);
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <Icon name="chart" size={14} /> Leads per fase
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {PIPELINE_STAGES.map((s) => (
          <button
            type="button"
            key={s.value}
            onClick={() => onPick(s.value)}
            style={{ display: "flex", alignItems: "center", gap: 8, border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
          >
            <div style={{ width: 150, fontSize: 11, color: "#64748b", flexShrink: 0, textAlign: "left" }}>{s.label}</div>
            <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 6, height: 9, overflow: "hidden" }}>
              <div style={{ width: `${(counts[s.value] / max) * 100}%`, height: "100%", background: s.color, borderRadius: 6 }} />
            </div>
            <div style={{ width: 20, fontSize: 11, fontWeight: 800, color: "#0f172a", textAlign: "right" }}>{counts[s.value]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

const KIND_META = {
  appointment: { icon: "calendar", color: "#0891b2" },
  action: { icon: "bell", color: "#f59e0b" },
  task: { icon: "check", color: "#6366f1" },
  partner: { icon: "users", color: "#10b981" },
};

function rowBtn() {
  return {
    textAlign: "left",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "8px 10px",
    cursor: "pointer",
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    width: "100%",
    fontFamily: "inherit",
  };
}

export function TodayPanel({ items, onOpen }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, 6);
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <Icon name="calendar" size={14} /> Vandaag ({items.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.map((it, i) => {
          const meta = KIND_META[it.kind];
          return (
            <button type="button" key={`${it.lead.id}-${it.kind}-${i}`} onClick={() => onOpen(it.lead, it.kind === "partner" ? "partners" : "followup")} style={rowBtn()}>
              <span style={{ color: meta.color, marginTop: 1 }}>
                <Icon name={meta.icon} size={14} />
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                  {it.lead.pinned ? "★ " : ""}
                  {it.lead.name || "Naam onbekend"}
                </span>
                <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {it.label}
                  {it.who ? ` – ${it.who}` : ""}
                </span>
              </span>
            </button>
          );
        })}
        {!items.length && <Empty>Niets gepland voor vandaag.</Empty>}
        {items.length > 6 && (
          <button type="button" onClick={() => setShowAll((v) => !v)} style={{ border: "none", background: "none", color: "#6366f1", fontSize: 11, fontWeight: 800, cursor: "pointer", textAlign: "left" }}>
            {showAll ? "Minder tonen" : `Alle ${items.length} tonen`}
          </button>
        )}
      </div>
    </div>
  );
}

export function AttentionPanel({ list, onOpen, onShowAll }) {
  const visible = list.slice(0, 6);
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 12, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Icon name="alert" size={14} /> Aandacht nodig ({list.length})
        </span>
        {list.length > 0 && (
          <button type="button" onClick={onShowAll} style={{ border: "none", background: "none", color: "#6366f1", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
            Toon in lijst
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.map(({ lead, signals }) => (
          <button type="button" key={lead.id} onClick={() => onOpen(lead)} style={rowBtn()}>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                {lead.pinned ? "★ " : ""}
                {lead.name || "Naam onbekend"}
              </span>
              {signals.slice(0, 3).map((s) => (
                <span key={s.key} style={{ display: "block", fontSize: 11, color: SEVERITY_STYLE[s.severity].color, marginTop: 2 }}>
                  • {s.label}
                </span>
              ))}
              {signals.length > 3 && <span style={{ display: "block", fontSize: 11, color: "#94a3b8" }}>+{signals.length - 3} meer</span>}
            </span>
          </button>
        ))}
        {!list.length && <Empty>Alles is bijgewerkt. Geen signalen.</Empty>}
        {list.length > 6 && <div style={{ fontSize: 11, color: "#94a3b8" }}>+{list.length - 6} meer — klik op "Toon in lijst"</div>}
      </div>
    </div>
  );
}
