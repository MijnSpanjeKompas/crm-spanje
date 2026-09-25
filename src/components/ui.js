// ─── GEDEELDE UI-COMPONENTEN ─────────────────────────────────────────────────
// Visuele huisstijl van Mijn Spanje Kompas. Alle kleuren lopen via de CSS
// design tokens in src/index.css (zie het `C`-object hieronder), zodat de
// CRM dezelfde uitstraling heeft als het Command Center.

import { useState } from "react";
import { labelOf, optionOf } from "../crm/constants";

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
export const C = {
  navy: "var(--msk-navy)",
  navyHover: "var(--msk-navy-hover)",
  navyDark: "var(--msk-navy-dark)",
  navyDeep: "var(--msk-navy-deep)",
  navySoft: "var(--msk-navy-soft)",
  navyTint: "var(--msk-navy-tint)",
  gold: "var(--msk-gold)",
  goldText: "var(--msk-gold-text)",
  goldSoft: "var(--msk-gold-soft)",
  goldTint: "var(--msk-gold-tint)",
  goldBorder: "var(--msk-gold-border)",
  bg: "var(--msk-bg)",
  surface: "var(--msk-surface)",
  surfaceWarm: "var(--msk-surface-warm)",
  surfaceSoft: "var(--msk-surface-soft)",
  surfaceSunken: "var(--msk-surface-sunken)",
  border: "var(--msk-border)",
  borderSoft: "var(--msk-border-soft)",
  borderStrong: "var(--msk-border-strong)",
  text: "var(--msk-text)",
  textBody: "var(--msk-text-body)",
  textMuted: "var(--msk-text-muted)",
  textSubtle: "var(--msk-text-subtle)",
  textDisabled: "var(--msk-text-disabled)",
  success: "var(--msk-success)",
  successBg: "var(--msk-success-bg)",
  successBorder: "var(--msk-success-border)",
  warning: "var(--msk-warning)",
  warningBg: "var(--msk-warning-bg)",
  warningBorder: "var(--msk-warning-border)",
  danger: "var(--msk-danger)",
  dangerBg: "var(--msk-danger-bg)",
  dangerBorder: "var(--msk-danger-border)",
  info: "var(--msk-info)",
  infoBg: "var(--msk-info-bg)",
  infoBorder: "var(--msk-info-border)",
  radiusSm: "var(--radius-sm)",
  radiusMd: "var(--radius-md)",
  radiusLg: "var(--radius-lg)",
  radiusXl: "var(--radius-xl)",
  shadowSm: "var(--shadow-sm)",
  shadowMd: "var(--shadow-md)",
  shadowLg: "var(--shadow-lg)",
  fontUi: "var(--font-ui)",
  fontDisplay: "var(--font-display)",
};

// ─── STYLES ──────────────────────────────────────────────────────────────────
export const baseTextSelection = { WebkitUserSelect: "text", userSelect: "text" };

export const inputStyle = {
  width: "100%",
  border: `1px solid ${C.border}`,
  borderRadius: 9,
  padding: "9px 12px",
  minHeight: 38,
  fontSize: 13.5,
  lineHeight: 1.4,
  color: C.text,
  background: C.surfaceSoft,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color .15s ease, box-shadow .15s ease, background-color .15s ease",
  WebkitUserSelect: "text",
  userSelect: "text",
};

export const selectStyle = {
  border: `1px solid ${C.border}`,
  borderRadius: 9,
  padding: "8px 12px",
  height: 38,
  fontSize: 13,
  color: C.text,
  background: C.surface,
  cursor: "pointer",
  outline: "none",
  fontFamily: "inherit",
};

export const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: C.textBody,
  marginBottom: 6,
  display: "block",
};

export const cardStyle = {
  background: C.surface,
  borderRadius: 16,
  padding: "20px 22px",
  border: `1px solid ${C.border}`,
  boxShadow: C.shadowSm,
};

export const tdStyle = { padding: "14px 16px", fontSize: 13, color: C.textBody, verticalAlign: "middle" };

