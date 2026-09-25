import {
  PIPELINE_STAGES,
  PURCHASE_INTENTS,
  PRIORITIES,
  REGIONS,
  PURCHASE_GOALS,
  PURCHASE_TIMELINES,
  CONTACT_METHODS,
  labelOf,
  nextActionText,
} from "../crm/constants";
import { getNextActionInfo, getLeadSignals, SEVERITY_STYLE } from "../crm/signals";
import { formatDate, formatRelative } from "../crm/dates";
import { Icon, Badge, OptionBadge, btnStyle, selectStyle, tdStyle, formatBudget, C } from "./ui";

function whereText(lead) {
  const regions = (lead.regions || []).filter((r) => r !== "unknown").map((r) => labelOf(REGIONS, r));
  const parts = [...regions, ...(lead.places || [])];
  return parts.length ? parts.join(", ") : "Regio onbekend";
}

function lastContactText(lead) {
  if (!lead.lastContactAt) return "Nog geen contact";
  const method = lead.lastContactMethod ? ` · ${labelOf(CONTACT_METHODS, lead.lastContactMethod)}` : "";
  return `${formatRelative(lead.lastContactAt)}${method}`;
}

function nextActionLine(lead) {
  const info = getNextActionInfo(lead);
  if (info.state === "none") return { text: "Geen actie gepland", color: info.color, info, none: true };
  const parts = [nextActionText(lead)];
  if (lead.nextActionDate) parts.push(`${formatDate(lead.nextActionDate)} (${info.label.toLowerCase()})`);
  else parts.push("datum ontbreekt");
  if (lead.nextActionAssignedToName) parts.push(lead.nextActionAssignedToName);
  return {
    text: parts.join(" · "),
    color: info.color,
    info,
    none: false,
    action: nextActionText(lead),
    when: lead.nextActionDate ? formatDate(lead.nextActionDate) : "Datum ontbreekt",
    who: lead.nextActionAssignedToName || "",
  };
}

const URGENT_STATES = ["overdue", "today", "nodate"];

function PinButton({ lead, onTogglePin, size = 17 }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onTogglePin(lead);
      }}
      title={lead.pinned ? "Lead losmaken" : "Lead vastpinnen"}
      aria-label={lead.pinned ? "Lead losmaken" : "Lead vastpinnen"}
      aria-pressed={lead.pinned}
      style={{
        border: "none",
        background: "transparent",
        color: lead.pinned ? C.gold : "#cfc8bb",
        cursor: "pointer",
        padding: 4,
        margin: -4,
        display: "flex",
        borderRadius: 6,
      }}
    >
      <Icon name="star" size={size} />
    </button>
  );
}

function SignalDot({ signals }) {
  if (!signals.length) return null;
  const worst = signals.some((s) => s.severity === "high") ? "high" : signals.some((s) => s.severity === "medium") ? "medium" : "low";
  const st = SEVERITY_STYLE[worst];
  return (
    <span
      title={signals.map((s) => s.label).join("\n")}
      aria-label={`${signals.length} signalen`}
      style={{ color: st.color, background: st.bg, display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, borderRadius: 99, padding: "1px 7px 1px 5px", flexShrink: 0 }}
    >
      <Icon name="alertCircle" size={12} /> {signals.length}
    </span>
  );
}

function Fact({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: C.textSubtle, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</div>
    </div>
  );
}

