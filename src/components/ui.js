// ─── GEDEELDE UI-COMPONENTEN ─────────────────────────────────────────────────
// Bestaande huisstijl (kleuren, radius, inline styles) is 1-op-1 overgenomen
// uit de oude App.js. Alleen nieuwe bouwstenen zijn toegevoegd.

import { useState } from "react";
import { labelOf, optionOf } from "../crm/constants";

// ─── STYLES ──────────────────────────────────────────────────────────────────
export const baseTextSelection = { WebkitUserSelect: "text", userSelect: "text" };

export const inputStyle = {
  width: "100%",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
  color: "#0f172a",
  background: "#f8fafc",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  WebkitUserSelect: "text",
  userSelect: "text",
};

export const selectStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: "#0f172a",
  background: "#fff",
  cursor: "pointer",
  outline: "none",
};

export const labelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: "#64748b",
  marginBottom: 5,
  display: "block",
};

export const cardStyle = {
  background: "#fff",
  borderRadius: 14,
  padding: "16px 18px",
  border: "1px solid #f1f5f9",
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
};

export const tdStyle = { padding: "12px 14px", fontSize: 12, color: "#475569", verticalAlign: "middle" };

export function btnStyle(color, solid = false) {
  return {
    background: solid ? color : `${color}12`,
    color: solid ? "#fff" : color,
    border: solid ? "none" : `1px solid ${color}30`,
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    gap: 5,
    alignItems: "center",
    fontWeight: 700,
    fontFamily: "inherit",
  };
}

// ─── ICONS ───────────────────────────────────────────────────────────────────
const P = { fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" };

export const Icon = ({ name, size = 16 }) => {
  const icons = {
    search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
    trash: <><polyline points="3,6 5,6 21,6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    map: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
    chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>,
    table: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
    chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
    home: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
    cog: <><circle cx="12" cy="12" r="3" /><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></>,
    dot: <circle cx="12" cy="12" r="4" />,
    archive: <><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></>,
    alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
    check: <polyline points="20 6 9 17 4 12" />,
    filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
  };
  if (name === "star") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2.8l2.8 5.67 6.25.91-4.52 4.41 1.07 6.23L12 17.08l-5.6 2.94 1.07-6.23-4.52-4.41 6.25-.91L12 2.8z" />
      </svg>
    );
  }
  const content = icons[name];
  if (!content) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...P}>
      {content}
    </svg>
  );
};

// ─── BADGES ──────────────────────────────────────────────────────────────────
export function Badge({ children, color = "#64748b", bg = "#f8fafc", title }) {
  return (
    <span
      title={title}
      style={{
        background: bg,
        color,
        border: `1px solid ${color}22`,
        borderRadius: 999,
        padding: "3px 9px",
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/** Badge op basis van een optielijst met color/bg. */
export function OptionBadge({ options, value, prefix = "" }) {
  const opt = optionOf(options, value);
  if (!opt) return null;
  return (
    <Badge color={opt.color || "#64748b"} bg={opt.bg || "#f8fafc"}>
      {prefix}
      {opt.label}
    </Badge>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div
      style={{
        fontSize: 14,
        fontWeight: 900,
        color: "#0f172a",
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: "1px solid #f1f5f9",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span>{children}</span>
      {right}
    </div>
  );
}

export function Panel({ title, right, children, style }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: 14, padding: 16, ...style }}>
      {title && <SectionTitle right={right}>{title}</SectionTitle>}
      {children}
    </div>
  );
}

// ─── FORMULIERVELDEN ─────────────────────────────────────────────────────────
function ErrorText({ error }) {
  if (!error) return null;
  return <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontWeight: 600 }}>{error}</div>;
}

export function FieldWrap({ label, error, hint, children }) {
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      {children}
      {hint && !error && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{hint}</div>}
      <ErrorText error={error} />
    </div>
  );
}

const errBorder = (error) => (error ? { border: "1px solid #fca5a5", background: "#fff7f7" } : null);

export function TextField({ label, value, onChange, type = "text", error, hint, placeholder, ...rest }) {
  return (
    <FieldWrap label={label} error={error} hint={hint}>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, ...errBorder(error) }}
        {...rest}
      />
    </FieldWrap>
  );
}

export function NumberField({ label, value, onChange, error, hint, placeholder, step }) {
  return (
    <FieldWrap label={label} error={error} hint={hint}>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        step={step}
        value={value === null || value === undefined ? "" : value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        style={{ ...inputStyle, ...errBorder(error) }}
      />
    </FieldWrap>
  );
}

export function TextAreaField({ label, value, onChange, rows = 4, error, hint, placeholder }) {
  return (
    <FieldWrap label={label} error={error} hint={hint}>
      <textarea
        value={value ?? ""}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, ...errBorder(error) }}
      />
    </FieldWrap>
  );
}

/** Select met optie-objecten {value,label}. */
export function SelectField({ label, value, onChange, options, error, hint, placeholder = "Selecteer...", allowEmpty = true }) {
  return (
    <FieldWrap label={label} error={error} hint={hint}>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, ...errBorder(error) }}>
        {allowEmpty && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrap>
  );
}