/** Kleine koptekst binnen kaarten (sans-serif, rustig). */
export const cardTitleStyle = { fontSize: 14.5, fontWeight: 600, color: C.text, letterSpacing: "-0.005em" };

/** Kleine subtiele link-knop. */
export const linkBtnStyle = {
  border: "none",
  background: "none",
  color: C.goldText,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
  fontFamily: "inherit",
};

/** Sluit-/icoonknop zonder rand. */
export const iconBtnStyle = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: C.textSubtle,
  width: 36,
  height: 36,
  borderRadius: 10,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

// Knopvarianten. `solid` = primaire (gevulde) variant.
const BUTTON_TONES = {
  primary: {
    solid: { bg: C.navy, color: "#fff", border: C.navy, hoverBg: C.navyHover, hoverBorder: C.navyHover },
    soft: { bg: C.surface, color: C.navy, border: C.border, hoverBg: C.surfaceSoft, hoverBorder: C.borderStrong },
  },
  neutral: {
    solid: { bg: C.textBody, color: "#fff", border: C.textBody, hoverBg: C.text, hoverBorder: C.text },
    soft: { bg: C.surface, color: C.textBody, border: C.border, hoverBg: C.surfaceSoft, hoverBorder: C.borderStrong },
  },
  gold: {
    solid: { bg: C.gold, color: C.navyDark, border: C.gold, hoverBg: "#cf9c30", hoverBorder: "#cf9c30" },
    soft: { bg: C.goldSoft, color: C.goldText, border: C.goldBorder, hoverBg: C.goldTint, hoverBorder: C.goldBorder },
  },
  success: {
    solid: { bg: C.success, color: "#fff", border: C.success, hoverBg: "#27684a", hoverBorder: "#27684a" },
    soft: { bg: C.surface, color: C.success, border: C.successBorder, hoverBg: C.successBg, hoverBorder: C.successBorder },
  },
  danger: {
    solid: { bg: C.danger, color: "#fff", border: C.danger, hoverBg: "#9c3a30", hoverBorder: "#9c3a30" },
    soft: { bg: C.surface, color: C.danger, border: C.dangerBorder, hoverBg: C.dangerBg, hoverBorder: C.dangerBorder },
  },
  info: {
    solid: { bg: C.info, color: "#fff", border: C.info, hoverBg: "#305a78", hoverBorder: "#305a78" },
    soft: { bg: C.surface, color: C.info, border: C.infoBorder, hoverBg: C.infoBg, hoverBorder: C.infoBorder },
  },
};

// Vangnet voor oude aanroepen met een hexkleur.
const LEGACY_TONES = {
  "#6366f1": "primary",
  "#64748b": "neutral",
  "#10b981": "success",
  "#ef4444": "danger",
  "#f59e0b": "gold",
  "#0ea5e9": "info",
  "#0891b2": "info",
};

export function btnStyle(tone = "neutral", solid = false) {
  const key = LEGACY_TONES[tone] || tone;
  const t = (BUTTON_TONES[key] || BUTTON_TONES.neutral)[solid ? "solid" : "soft"];
  return {
    background: t.bg,
    color: t.color,
    border: `1px solid ${t.border}`,
    borderRadius: 9,
    padding: solid ? "8px 15px" : "7px 12px",
    minHeight: 34,
    fontSize: 12.5,
    lineHeight: 1.2,
    cursor: "pointer",
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    boxShadow: solid ? "0 1px 2px rgba(10,34,56,0.12)" : "none",
    "--btn-hover-bg": t.hoverBg,
    "--btn-hover-border": t.hoverBorder,
  };
}

// ─── ICONS ───────────────────────────────────────────────────────────────────
const P = { fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round" };

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
    info: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
    alertCircle: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
    checkCircle: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    userPlus: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></>,
    arrowRight: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
  };
  if (name === "star") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2.8l2.8 5.67 6.25.91-4.52 4.41 1.07 6.23L12 17.08l-5.6 2.94 1.07-6.23-4.52-4.41 6.25-.91L12 2.8z" />
      </svg>
    );
  }
  const content = icons[name];
  if (!content) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...P}>
      {content}
    </svg>
  );
};