// ─── KAART ───────────────────────────────────────────────────────────────────
export function LeadCard({ lead, onOpen, onArchive, onStageChange, onTogglePin }) {
  const na = nextActionLine(lead);
  const signals = getLeadSignals(lead);
  const budget = formatBudget(lead);
  const urgent = URGENT_STATES.includes(na.info.state);

  return (
    <div
      className="msk-card-interactive"
      style={{
        background: C.surface,
        borderRadius: 16,
        border: `1px solid ${lead.pinned ? C.goldBorder : C.border}`,
        boxShadow: C.shadowSm,
        padding: "18px 20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        cursor: "pointer",
        opacity: lead.archived ? 0.72 : 1,
        position: "relative",
        overflow: "hidden",
      }}
      onClick={() => onOpen(lead)}
    >
      {lead.pinned && <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: C.gold }} />}

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PinButton lead={lead} onTogglePin={onTogglePin} size={16} />
          <div style={{ fontWeight: 600, fontSize: 15.5, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
            {lead.name || "Naam onbekend"}
          </div>
          <SignalDot signals={signals} />
        </div>
        <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4, display: "flex", gap: 5, alignItems: "center" }}>
          <Icon name="map" size={12} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{whereText(lead)}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <OptionBadge options={PIPELINE_STAGES} value={lead.pipelineStage} />
        <OptionBadge options={PURCHASE_INTENTS} value={lead.purchaseIntent} />
        <OptionBadge options={PRIORITIES} value={lead.priority} prefix="Prio: " />
        {lead.ownerName && (
          <Badge color="#334a5e" bg="#ffffff" icon="user">
            {lead.ownerName}
          </Badge>
        )}
        {lead.archived && <Badge icon="archive">Gearchiveerd</Badge>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
        <Fact label="Budget">{budget || "–"}</Fact>
        <Fact label="Doel">{labelOf(PURCHASE_GOALS, lead.purchaseGoal)}</Fact>
        <Fact label="Termijn">{labelOf(PURCHASE_TIMELINES, lead.purchaseTimeline)}</Fact>
        <Fact label="Laatste contact">{lastContactText(lead)}</Fact>
      </div>

      {lead.partnerNames?.length > 0 && (
        <div style={{ fontSize: 12.5, color: C.textMuted, display: "flex", gap: 6, alignItems: "center", marginTop: -4 }}>
          <Icon name="users" size={13} />
          <span>
            Partner: <span style={{ color: C.text, fontWeight: 500 }}>{lead.partnerNames.join(", ")}</span>
          </span>
        </div>
      )}

      <div
        style={{
          background: C.surfaceSoft,
          border: `1px solid ${urgent ? `${na.info.color}40` : C.borderSoft}`,
          borderRadius: 12,
          padding: "10px 12px",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: C.surface,
            border: `1px solid ${urgent ? `${na.info.color}33` : C.borderSoft}`,
            color: na.none ? C.textSubtle : urgent ? na.color : C.navy,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={na.none ? "clock" : urgent ? "bell" : "calendar"} size={14} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11.5, color: C.textMuted, display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span>Volgende actie</span>
            {!na.none && na.info.state !== "later" && na.info.state !== "nodate" && <span style={{ color: na.color, fontWeight: 600 }}>{na.info.label}</span>}
          </div>
          {na.none ? (
            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 1 }}>Geen actie gepland</div>
          ) : (
            <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginTop: 1 }}>
              {na.action}
              <span style={{ fontWeight: 400, color: C.textMuted }}>
                {" · "}
                <span style={{ color: urgent ? na.color : C.textMuted }}>{na.when}</span>
                {na.who ? ` · ${na.who}` : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", paddingTop: 12, borderTop: `1px solid ${C.borderSoft}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <select
          value={lead.pipelineStage}
          onChange={(e) => onStageChange(lead, e.target.value)}
          style={{ ...selectStyle, height: 34, padding: "5px 10px", fontSize: 12.5, maxWidth: 200, minWidth: 0, background: C.surfaceSoft }}
          aria-label="Pipelinefase wijzigen"
        >
          {PIPELINE_STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 7 }}>
          <button type="button" onClick={() => onOpen(lead)} style={btnStyle("primary")}>
            Openen
          </button>
          {!lead.archived && (
            <button type="button" onClick={() => onArchive(lead)} style={{ ...btnStyle("neutral"), width: 34, padding: 0, color: C.textMuted }} title="Archiveren" aria-label="Archiveren">
              <Icon name="archive" size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TABEL ───────────────────────────────────────────────────────────────────
const thStyle = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: 11.5,
  fontWeight: 600,
  color: C.textMuted,
  letterSpacing: ".01em",
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: "nowrap",
  background: C.surfaceSoft,
};

export function LeadTable({ leads, onOpen, onArchive, onTogglePin }) {
  const headers = ["", "Naam", "Fase", "Koopintentie", "Prio", "Regio / plaats", "Budget", "Verantwoordelijke", "Volgende actie", "Laatste contact", ""];
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "auto", boxShadow: C.shadowSm }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1320 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={`${h}-${i}`} style={{ ...thStyle, width: i === 0 ? 44 : undefined }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, idx) => {
            const na = nextActionLine(lead);
            const signals = getLeadSignals(lead);
            const last = idx === leads.length - 1;
            const cell = { ...tdStyle, borderBottom: last ? "none" : `1px solid ${C.borderSoft}` };
            return (
              <tr key={lead.id} className="msk-row" style={{ opacity: lead.archived ? 0.72 : 1 }}>
                <td style={cell}>
                  <PinButton lead={lead} onTogglePin={onTogglePin} size={15} />
                </td>
                <td style={cell}>
                  <button
                    type="button"
                    onClick={() => onOpen(lead)}
                    style={{ background: "none", border: "none", padding: 0, fontWeight: 600, fontSize: 13.5, color: C.text, cursor: "pointer", display: "inline-flex", gap: 7, alignItems: "center", fontFamily: "inherit", textAlign: "left", whiteSpace: "nowrap" }}
                  >
                    {lead.name || "Naam onbekend"} <SignalDot signals={signals} />
                  </button>
                </td>
                <td style={cell}>
                  <OptionBadge options={PIPELINE_STAGES} value={lead.pipelineStage} />
                </td>
                <td style={cell}>{labelOf(PURCHASE_INTENTS, lead.purchaseIntent)}</td>
                <td style={cell}>
                  <OptionBadge options={PRIORITIES} value={lead.priority} />
                </td>
                <td style={{ ...cell, minWidth: 150 }}>{whereText(lead)}</td>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>{formatBudget(lead) || "–"}</td>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>{lead.ownerName || "–"}</td>
                <td style={{ ...cell, minWidth: 210, maxWidth: 280 }}>
                  {na.none ? (
                    <span style={{ color: C.textSubtle }}>Geen actie gepland</span>
                  ) : (
                    <>
                      <span style={{ display: "block", color: C.text, fontWeight: 500 }}>{na.action}</span>
                      <span style={{ display: "block", fontSize: 12, color: URGENT_STATES.includes(na.info.state) ? na.color : C.textMuted, fontWeight: URGENT_STATES.includes(na.info.state) ? 500 : 400, marginTop: 1 }}>
                        {na.when}
                        {na.info.state !== "later" && na.info.state !== "nodate" ? ` · ${na.info.label.toLowerCase()}` : ""}
                        {na.who ? ` · ${na.who}` : ""}
                      </span>
                    </>
                  )}
                </td>
                <td style={{ ...cell, minWidth: 140 }}>{lastContactText(lead)}</td>
                <td style={cell}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => onOpen(lead)} style={btnStyle("primary")}>
                      Open
                    </button>
                    {!lead.archived && (
                      <button type="button" onClick={() => onArchive(lead)} style={{ ...btnStyle("neutral"), width: 34, padding: 0, color: C.textMuted }} title="Archiveren" aria-label="Archiveren">
                        <Icon name="archive" size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
