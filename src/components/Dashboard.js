import { useState } from "react";
import { QUICK_FILTERS, SEVERITY_STYLE } from "../crm/signals";
import { Icon, cardStyle, cardTitleStyle, linkBtnStyle, Empty, C } from "./ui";

// Kleur zit alleen in het icoon; de kaart zelf blijft rustig wit.
// Actiegerichte cijfers. Aantallen per fase staan in de tabbladen boven de lijst.
const KPI_CONFIG = [
  { key: "today", icon: "bell", hint: "Acties en afspraken vandaag", color: C.goldText, bg: C.goldSoft },
  { key: "overdue", icon: "alertCircle", hint: "Datum is verstreken", color: C.danger, bg: C.dangerBg },
  { key: "appointments", icon: "calendar", hint: "Gesprekken ingepland", color: C.info, bg: C.infoBg },
  { key: "reserved", icon: "home", hint: "Bod gedaan, aankoop nog niet rond", color: "#85663a", bg: "#f4ede2" },
];

function StatCard({ label, value, hint, icon, color, bg, active, onClick, title = "Klik om de lijst hierop te filteren" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className="msk-kpi"
      style={{
        background: active ? C.surfaceWarm : C.surface,
        borderRadius: 16,
        padding: "16px 18px 14px",
        boxShadow: active ? `inset 0 0 0 1px ${C.gold}, ${C.shadowSm}` : C.shadowSm,
        border: `1px solid ${active ? C.gold : C.border}`,
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.textMuted, lineHeight: 1.3, minWidth: 0, overflowWrap: "anywhere" }}>{label}</span>
        <span
          aria-hidden="true"
          style={{ width: 34, height: 34, borderRadius: 10, background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <Icon name={icon} size={17} />
        </span>
      </div>
      <div style={{ fontFamily: C.fontDisplay, fontSize: String(value).length > 6 ? 26 : 32, fontWeight: 600, color: C.navy, lineHeight: 1, margin: "4px 0 14px", whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ marginTop: "auto", borderTop: `1px solid ${C.borderSoft}`, paddingTop: 10, fontSize: 11.5, color: active ? C.goldText : C.textSubtle, fontWeight: active ? 600 : 400 }}>
        {active ? "Filter actief · klik om te wissen" : hint}
      </div>
    </button>
  );
}

export function KpiRow({ kpis, activeQuick, onQuick, commission }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 42vw), 1fr))", gap: 14, marginBottom: 16 }}>
      {KPI_CONFIG.map((k) => (
        <StatCard
          key={k.key}
          label={QUICK_FILTERS[k.key].label}
          value={kpis[k.key] ?? 0}
          hint={k.hint}
          icon={k.icon}
          color={k.color}
          bg={k.bg}
          active={activeQuick === k.key}
          onClick={() => onQuick(activeQuick === k.key ? null : k.key)}
        />
      ))}
      {commission && (
        <StatCard
          label={`Commissie ${commission.year}`}
          value={commission.value}
          hint={`${commission.count} ${commission.count === 1 ? "aankoop" : "aankopen"} · bekijk alles`}
          icon="chart"
          color={C.success}
          bg={C.successBg}
          active={false}
          title="Open het commissie-overzicht"
          onClick={commission.onOpen}
        />
      )}
    </div>
  );
}

function CardHead({ icon, children, right, iconColor = C.textMuted }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ ...cardTitleStyle, display: "flex", gap: 9, alignItems: "center" }}>
        <span style={{ color: iconColor, display: "flex" }}>
          <Icon name={icon} size={16} />
        </span>
        {children}
      </span>
      {right}
    </div>
  );
}

function CountPill({ children, tone = "neutral" }) {
  const tones = {
    neutral: { bg: C.surfaceSunken, color: C.textMuted },
    gold: { bg: C.goldTint, color: C.goldText },
  };
  const t = tones[tone];
  return <span style={{ background: t.bg, color: t.color, borderRadius: 999, padding: "1px 8px", fontSize: 11.5, fontWeight: 600 }}>{children}</span>;
}

