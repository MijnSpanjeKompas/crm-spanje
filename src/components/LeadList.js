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
import { Icon, Badge, OptionBadge, btnStyle, selectStyle, tdStyle, formatBudget } from "./ui";

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
  if (info.state === "none") return { text: "Geen actie gepland", color: info.color };
  const parts = [nextActionText(lead)];
  if (lead.nextActionDate) parts.push(`${formatDate(lead.nextActionDate)} (${info.label.toLowerCase()})`);
  else parts.push("datum ontbreekt");
  if (lead.nextActionAssignedToName) parts.push(lead.nextActionAssignedToName);
  return { text: parts.join(" · "), color: info.color };
}

function PinButton({ lead, onTogglePin, size = 17 }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onTogglePin(lead);
      }}
      title={lead.pinned ? "Lead losmaken" : "Lead vastpinnen"}
      style={{ border: "none", background: "transparent", color: lead.pinned ? "#f59e0b" : "#cbd5e1", cursor: "pointer", padding: 0, display: "flex" }}
    >
      <Icon name="star" size={size} />
    </button>
  );
}

function SignalDot({ signals }) {
  if (!signals.length) return null;
  const worst = signals.some((s) => s.severity === "high") ? "high" : signals.some((s) => s.severity === "medium") ? "medium" : "low";
  return (
    <span title={signals.map((s) => s.label).join("\n")} style={{ color: SEVERITY_STYLE[worst].color, display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 800 }}>
      <Icon name="alert" size={13} /> {signals.length}
    </span>
  );
}

// ─── KAART ───────────────────────────────────────────────────────────────────
export function LeadCard({ lead, onOpen, onArchive, onStageChange, onTogglePin }) {
  const na = nextActionLine(lead);
  const signals = getLeadSignals(lead);
  const budget = formatBudget(lead);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        border: lead.pinned ? "1px solid #f59e0b" : "1px solid #f1f5f9",
        boxShadow: lead.pinned ? "0 2px 10px rgba(245,158,11,0.14)" : "0 1px 4px rgba(0,0,0,0.05)",
        padding: "17px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 11,
        cursor: "pointer",
        opacity: lead.archived ? 0.7 : 1,
      }}
      onClick={() => onOpen(lead)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <PinButton lead={lead} onTogglePin={onTogglePin} />
            <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>{lead.name || "Naam onbekend"}</div>
            <SignalDot signals={signals} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, display: "flex", gap: 5, alignItems: "center" }}>
            <Icon name="map" size={11} />
            {whereText(lead)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <OptionBadge options={PIPELINE_STAGES} value={lead.pipelineStage} />
          {lead.archived && (
            <div style={{ marginTop: 4 }}>
              <Badge>Gearchiveerd</Badge>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <OptionBadge options={PURCHASE_INTENTS} value={lead.purchaseIntent} />
        <OptionBadge options={PRIORITIES} value={lead.priority} prefix="Prio: " />
        {lead.ownerName && (
          <Badge color="#0f172a" bg="#f1f5f9">
            {lead.ownerName}
          </Badge>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 12px", fontSize: 12, color: "#475569" }}>
        <div>
          <strong>Budget:</strong> {budget || "–"}
        </div>
        <div>
          <strong>Doel:</strong> {labelOf(PURCHASE_GOALS, lead.purchaseGoal)}
        </div>
        <div>
          <strong>Termijn:</strong> {labelOf(PURCHASE_TIMELINES, lead.purchaseTimeline)}
        </div>
        <div>
          <strong>Laatste contact:</strong> {lastContactText(lead)}
        </div>
      </div>

      <div style={{ fontSize: 12, background: "#f8fafc", borderRadius: 10, padding: "9px 10px", color: na.color }}>
        <strong style={{ color: "#0f172a" }}>Volgende actie:</strong> {na.text}
      </div>

      {lead.partnerNames?.length > 0 && (
        <div style={{ fontSize: 12, color: "#475569" }}>
          <strong>Partner:</strong> {lead.partnerNames.join(", ")}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }} onClick={(e) => e.stopPropagation()}>
        <select
          value={lead.pipelineStage}
          onChange={(e) => onStageChange(lead, e.target.value)}
          style={{ ...selectStyle, padding: "6px 8px", fontSize: 12, maxWidth: 190 }}
          aria-label="Pipelinefase wijzigen"
        >
          {PIPELINE_STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 7 }}>
          <button type="button" onClick={() => onOpen(lead)} style={btnStyle("#6366f1")}>
            Openen
          </button>
          {!lead.archived && (
            <button type="button" onClick={() => onArchive(lead)} style={btnStyle("#64748b")} title="Archiveren">
              <Icon name="archive" size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TABEL ───────────────────────────────────────────────────────────────────
export function LeadTable({ leads, onOpen, onArchive, onTogglePin }) {
  const headers = ["", "Naam", "Fase", "Koopintentie", "Prio", "Regio / plaats", "Budget", "Verantwoordelijke", "Volgende actie", "Laatste contact", ""];
  return (
    <div style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: 14, overflow: "auto", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {headers.map((h, i) => (
              <th
                key={`${h}-${i}`}
                style={{ textAlign: "left", padding: "12px 14px", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: ".04em", borderBottom: "1px solid #f1f5f9" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const na = nextActionLine(lead);
            const signals = getLeadSignals(lead);
            return (
              <tr key={lead.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                <td style={tdStyle}>
                  <PinButton lead={lead} onTogglePin={onTogglePin} size={15} />
                </td>
                <td style={tdStyle}>
                  <button
                    type="button"
                    onClick={() => onOpen(lead)}
                    style={{ background: "none", border: "none", padding: 0, fontWeight: 800, color: "#0f172a", cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center", fontFamily: "inherit" }}
                  >
                    {lead.name || "Naam onbekend"} <SignalDot signals={signals} />
                  </button>
                </td>
                <td style={tdStyle}>
                  <OptionBadge options={PIPELINE_STAGES} value={lead.pipelineStage} />
                </td>
                <td style={tdStyle}>{labelOf(PURCHASE_INTENTS, lead.purchaseIntent)}</td>
                <td style={tdStyle}>
                  <OptionBadge options={PRIORITIES} value={lead.priority} />
                </td>
                <td style={tdStyle}>{whereText(lead)}</td>
                <td style={tdStyle}>{formatBudget(lead) || "–"}</td>
                <td style={tdStyle}>{lead.ownerName || "–"}</td>
                <td style={{ ...tdStyle, color: na.color, fontWeight: 700, maxWidth: 260 }}>{na.text}</td>
                <td style={tdStyle}>{lastContactText(lead)}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => onOpen(lead)} style={btnStyle("#6366f1")}>
                      Open
                    </button>
                    {!lead.archived && (
                      <button type="button" onClick={() => onArchive(lead)} style={btnStyle("#64748b")} title="Archiveren">
                        <Icon name="archive" size={13} />
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
