import { useMemo, useState } from "react";
import { COMMISSION_STATUSES, COMMISSION_OPEN_STATUSES, optionOf } from "../../crm/constants";
import { commissionAmountExpected } from "../../crm/analytics";
import { updateCommission } from "../../crm/services";
import { formatDate, todayISO } from "../../crm/dates";
import { Modal, ModalTitle, CloseButton, SelectField, NumberField, TextField, TextAreaField, Notice, Badge, Icon, btnStyle, selectStyle, formatEuro, C } from "../ui";
import { PageHeader } from "../shell/AppShell";

function saleYear(l) {
  return String(l.saleDate || "").slice(0, 4) || null;
}

/** Commissie bijwerken (status, bedragen, data). Wordt gelogd in de tijdlijn. */
export function CommissionDialog({ lead, partnerOptions, user, onClose }) {
  const [f, setF] = useState({
    commissionStatus: lead.commissionStatus || "unknown",
    commissionExpectedAmount: lead.commissionExpectedAmount ?? null,
    commissionReceivedAmount: lead.commissionReceivedAmount ?? null,
    commissionExpectedDate: lead.commissionExpectedDate || "",
    commissionReceivedAt: lead.commissionReceivedAt || "",
    commissionNotes: lead.commissionNotes || "",
    commissionPartnerId: lead.commissionPartnerId || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    if (["expected", "outstanding", "received"].includes(f.commissionStatus) && !(f.commissionExpectedAmount > 0)) {
      setError("Vul het verwachte bedrag in.");
      return;
    }
    if (f.commissionStatus === "received" && !f.commissionReceivedAt) {
      setError("Vul de betaaldatum in.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const p = partnerOptions.find((o) => o.value === f.commissionPartnerId);
      await updateCommission(
        lead,
        {
          ...f,
          commissionPartnerName: p ? p.label : lead.commissionPartnerName || "",
          commissionReceivedAmount: f.commissionStatus === "received" && f.commissionReceivedAmount === null ? f.commissionExpectedAmount : f.commissionReceivedAmount,
        },
        user
      );
      onClose();
    } catch (e) {
      setError(e.message || "Opslaan mislukt.");
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={620} zIndex={1200}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <ModalTitle sub={`${lead.name}${lead.saleProperty ? ` · ${lead.saleProperty}` : ""}`}>Commissie</ModalTitle>
        <CloseButton onClick={onClose} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <SelectField label="Status" value={f.commissionStatus} onChange={set("commissionStatus")} options={COMMISSION_STATUSES} allowEmpty={false} />
        <SelectField label="Partner" value={f.commissionPartnerId} onChange={set("commissionPartnerId")} options={partnerOptions} placeholder="Kies partner" />
        <NumberField label="Verwacht bedrag (€)" value={f.commissionExpectedAmount} onChange={set("commissionExpectedAmount")} step={100} />
        <TextField label="Verwachte betaaldatum" type="date" value={f.commissionExpectedDate} onChange={set("commissionExpectedDate")} />
        <NumberField label="Ontvangen bedrag (€)" value={f.commissionReceivedAmount} onChange={set("commissionReceivedAmount")} step={100} />
        <TextField label="Betaaldatum" type="date" value={f.commissionReceivedAt} onChange={set("commissionReceivedAt")} />
        <div style={{ gridColumn: "1 / -1" }}>
          <TextAreaField label="Notitie" value={f.commissionNotes} onChange={set("commissionNotes")} rows={2} />
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {f.commissionStatus !== "received" && (
          <button type="button" onClick={() => setF((x) => ({ ...x, commissionStatus: "received", commissionReceivedAt: x.commissionReceivedAt || todayISO(), commissionReceivedAmount: x.commissionReceivedAmount ?? x.commissionExpectedAmount }))} style={btnStyle("success")}>
            <Icon name="check" size={13} /> Markeer als ontvangen
          </button>
        )}
        <button type="button" onClick={onClose} style={btnStyle("neutral")}>
          Annuleren
        </button>
        <button type="button" onClick={save} disabled={busy} style={btnStyle("primary", true)}>
          {busy ? "Opslaan..." : "Opslaan"}
        </button>
      </div>
    </Modal>
  );
}

/** Financiële opvolging van commissies. Data staat op de lead (geen parallel systeem). */
export function CommissionsPage({ leads, partners, users, user, now, onOpenLead, onOpenPartner }) {
  const sold = useMemo(() => leads.filter((l) => l.pipelineStage === "completed"), [leads]);
  const years = useMemo(() => Array.from(new Set(sold.map(saleYear).filter(Boolean))).sort().reverse(), [sold]);
  const thisYear = String(now.getFullYear());
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [editing, setEditing] = useState(null);

  const rows = sold
    .filter((l) => !year || saleYear(l) === year)
    .filter((l) => !status || l.commissionStatus === status)
    .filter((l) => !partnerId || l.commissionPartnerId === partnerId || (!l.commissionPartnerId && (l.partnerIds || []).includes(partnerId)))
    .filter((l) => !ownerId || l.ownerId === ownerId)
    .sort((a, b) => String(b.saleDate || "").localeCompare(String(a.saleDate || "")));

  const expected = sold.filter((l) => l.commissionStatus === "expected").reduce((s, l) => s + commissionAmountExpected(l), 0);
  const outstanding = sold.filter((l) => COMMISSION_OPEN_STATUSES.includes(l.commissionStatus)).reduce((s, l) => s + Math.max(0, commissionAmountExpected(l) - (Number(l.commissionReceivedAmount) || 0)), 0);
  const receivedYear = sold.filter((l) => l.commissionStatus === "received" && String(l.commissionReceivedAt || "").startsWith(thisYear)).reduce((s, l) => s + (Number(l.commissionReceivedAmount) || 0), 0);
  const partnerName = (l) => l.commissionPartnerName || (l.partnerNames || [])[0] || "–";
  const partnerOf = (l) => partners.find((p) => p.id === (l.commissionPartnerId || (l.partnerIds || [])[0]));
  const editLead = editing ? leads.find((l) => l.id === editing) : null;

  const card = (label, value, hint) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", boxShadow: C.shadowSm }}>
      <div style={{ fontSize: 12.5, color: C.textMuted }}>{label}</div>
      <div style={{ fontFamily: C.fontDisplay, fontSize: 26, fontWeight: 600, color: C.navy, marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, color: C.textSubtle }}>{hint}</div>}
    </div>
  );
  const th = { textAlign: "left", padding: "11px 12px", fontSize: 12, fontWeight: 600, color: C.textMuted, background: C.surfaceSoft, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
  const td = { padding: "11px 12px", fontSize: 13, color: C.textBody, borderBottom: `1px solid ${C.borderSoft}`, verticalAlign: "top" };
  const linkBtn = { border: "none", background: "none", padding: 0, color: C.navy, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13, textAlign: "left" };

  return (
    <div>
      <PageHeader title="Commissies" subtitle="Financiële opvolging van afgeronde aankopen." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 18 }}>
        {card("Verwacht", formatEuro(expected), "Status verwacht")}
        {card("Openstaand", formatEuro(outstanding), "Verwacht of gefactureerd, nog niet betaald")}
        {card(`Ontvangen ${thisYear}`, formatEuro(receivedYear))}
        {card("Afgeronde dossiers", sold.length)}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <select value={year} onChange={(e) => setYear(e.target.value)} style={selectStyle} aria-label="Jaar">
          <option value="">Alle jaren</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle} aria-label="Status">
          <option value="">Alle statussen</option>
          {COMMISSION_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} style={selectStyle} aria-label="Partner">
          <option value="">Alle partners</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={selectStyle} aria-label="Verantwoordelijke">
          <option value="">Iedereen</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
            </option>
          ))}
        </select>
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflowX: "auto", boxShadow: C.shadowSm }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
          <thead>
            <tr>
              {["Lead", "Partner", "Status", "Verwacht", "Ontvangen", "Datum aankoop", "Betaaldatum", "Notitie", ""].map((h, i) => (
                <th key={h || i} style={{ ...th, textAlign: i === 3 || i === 4 ? "right" : "left" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const st = optionOf(COMMISSION_STATUSES, l.commissionStatus) || COMMISSION_STATUSES[0];
              const p = partnerOf(l);
              return (
                <tr key={l.id}>
                  <td style={td}>
                    <button type="button" onClick={() => onOpenLead(l)} style={linkBtn}>
                      {l.name}
                    </button>
                    {l.saleProperty && <div style={{ fontSize: 12, color: C.textMuted }}>{l.saleProperty}</div>}
                  </td>
                  <td style={td}>
                    {p ? (
                      <button type="button" onClick={() => onOpenPartner(p)} style={{ ...linkBtn, fontWeight: 500 }}>
                        {p.name}
                      </button>
                    ) : (
                      partnerName(l)
                    )}
                  </td>
                  <td style={td}>
                    <Badge color={st.color} bg={st.bg}>
                      {st.label}
                    </Badge>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>{commissionAmountExpected(l) ? formatEuro(commissionAmountExpected(l)) : "–"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{l.commissionReceivedAmount ? formatEuro(l.commissionReceivedAmount) : "–"}</td>
                  <td style={td}>{l.saleDate ? formatDate(l.saleDate) : "–"}</td>
                  <td style={td}>{l.commissionReceivedAt ? formatDate(l.commissionReceivedAt) : l.commissionExpectedDate ? <span style={{ color: C.textMuted }}>verwacht {formatDate(l.commissionExpectedDate)}</span> : "–"}</td>
                  <td style={{ ...td, maxWidth: 220, color: C.textMuted }}>{l.commissionNotes || ""}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button type="button" onClick={() => setEditing(l.id)} style={btnStyle("neutral")}>
                      Bewerken
                    </button>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={9} style={{ ...td, color: C.textMuted }}>
                  {sold.length ? "Geen dossiers met deze filters." : "Nog geen afgeronde aankopen. Kies bij een lead 'Aankoop afgerond vastleggen'."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editLead && (
        <CommissionDialog
          lead={editLead}
          user={user}
          partnerOptions={partners.filter((p) => (editLead.partnerIds || []).includes(p.id) || p.id === editLead.commissionPartnerId).map((p) => ({ value: p.id, label: p.name }))}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
