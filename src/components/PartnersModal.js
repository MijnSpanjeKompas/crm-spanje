import { useState } from "react";
import { PARTNER_TYPES, REGIONS, labelOf } from "../crm/constants";
import { savePartner } from "../crm/services";
import { Modal, ModalTitle, CloseButton, Panel, TextField, SelectField, TextAreaField, ChipMultiSelect, Notice, Empty, Badge, Icon, btnStyle, inputStyle, formatList, C } from "./ui";

const EMPTY = { name: "", type: "realtor", contactPerson: "", email: "", phone: "", regions: [], notes: "", active: true };

/**
 * Centrale partnerdatabase (partners/{partnerId}).
 * Partners worden niet verwijderd maar op inactief gezet, zodat bestaande
 * koppelingen altijd blijven kloppen.
 */
export function PartnersModal({ partners, leads, user, onClose }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const linkCount = (id) => leads.filter((l) => (l.partnerIds || []).includes(id)).length;

  const list = partners
    .filter((p) => showInactive || p.active !== false)
    .filter((p) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [p.name, p.contactPerson, p.email, p.phone, labelOf(PARTNER_TYPES, p.type)].join(" ").toLowerCase().includes(q);
    });

  async function save() {
    setError("");
    if (!String(editing.name || "").trim()) {
      setError("Vul een naam in.");
      return;
    }
    setBusy(true);
    try {
      await savePartner(editing, user);
      setEditing(null);
    } catch (e) {
      console.error(e);
      setError(e.message || "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={900} zIndex={1100}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <ModalTitle sub="Makelaars en andere partijen waaraan we leads koppelen.">Partners</ModalTitle>
        <CloseButton onClick={onClose} />
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {editing ? (
        <Panel title={editing.id ? `Partner bewerken: ${editing.name}` : "Nieuwe partner"}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <TextField label="Naam *" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
            <SelectField label="Soort" value={editing.type} onChange={(v) => setEditing({ ...editing, type: v })} options={PARTNER_TYPES} allowEmpty={false} />
            <TextField label="Contactpersoon" value={editing.contactPerson} onChange={(v) => setEditing({ ...editing, contactPerson: v })} />
            <TextField label="E-mail" type="email" value={editing.email} onChange={(v) => setEditing({ ...editing, email: v })} />
            <TextField label="Telefoon" value={editing.phone} onChange={(v) => setEditing({ ...editing, phone: v })} />
            <div style={{ gridColumn: "1 / -1" }}>
              <ChipMultiSelect label="Werkgebied" options={REGIONS} value={editing.regions || []} onChange={(v) => setEditing({ ...editing, regions: v })} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <TextAreaField label="Notities" value={editing.notes} onChange={(v) => setEditing({ ...editing, notes: v })} rows={3} />
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: C.text }}>
              <input type="checkbox" checked={editing.active !== false} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              Actief (zichtbaar bij koppelen)
            </label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
            <button type="button" onClick={() => setEditing(null)} style={btnStyle("neutral")}>
              Annuleren
            </button>
            <button type="button" onClick={save} disabled={busy} style={btnStyle("primary", true)}>
              <Icon name="save" size={13} /> {busy ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        </Panel>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek partner..." aria-label="Zoek partner" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: C.textMuted, fontWeight: 600 }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Inactieve tonen
            </label>
            <button type="button" onClick={() => setEditing({ ...EMPTY })} style={{ ...btnStyle("primary", true), padding: "9px 15px", minHeight: 38 }}>
              <Icon name="plus" size={13} /> Nieuwe partner
            </button>
          </div>

          {list.length === 0 ? (
            <Empty>{partners.length ? "Geen partners gevonden." : "Nog geen partners. Voeg je eerste makelaar toe."}</Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
              {list.map((p) => (
                <div
                  key={p.id}
                  className="msk-row"
                  style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}`, flexWrap: "wrap" }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: p.active === false ? C.textSubtle : C.text, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {p.name} {p.active === false && <Badge>Inactief</Badge>}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>
                      {labelOf(PARTNER_TYPES, p.type)}
                      {p.contactPerson && ` · ${p.contactPerson}`}
                      {p.email && ` · ${p.email}`}
                      {p.phone && ` · ${p.phone}`}
                    </div>
                    {p.regions?.length > 0 && <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 2 }}>{formatList(REGIONS, p.regions)}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    <Badge color="#33506b" bg="#edf1f5">
                      {linkCount(p.id)} leads
                    </Badge>
                    <button type="button" onClick={() => setEditing({ ...EMPTY, ...p })} style={btnStyle("neutral")}>
                      <Icon name="edit" size={13} /> Bewerken
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
