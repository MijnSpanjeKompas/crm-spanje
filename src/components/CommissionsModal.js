import { useMemo, useState } from "react";
import { isSold } from "../crm/constants";
import { formatDate, toDate } from "../crm/dates";
import { Modal, ModalTitle, CloseButton, Empty, Icon, formatEuro, selectStyle, C } from "./ui";

function saleYear(lead) {
  const d = lead.saleDate ? new Date(`${lead.saleDate}T12:00:00`) : toDate(lead.closedAt);
  return d && !Number.isNaN(d.getTime()) ? d.getFullYear() : null;
}

function Stat({ label, value, strong }) {
  return (
    <div
      style={{
        background: strong ? C.navyDeep : C.surfaceSoft,
        border: `1px solid ${strong ? C.navyDeep : C.borderSoft}`,
        borderRadius: 14,
        padding: "16px 18px",
        flex: "1 1 180px",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12.5, color: strong ? "#e0b25a" : C.textMuted, fontWeight: strong ? 600 : 500 }}>{label}</div>
      <div style={{ fontFamily: C.fontDisplay, fontSize: strong ? 32 : 24, fontWeight: 600, color: strong ? "#fff" : C.navy, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

/** Overzicht van alle verkopen met onze commissie, bovenaan het totaal. */
export function CommissionsModal({ leads, onClose, onOpenLead }) {
  const sold = useMemo(
    () =>
      leads
        .filter(isSold)
        .sort((a, b) => String(b.saleDate || "").localeCompare(String(a.saleDate || "")) || String(a.name).localeCompare(String(b.name), "nl")),
    [leads]
  );
  const years = useMemo(() => Array.from(new Set(sold.map(saleYear).filter(Boolean))).sort((a, b) => b - a), [sold]);
  const [year, setYear] = useState("");

  const rows = year ? sold.filter((l) => String(saleYear(l)) === year) : sold;
  const totalCommission = rows.reduce((sum, l) => sum + (Number(l.saleCommission) || 0), 0);
  const totalVolume = rows.reduce((sum, l) => sum + (Number(l.salePrice) || 0), 0);
  const missing = rows.filter((l) => !(l.saleCommission > 0)).length;

  const th = { textAlign: "left", padding: "11px 14px", fontSize: 12, fontWeight: 600, color: C.textMuted, background: C.surfaceSoft, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
  const td = { padding: "13px 14px", fontSize: 13.5, color: C.textBody, borderBottom: `1px solid ${C.borderSoft}`, verticalAlign: "top" };

  return (
    <Modal onClose={onClose} maxWidth={940} zIndex={1100}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <ModalTitle sub="Alle verkochte woningen en wat we eraan hebben verdiend.">Commissies</ModalTitle>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {years.length > 0 && (
            <select value={year} onChange={(e) => setYear(e.target.value)} style={selectStyle} aria-label="Jaar">
              <option value="">Alle jaren</option>
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          )}
          <CloseButton onClick={onClose} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Stat strong label={year ? `Totale commissie ${year}` : "Totale commissie"} value={formatEuro(totalCommission)} />
        <Stat label="Verkopen" value={rows.length} />
        <Stat label="Totale aankoopwaarde" value={formatEuro(totalVolume)} />
      </div>

      {missing > 0 && (
        <div style={{ fontSize: 12.5, color: C.goldText, display: "flex", gap: 7, alignItems: "center" }}>
          <Icon name="alertCircle" size={14} />
          Bij {missing} {missing === 1 ? "verkoop" : "verkopen"} is de commissie nog niet ingevuld. Die {missing === 1 ? "telt" : "tellen"} nog niet mee in het totaal.
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ border: `1px dashed ${C.borderStrong}`, borderRadius: 14, padding: "28px 20px", textAlign: "center", background: C.surfaceSoft }}>
          <Empty>Nog geen verkopen. Druk bij een lead op de knop Verkocht om de eerste vast te leggen.</Empty>
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
            <thead>
              <tr>
                <th style={th}>Klant</th>
                <th style={th}>Woning</th>
                <th style={th}>Datum</th>
                <th style={{ ...th, textAlign: "right" }}>Aankoopprijs</th>
                <th style={{ ...th, textAlign: "right" }}>Commissie</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr
                  key={l.id}
                  className="msk-row"
                  onClick={() => onOpenLead(l)}
                  style={{ cursor: "pointer" }}
                  title="Lead openen"
                >
                  <td style={{ ...td, fontWeight: 600, color: C.text }}>
                    {l.name || "Naam onbekend"}
                    {l.archived && <span style={{ fontWeight: 400, color: C.textSubtle, fontSize: 12 }}> · gearchiveerd</span>}
                  </td>
                  <td style={td}>
                    {l.saleProperty || "–"}
                    {l.saleNotes && <div style={{ fontSize: 12, color: C.textSubtle, marginTop: 2 }}>{l.saleNotes}</div>}
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{l.saleDate ? formatDate(l.saleDate) : "–"}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{formatEuro(l.salePrice) || "–"}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", fontWeight: 600, color: l.saleCommission > 0 ? C.success : C.goldText }}>
                    {l.saleCommission > 0 ? formatEuro(l.saleCommission) : "Nog invullen"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ ...td, borderBottom: "none", fontWeight: 600, color: C.text, background: C.surfaceSoft }}>
                  Totaal
                </td>
                <td style={{ ...td, borderBottom: "none", textAlign: "right", fontWeight: 600, color: C.text, background: C.surfaceSoft, whiteSpace: "nowrap" }}>
                  {formatEuro(totalVolume)}
                </td>
                <td style={{ ...td, borderBottom: "none", textAlign: "right", fontWeight: 700, color: C.navy, background: C.surfaceSoft, whiteSpace: "nowrap" }}>
                  {formatEuro(totalCommission)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  );
}
