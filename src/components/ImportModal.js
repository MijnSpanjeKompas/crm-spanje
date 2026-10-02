import { useMemo, useRef, useState } from "react";
import { REGIONS, labelOf, LEAD_SOURCES } from "../crm/constants";
import { parseCsv, planImport, SHEET_COLUMNS } from "../crm/sheetImport";
import { importPlannedLeads } from "../crm/services";
import { Modal, ModalTitle, CloseButton, Notice, Badge, Icon, btnStyle, inputStyle, formatBudget, C } from "./ui";

const STATUS = {
  new: { label: "Nieuw", color: "#2f7a55", bg: "#eaf4ee" },
  possible_duplicate: { label: "Mogelijk dubbel", color: "#8c6010", bg: "#fbefd2" },
  already_exists: { label: "Bestaat al", color: "#5f6e80", bg: "#f3f2ef" },
  invalid: { label: "Onvolledig", color: "#b3453a", bg: "#fbedeb" },
};

/**
 * Leads importeren uit de Google Sheet (export als CSV, of kopiëren/plakken).
 * Alleen voor ingelogde medewerkers; schrijft via dezelfde services als de app.
 * Submission ID = harde duplicaatcontrole; e-mail/telefoon = waarschuwing.
 */
export function ImportModal({ leads, user, onClose, onOpenLead }) {
  const fileRef = useRef(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const rows = useMemo(() => {
    try {
      return text.trim() ? parseCsv(text) : [];
    } catch (e) {
      return [];
    }
  }, [text]);
  const plan = useMemo(() => planImport(rows, leads), [rows, leads]);
  const counts = plan.reduce((acc, p) => ({ ...acc, [p.status]: (acc[p.status] || 0) + 1 }), {});
  const toImport = (counts.new || 0) + (counts.possible_duplicate || 0);
  const missingColumns = rows.length ? SHEET_COLUMNS.filter((c) => !Object.keys(rows[0]).some((k) => k.trim().toLowerCase().replace(/[\s_]/g, "") === c.toLowerCase().replace(/[\s_]/g, ""))) : [];
  const criticalMissing = missingColumns.filter((c) => ["Submission ID", "name"].includes(c));

  async function readFile(file) {
    setError("");
    setResult(null);
    if (!file) return;
    try {
      setText(await file.text());
    } catch (e) {
      setError("Bestand kon niet worden gelezen.");
    }
  }

  async function run() {
    setBusy(true);
    setError("");
    try {
      const res = await importPlannedLeads(plan, user);
      setResult(res);
      setText("");
    } catch (e) {
      console.error(e);
      setError(`Import mislukt: ${e.message || "onbekende fout"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={980} zIndex={1100}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <ModalTitle sub="Leads uit de Google Sheet toevoegen. Bestaande Submission ID's worden overgeslagen.">Leads importeren</ModalTitle>
        <CloseButton onClick={onClose} />
      </div>

      {result && (
        <Notice tone={result.failed.length ? "warn" : "ok"}>
          <strong>{result.created.length}</strong> {result.created.length === 1 ? "lead" : "leads"} geïmporteerd
          {result.skipped ? `, ${result.skipped} overgeslagen` : ""}
          {result.failed.length ? `, ${result.failed.length} mislukt (${result.failed.map((f) => f.submissionId).join(", ")})` : ""}.
          {result.created.some((c) => c.status === "possible_duplicate") && " Leads die mogelijk dubbel zijn, hebben een melding in het leaddossier."}
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {!rows.length && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13.5, color: C.textBody, lineHeight: 1.6 }}>
            In Google Sheets: <strong>Bestand → Downloaden → Door komma's gescheiden waarden (.csv)</strong>. Kies dat bestand hieronder, of kopieer de rijen
            (inclusief de kopregel) en plak ze in het tekstvak.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input ref={fileRef} type="file" accept=".csv,.tsv,text/csv,text/plain" style={{ display: "none" }} onChange={(e) => readFile(e.target.files?.[0])} />
            <button type="button" onClick={() => fileRef.current?.click()} style={btnStyle("primary", true)}>
              <Icon name="upload" size={14} /> CSV-bestand kiezen
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => {
              setResult(null);
              setText(e.target.value);
            }}
            rows={6}
            placeholder={"Of plak hier de rijen uit de Sheet, inclusief de kopregel:\nSubmission ID\tSubmission time\tproperty_type\t..."}
            aria-label="Rijen uit de Sheet"
            style={{ ...inputStyle, resize: "vertical", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}
          />
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {Object.entries(STATUS).map(([key, s]) =>
              counts[key] ? (
                <Badge key={key} color={s.color} bg={s.bg}>
                  {s.label}: {counts[key]}
                </Badge>
              ) : null
            )}
            <button
              type="button"
              onClick={() => {
                setText("");
                setResult(null);
              }}
              style={{ ...btnStyle("neutral"), marginLeft: "auto" }}
            >
              Ander bestand
            </button>
          </div>

          {criticalMissing.length > 0 && <Notice tone="error">Kolom(men) ontbreken: {criticalMissing.join(", ")}. Controleer of de kopregel is meegekopieerd.</Notice>}
          {!criticalMissing.length && missingColumns.length > 0 && (
            <div style={{ fontSize: 12, color: C.textMuted }}>Niet gevonden (wordt leeg gelaten): {missingColumns.join(", ")}</div>
          )}

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: "auto", maxHeight: 420 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr>
                  {["Status", "Naam", "Contact", "Zoekt", "Bron", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 600, color: C.textMuted, background: C.surfaceSoft, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.map((p) => {
                  const st = STATUS[p.status];
                  const f = p.form;
                  const where = (f.regions || []).filter((r) => r !== "unknown").map((r) => labelOf(REGIONS, r)).concat(f.places || []).join(", ");
                  return (
                    <tr key={p.index}>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.borderSoft}`, verticalAlign: "top" }}>
                        <Badge color={st.color} bg={st.bg}>
                          {st.label}
                        </Badge>
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.borderSoft}`, fontSize: 13, fontWeight: 600, color: C.text, verticalAlign: "top" }}>
                        {f.name || "–"}
                        <div style={{ fontSize: 11.5, color: C.textSubtle, fontWeight: 400 }}>{p.submissionId || "geen Submission ID"}</div>
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.borderSoft}`, fontSize: 12.5, color: C.textBody, verticalAlign: "top" }}>
                        {f.phone || "–"}
                        <div>{f.email || ""}</div>
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.borderSoft}`, fontSize: 12.5, color: C.textBody, verticalAlign: "top" }}>
                        {[where, formatBudget(f)].filter(Boolean).join(" · ") || "–"}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.borderSoft}`, fontSize: 12.5, color: C.textBody, verticalAlign: "top" }}>{labelOf(LEAD_SOURCES, f.leadSource)}</td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.borderSoft}`, fontSize: 12, color: C.textMuted, verticalAlign: "top" }}>
                        {p.status === "invalid" && p.problems.join(", ")}
                        {p.status === "already_exists" && p.existingId && (
                          <button type="button" onClick={() => onOpenLead(leads.find((l) => l.id === p.existingId))} className="msk-link" style={{ border: "none", background: "none", color: C.goldText, cursor: "pointer", padding: 0, fontSize: 12, fontFamily: "inherit" }}>
                            {p.existingName || "lead"} openen
                          </button>
                        )}
                        {p.status === "already_exists" && !p.existingId && `Dubbel in dit bestand (${p.existingName})`}
                        {p.status === "possible_duplicate" && `Lijkt op: ${p.duplicates.map((d) => d.name || d.id).join(", ")}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: C.textMuted }}>
              "Mogelijk dubbel" wordt wél geïmporteerd, met een melding in het leaddossier. Er wordt nooit automatisch samengevoegd.
            </span>
            <button type="button" onClick={run} disabled={busy || !toImport || criticalMissing.length > 0} style={{ ...btnStyle("primary", true), minHeight: 40 }}>
              <Icon name="upload" size={14} /> {busy ? "Importeren..." : `${toImport} ${toImport === 1 ? "lead" : "leads"} importeren`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