const KIND_META = {
  appointment: { icon: "calendar", color: C.info, bg: C.infoBg },
  action: { icon: "bell", color: C.goldText, bg: C.goldSoft },
  task: { icon: "check", color: C.navy, bg: C.navySoft },
  partner: { icon: "users", color: "#85663a", bg: "#f4ede2" },
};

function rowBtn(warm = false) {
  return {
    textAlign: "left",
    background: warm ? C.surface : C.surface,
    border: `1px solid ${warm ? C.goldBorder : C.borderSoft}`,
    borderRadius: 12,
    padding: "10px 12px",
    cursor: "pointer",
    display: "flex",
    gap: 11,
    alignItems: "flex-start",
    width: "100%",
    fontFamily: "inherit",
  };
}

function LeadName({ lead }) {
  return (
    <span style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13, fontWeight: 600, color: C.text }}>
      {lead.pinned && (
        <span style={{ color: C.gold, display: "flex" }} title="Vastgepind">
          <Icon name="star" size={12} />
        </span>
      )}
      {lead.name || "Naam onbekend"}
    </span>
  );
}

export function TodayPanel({ items, onOpen }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, 6);
  return (
    <div style={cardStyle}>
      <CardHead icon="calendar" right={<CountPill>{items.length}</CountPill>}>
        Vandaag
      </CardHead>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.map((it, i) => {
          const meta = KIND_META[it.kind];
          return (
            <button
              type="button"
              key={`${it.lead.id}-${it.kind}-${i}`}
              onClick={() => onOpen(it.lead, it.kind === "partner" ? "partners" : "followup")}
              className="msk-list-btn"
              style={rowBtn()}
            >
              <span style={{ width: 28, height: 28, borderRadius: 8, background: meta.bg, color: meta.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={meta.icon} size={14} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <LeadName lead={it.lead} />
                <span style={{ display: "block", fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  {it.label}
                  {it.who ? ` · ${it.who}` : ""}
                </span>
              </span>
            </button>
          );
        })}
        {!items.length && <Empty>Niets gepland voor vandaag.</Empty>}
        {items.length > 6 && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="msk-link" style={{ ...linkBtnStyle, textAlign: "left", marginTop: 4 }}>
            {showAll ? "Minder tonen" : `Alle ${items.length} tonen`}
          </button>
        )}
      </div>
    </div>
  );
}

export function AttentionPanel({ list, onOpen, onShowAll }) {
  const visible = list.slice(0, 6);
  const hasItems = list.length > 0;
  return (
    <div
      style={{
        ...cardStyle,
        background: hasItems ? C.goldSoft : C.surface,
        border: `1px solid ${hasItems ? C.goldBorder : C.border}`,
      }}
    >
      <CardHead
        icon="alertCircle"
        iconColor={hasItems ? C.goldText : C.textMuted}
        right={
          hasItems ? (
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CountPill tone="gold">{list.length}</CountPill>
              <button type="button" onClick={onShowAll} className="msk-link" style={linkBtnStyle}>
                Toon in lijst
              </button>
            </span>
          ) : null
        }
      >
        Verlopen acties
      </CardHead>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.map(({ lead, signals }) => (
          <button type="button" key={lead.id} onClick={() => onOpen(lead)} className="msk-list-btn" style={rowBtn(true)}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <LeadName lead={lead} />
              {signals.slice(0, 3).map((s) => (
                <span key={s.key} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: SEVERITY_STYLE[s.severity].color, marginTop: 3 }}>
                  <span style={{ width: 5, height: 5, borderRadius: 99, background: "currentColor", flexShrink: 0 }} />
                  {s.label}
                </span>
              ))}
              {signals.length > 3 && <span style={{ display: "block", fontSize: 11.5, color: C.textSubtle, marginTop: 3 }}>+{signals.length - 3} meer</span>}
            </span>
          </button>
        ))}
        {!hasItems && <Empty>Geen verlopen acties. Alles is bij.</Empty>}
        {list.length > 6 && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>+{list.length - 6} meer · klik op "Toon in lijst"</div>}
      </div>
    </div>
  );
}