// ─── BADGES ──────────────────────────────────────────────────────────────────
export function Badge({ children, color = "#5f6e80", bg = "#f3f0e9", title, icon }) {
  const isHex = typeof color === "string" && color.startsWith("#") && color.length === 7;
  return (
    <span
      title={title}
      style={{
        background: bg,
        color,
        border: `1px solid ${isHex ? `${color}2b` : C.borderSoft}`,
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 11.5,
        fontWeight: 600,
        lineHeight: 1.45,
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

/** Badge op basis van een optielijst met color/bg. */
export function OptionBadge({ options, value, prefix = "" }) {
  const opt = optionOf(options, value);
  if (!opt) return null;
  return (
    <Badge color={opt.color || "#5f6e80"} bg={opt.bg || "#f3f0e9"}>
      {prefix}
      {opt.label}
    </Badge>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div
      style={{
        ...cardTitleStyle,
        marginBottom: 14,
        paddingBottom: 12,
        borderBottom: `1px solid ${C.borderSoft}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <span>{children}</span>
      {right}
    </div>
  );
}

export function Panel({ title, right, children, style }) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: "18px 20px",
        boxShadow: C.shadowSm,
        ...style,
      }}
    >
      {title && <SectionTitle right={right}>{title}</SectionTitle>}
      {children}
    </div>
  );
}

// ─── FORMULIERVELDEN ─────────────────────────────────────────────────────────
function ErrorText({ error }) {
  if (!error) return null;
  return (
    <div style={{ fontSize: 11.5, color: C.danger, marginTop: 5, fontWeight: 500, display: "flex", gap: 5, alignItems: "center" }}>
      <Icon name="alertCircle" size={12} />
      {error}
    </div>
  );
}

export function FieldWrap({ label, error, hint, children }) {
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      {children}
      {hint && !error && <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 5 }}>{hint}</div>}
      <ErrorText error={error} />
    </div>
  );
}

const errBorder = (error) => (error ? { border: `1px solid ${C.danger}`, background: "#fffafa" } : null);

export function TextField({ label, value, onChange, type = "text", error, hint, placeholder, ...rest }) {
  return (
    <FieldWrap label={label} error={error} hint={hint}>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
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
        aria-invalid={error ? true : undefined}
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
        aria-invalid={error ? true : undefined}
        style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, ...errBorder(error) }}
      />
    </FieldWrap>
  );
}

/** Select met optie-objecten {value,label}. */
export function SelectField({ label, value, onChange, options, error, hint, placeholder = "Selecteer...", allowEmpty = true }) {
  return (
    <FieldWrap label={label} error={error} hint={hint}>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        style={{ ...inputStyle, cursor: "pointer", ...errBorder(error) }}
      >
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
        aria-invalid={error ? true : undefined}
        style={{ ...inputStyle, cursor: "pointer", ...errBorder(error) }}
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
    border: `1px solid ${active ? "rgba(11,48,76,0.32)" : C.border}`,
    background: active ? C.navySoft : C.surface,
    color: active ? C.navy : C.textBody,
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 12.5,
    fontWeight: active ? 600 : 500,
    cursor: "pointer",
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  };
}

/** Meerkeuze met chips (bijv. regio's, woningtypes, wensen). */
export function ChipMultiSelect({ label, options, value = [], onChange, error, hint }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <FieldWrap label={label} error={error} hint={hint}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button type="button" key={o.value} className="msk-chip" aria-pressed={on} onClick={() => toggle(o.value)} style={chipStyle(on)}>
              {on && <Icon name="check" size={12} />}
              {o.label}
            </button>
          );
        })}
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
          <span key={v} style={{ ...chipStyle(true), cursor: "default", paddingRight: 8 }}>
            {v}
            <button
              type="button"
              aria-label={`${v} verwijderen`}
              onClick={() => onChange(value.filter((x) => x !== v))}
              style={{ border: "none", background: "none", color: C.navy, cursor: "pointer", padding: 2, display: "flex", borderRadius: 99 }}
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
            <button
              type="button"
              key={s}
              className="msk-chip"
              onClick={() => add(s)}
              style={{ ...chipStyle(false), padding: "4px 10px", fontSize: 11.5, color: C.textMuted, borderStyle: "dashed" }}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </FieldWrap>
  );
}

// ─── MODAL & TABS ────────────────────────────────────────────────────────────
export const MODAL_PAD_X = 28;
export const MODAL_PAD_Y = 26;

export function Modal({ children, onClose, maxWidth = 980, zIndex = 1000 }) {
  return (
    <div
      className="msk-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(14, 36, 56, 0.42)",
        zIndex,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "32px 16px",
        overflowY: "auto",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="msk-modal-dialog"
        style={{
          ...baseTextSelection,
          background: C.surface,
          border: `1px solid ${C.borderSoft}`,
          borderRadius: 20,
          width: "100%",
          maxWidth,
          boxShadow: C.shadowLg,
          padding: `${MODAL_PAD_Y}px ${MODAL_PAD_X}px`,
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

/** Titel + subtitel voor een modal of paginasectie. */
export function ModalTitle({ children, sub }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: C.fontDisplay, fontSize: 24, fontWeight: 600, color: C.text, lineHeight: 1.2, letterSpacing: "-0.01em" }}>{children}</div>
      {sub && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function CloseButton({ onClick, label = "Sluiten" }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="msk-icon-btn" style={iconBtnStyle}>
      <Icon name="x" size={20} />
    </button>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div role="tablist" style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.border}`, overflowX: "auto", scrollbarWidth: "thin" }}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={on}
            type="button"
            className="msk-tab"
            onClick={() => onChange(t.key)}
            style={{
              border: "none",
              borderBottom: `2px solid ${on ? C.gold : "transparent"}`,
              marginBottom: -1,
              background: "none",
              padding: "10px 14px 11px",
              fontSize: 13,
              fontWeight: on ? 600 : 500,
              color: on ? C.navy : t.disabled ? C.textDisabled : C.textMuted,
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
              display: "flex",
              gap: 7,
              alignItems: "center",
              borderRadius: 0,
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span
                style={{
                  background: on ? C.navySoft : C.surfaceSunken,
                  color: on ? C.navy : C.textMuted,
                  borderRadius: 999,
                  padding: "1px 7px",
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: 1.5,
                }}
              >
                {t.count}
              </span>
            )}
            {t.alert && <span aria-label="Controleer velden" style={{ width: 7, height: 7, borderRadius: 99, background: C.danger }} />}
          </button>
        );
      })}
    </div>
  );
}