/** Gebruiker kiezen; geeft (id, naam) terug zodat beide opgeslagen kunnen worden. */
export function UserSelectField({ label, value, onChange, users, error, placeholder = "Niemand" }) {
  return (
    <FieldWrap label={label} error={error}>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const u = users.find((x) => x.id === e.target.value);
          onChange(e.target.value, u?.displayName || "");
        }}
        style={{ ...inputStyle, ...errBorder(error) }}
      >
        <option value="">{placeholder}</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName}
          </option>
        ))}
      </select>
    </FieldWrap>
  );
}

function chipStyle(active) {
  return {
    border: `1px solid ${active ? "#6366f1" : "#e2e8f0"}`,
    background: active ? "#eef2ff" : "#fff",
    color: active ? "#6366f1" : "#64748b",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

/** Meerkeuze met chips (bijv. regio's, woningtypes, wensen). */
export function ChipMultiSelect({ label, options, value = [], onChange, error, hint }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <FieldWrap label={label} error={error} hint={hint}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {options.map((o) => (
          <button type="button" key={o.value} onClick={() => toggle(o.value)} style={chipStyle(value.includes(o.value))}>
            {o.label}
          </button>
        ))}
      </div>
    </FieldWrap>
  );
}

/** Vrije lijst (plaatsen, tags) met suggesties. */
export function TagInput({ label, value = [], onChange, suggestions = [], placeholder = "Typ en druk op Enter", hint }) {
  const [text, setText] = useState("");
  const add = (raw) => {
    const v = String(raw || "").trim();
    if (!v) return;
    if (!value.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...value, v]);
    setText("");
  };
  const remaining = suggestions.filter((s) => !value.some((x) => x.toLowerCase() === s.toLowerCase()));
  return (
    <FieldWrap label={label} hint={hint}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: value.length ? 8 : 0 }}>
        {value.map((v) => (
          <span key={v} style={{ ...chipStyle(true), display: "inline-flex", gap: 6, alignItems: "center", cursor: "default" }}>
            {v}
            <button
              type="button"
              aria-label={`${v} verwijderen`}
              onClick={() => onChange(value.filter((x) => x !== v))}
              style={{ border: "none", background: "none", color: "#6366f1", cursor: "pointer", padding: 0, display: "flex" }}
            >
              <Icon name="x" size={12} />
            </button>
          </span>
        ))}
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(text);
          }
        }}
        onBlur={() => add(text)}
        placeholder={placeholder}
        style={inputStyle}
      />
      {remaining.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {remaining.slice(0, 12).map((s) => (
            <button type="button" key={s} onClick={() => add(s)} style={{ ...chipStyle(false), padding: "4px 8px", fontSize: 11 }}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </FieldWrap>
  );
}

// ─── MODAL & TABS ────────────────────────────────────────────────────────────
export function Modal({ children, onClose, maxWidth = 980, zIndex = 1000 }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,.45)",
        zIndex,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "24px 16px",
        overflowY: "auto",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          ...baseTextSelection,
          background: "#fff",
          borderRadius: 18,
          width: "100%",
          maxWidth,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          padding: "24px 26px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div role="tablist" style={{ display: "flex", gap: 4, borderBottom: "1px solid #e2e8f0", overflowX: "auto" }}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={on}
            type="button"
            onClick={() => onChange(t.key)}
            style={{
              border: "none",
              borderBottom: `2px solid ${on ? "#6366f1" : "transparent"}`,
              background: "none",
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 800,
              color: on ? "#6366f1" : t.disabled ? "#cbd5e1" : "#64748b",
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{ background: on ? "#eef2ff" : "#f1f5f9", borderRadius: 999, padding: "1px 7px", fontSize: 11 }}>{t.count}</span>
            )}
            {t.alert && <span style={{ width: 7, height: 7, borderRadius: 99, background: "#ef4444" }} />}
          </button>
        );
      })}
    </div>
  );
}

export function Notice({ tone = "info", children }) {
  const tones = {
    info: { color: "#3730a3", bg: "#eef2ff", border: "#c7d2fe" },
    warn: { color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
    error: { color: "#991b1b", bg: "#fef2f2", border: "#fecaca" },
    ok: { color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
  };
  const t = tones[tone];
  return (
    <div style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 12, lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

export function Empty({ children }) {
  return <div style={{ fontSize: 12, color: "#94a3b8", padding: "10px 2px" }}>{children}</div>;
}

export function formatEuro(n) {
  if (n === null || n === undefined || n === "") return "";
  return `€ ${Number(n).toLocaleString("nl-NL")}`;
}

export function formatBudget(lead) {
  const { budgetMin: min, budgetMax: max } = lead;
  if (min != null && max != null) return `${formatEuro(min)} – ${formatEuro(max)}`;
  if (max != null) return `Tot ${formatEuro(max)}`;
  if (min != null) return `Vanaf ${formatEuro(min)}`;
  return "";
}

export function formatList(options, values) {
  return (values || []).map((v) => labelOf(options, v)).join(", ");
}

export function formatBytes(n) {
  if (!n) return "0 KB";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
