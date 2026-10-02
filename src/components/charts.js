// ─── GRAFIEKEN ───────────────────────────────────────────────────────────────
// Lichte, eigen SVG/HTML-grafieken in de MSK-huisstijl (geen extra dependency).
// Alleen wat het dashboard nodig heeft: horizontale bars en een lijngrafiek.

import { useState } from "react";
import { C } from "./ui";

export const CHART_COLORS = {
  primary: "#0b304c", // navy
  secondary: "#7fa3c0", // lichtblauw
  accent: "#d9a83e", // goud
  positive: "#2f7a55",
  warning: "#b7791f",
  negative: "#b3453a",
  muted: "#cfd6de",
};

/** Klein info-icoon met uitleg (hover/focus), zonder lange tekst in beeld. */
export function InfoTip({ text, label = "Uitleg" }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label={`${label}: ${text}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{ border: "none", background: "none", padding: 0, cursor: "help", color: C.textSubtle, display: "inline-flex", alignItems: "center" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            width: 240,
            background: C.navyDark,
            color: "#fff",
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1.45,
            padding: "8px 10px",
            borderRadius: 8,
            boxShadow: C.shadowMd,
            textAlign: "left",
            whiteSpace: "normal",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

/** Rustige lege staat voor een grafiek/KPI. */
export function NoData({ text = "Nog onvoldoende gegevens." }) {
  return <div style={{ fontSize: 13, color: C.textMuted, padding: "18px 0", textAlign: "center" }}>{text}</div>;
}

/**
 * Horizontale bars. rows: [{key, label, value}]. Percentage t.o.v. `total`
 * (standaard de som). onClick(row) maakt een rij klikbaar.
 */
export function HBarChart({ rows, total, color = CHART_COLORS.primary, onClick, emptyText, labelWidth = 150, valueSuffix = "" }) {
  const sum = total ?? rows.reduce((s, r) => s + r.value, 0);
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (!rows.length || max === 0) return <NoData text={emptyText} />;
  return (
    <div style={{ display: "grid", gap: 7 }}>
      {rows.map((r) => {
        const pctOf = sum > 0 ? Math.round((r.value / sum) * 100) : null;
        const Row = onClick ? "button" : "div";
        return (
          <Row
            key={r.key}
            type={onClick ? "button" : undefined}
            onClick={onClick ? () => onClick(r) : undefined}
            title={`${r.label}: ${r.value}${valueSuffix}${pctOf !== null ? ` (${pctOf}%)` : ""}`}
            className={onClick ? "msk-stage-row" : undefined}
            style={{
              display: "grid",
              gridTemplateColumns: `minmax(90px, ${labelWidth}px) 1fr 84px`,
              gap: 10,
              alignItems: "center",
              border: "none",
              background: "none",
              padding: "2px 0",
              cursor: onClick ? "pointer" : "default",
              fontFamily: "inherit",
              textAlign: "left",
              width: "100%",
            }}
          >
            <span
              className="msk-stage-label"
              style={{
                fontSize: 12.5,
                color: r.key === "unknown" || r.key === "__unknown" ? C.textSubtle : C.textBody,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {r.label}
            </span>
            <span className="msk-stage-track" style={{ background: C.surfaceSoft, borderRadius: 6, height: 14, overflow: "hidden" }}>
              <span
                style={{
                  display: "block",
                  width: `${max ? (r.value / max) * 100 : 0}%`,
                  minWidth: r.value ? 3 : 0,
                  height: "100%",
                  background: r.key === "unknown" || r.key === "__unknown" ? CHART_COLORS.muted : color,
                  borderRadius: 6,
                }}
              />
            </span>
            <span style={{ fontSize: 12.5, color: C.text, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              <strong style={{ fontWeight: 600 }}>{r.value}</strong>
              {pctOf !== null && <span style={{ color: C.textSubtle }}> · {pctOf}%</span>}
            </span>
          </Row>
        );
      })}
    </div>
  );
}

/**
 * Lijngrafiek. series: [{key, label, values: number[], color, dashed}].
 * Hover toont per punt alle zichtbare series.
 */
export function LineChart({ labels, series, height = 220 }) {
  const [hover, setHover] = useState(null);
  const W = 640;
  const H = height;
  const pad = { l: 34, r: 12, t: 12, b: 28 };
  const all = series.flatMap((s) => s.values.filter((v) => v !== null && v !== undefined));
  const max = Math.max(1, ...all);
  const niceMax = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const n = labels.length;
  const x = (i) => pad.l + (n <= 1 ? (W - pad.l - pad.r) / 2 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (1 - v / niceMax) * (H - pad.t - pad.b);
  const ticks = Array.from(new Set([0, niceMax / 2, niceMax].map((t) => Math.round(t))));
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  if (!all.some((v) => v > 0)) return <NoData text="Geen gebeurtenissen in deze periode." />;

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label={`Lijngrafiek: ${series.map((s) => s.label).join(", ")}`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={C.borderSoft} strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 4} fontSize="10.5" textAnchor="end" fill="#7a8696">
              {t}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 8} fontSize="10.5" textAnchor="middle" fill="#7a8696">
              {l}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null || v === undefined ? null : `${x(i)},${y(v)}`)).filter(Boolean);
          return (
            <polyline
              key={s.key}
              points={pts.join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={s.dashed ? 1.6 : 2.2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={s.dashed ? 0.7 : 1}
            />
          );
        })}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke={C.border} strokeWidth="1" />}
        {series
          .filter((s) => !s.dashed)
          .map((s) => s.values.map((v, i) => (v ? <circle key={`${s.key}-${i}`} cx={x(i)} cy={y(v)} r={hover === i ? 4 : 2.5} fill={s.color} /> : null)))}
        {labels.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (W - pad.l - pad.r) / Math.max(1, n - 1) / 2}
            y={pad.t}
            width={(W - pad.l - pad.r) / Math.max(1, n - 1)}
            height={H - pad.t - pad.b}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {hover !== null && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: 4,
            left: `${Math.min(80, Math.max(2, (x(hover) / W) * 100))}%`,
            transform: "translateX(-50%)",
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            boxShadow: C.shadowMd,
            padding: "6px 10px",
            fontSize: 12,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontWeight: 600, color: C.text, marginBottom: 2 }}>{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.key} style={{ display: "flex", gap: 6, alignItems: "center", color: C.textBody }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: s.color, opacity: s.dashed ? 0.6 : 1 }} />
              {s.label}: <strong>{s.values[hover] ?? "–"}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