const NOTICE_TONES = {
  info: { color: C.info, bg: C.infoBg, border: C.infoBorder, icon: "info" },
  warn: { color: "#7d5710", bg: C.goldSoft, border: C.goldBorder, icon: "alertCircle" },
  error: { color: "#9a3a30", bg: C.dangerBg, border: C.dangerBorder, icon: "alertCircle" },
  ok: { color: C.success, bg: C.successBg, border: C.successBorder, icon: "checkCircle" },
};

export function Notice({ tone = "info", children }) {
  const t = NOTICE_TONES[tone] || NOTICE_TONES.info;
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      style={{
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: "11px 14px",
        fontSize: 12.5,
        lineHeight: 1.55,
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1, display: "flex" }}>
        <Icon name={t.icon} size={15} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function Empty({ children }) {
  return <div style={{ fontSize: 12.5, color: C.textMuted, padding: "12px 2px" }}>{children}</div>;
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

/** Logo van Mijn Spanje Kompas (public/msk-logo.png). */
export function BrandLogo({ height = 34, style }) {
  return (
    <img
      src={`${process.env.PUBLIC_URL || ""}/msk-logo.png`}
      alt="Mijn Spanje Kompas"
      height={height}
      style={{ height, width: "auto", display: "block", flexShrink: 0, ...style }}
    />
  );
}
