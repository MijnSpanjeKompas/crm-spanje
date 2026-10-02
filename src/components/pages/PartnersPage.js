import { useMemo, useState } from "react";
import { PARTNER_TYPES, PARTNER_LINK_STATUSES, PIPELINE_STAGES, REGIONS, isClosedStage, labelOf } from "../../crm/constants";
import { partnerStats } from "../../crm/analytics";
import { savePartner } from "../../crm/services";
import { formatDate, formatDateTime, toDate } from "../../crm/dates";
import { Card, InfoRow, Modal, ModalTitle, CloseButton, TextField, SelectField, TextAreaField, ChipMultiSelect, Notice, Badge, OptionBadge, Icon, btnStyle, inputStyle, selectStyle, formatList, C } from "../ui";
import { PageHeader } from "../shell/AppShell";

const EMPTY = { name: "", type: "realtor", contactPerson: "", email: "", phone: "", regions: [], notes: "", active: true };

function PartnerForm({ initial, user, onDone }) {
  const [p, setP] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!String(p.name || "").trim()) {
      setError("Vul een naam in.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const id = await savePartner(p, user);
      onDone(id || p.id);
    } catch (e) {
      setError(e.message || "Opslaan mislukt.");
      setBusy(false);
    }
  }
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <TextField label="Naam *" value={p.name} onChange={(v) => setP({ ...p, name: v })} autoFocus />
        <SelectField label="Type" value={p.type} onChange={(v) => setP({ ...p, type: v })} options={PARTNER_TYPES} allowEmpty={false} />
        <TextField label="Contactpersoon" value={p.contactPerson} onChange={(v) => setP({ ...p, contactPerson: v })} />
        <TextField label="E-mail" type="email" value={p.email} onChange={(v) => setP({ ...p, email: v })} />
        <TextField label="Telefoon" value={p.phone} onChange={(v) => setP({ ...p, phone: v })} />
      </div>
      <ChipMultiSelect label="Regio / werkgebied" options={REGIONS} value={p.regions || []} onChange={(v) => setP({ ...p, regions: v })} />
      <TextAreaField label="Notities" value={p.notes} onChange={(v) => setP({ ...p, notes: v })} rows={3} />
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: C.text }}>
        <input type="checkbox" checked={p.active !== false} onChange={(e) => setP({ ...p, active: e.target.checked })} /> Actief (kiesbaar bij koppelen)
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={() => onDone(null)} style={btnStyle("neutral")}>
          Annuleren
        </button>
        <button type="button" onClick={save} disabled={busy} style={btnStyle("primary", true)}>
          {busy ? "Opslaan..." : "Opslaan"}
        </button>
      </div>
    </div>
  );
}

/** Partnerdossier: feitelijke gegevens, geen ranking. */
export function PartnerDossier({ partner, stats, links, leads, user, onClose, onOpenLead }) {
  const [editing, setEditing] = useState(false);
  const byId = new Map(leads.map((l) => [l.id, l]));
  const mine = links
    .filter((k) => k.partnerId === partner.id)
    .map((k) => ({ link: k, lead: byId.get(k.leadId) }))
    .filter((x) => x.lead)
    .sort((a, b) => (toDate(b.link.linkedAt) || 0) - (toDate(a.link.linkedAt) || 0));
  const active = mine.filter((x) => !x.lead.archived && !isClosedStage(x.lead.pipelineStage) && !["completed", "no_match"].includes(x.link.status));
  const history = mine.filter((x) => !active.includes(x));
  const followUps = mine.filter((x) => x.link.nextFollowUpAt && !["completed", "no_match"].includes(x.link.status)).sort((a, b) => String(a.link.nextFollowUpAt).localeCompare(String(b.link.nextFollowUpAt)));

  const leadRow = ({ link, lead }) => (
    <button key={link.id} type="button" className="msk-row" onClick={() => onOpenLead(lead, "partners")} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center", width: "100%", textAlign: "left", border: "none", borderBottom: `1px solid ${C.borderSoft}`, background: "none", padding: "9px 6px", cursor: "pointer", fontFamily: "inherit" }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: C.text }}>{lead.name}</span>
        <span style={{ display: "block", fontSize: 12, color: C.textMuted }}>Gekoppeld {formatDate(link.linkedAt)}{link.lastFollowUpAt ? ` · laatst opgevolgd ${formatDate(link.lastFollowUpAt)}` : ""}</span>
      </span>
      <OptionBadge options={PARTNER_LINK_STATUSES} value={link.status} />
      <OptionBadge options={PIPELINE_STAGES} value={lead.pipelineStage} />
    </button>
  );

  return (
    <Modal onClose={onClose} maxWidth={980} zIndex={1050}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <ModalTitle sub={`${labelOf(PARTNER_TYPES, partner.type)}${partner.active === false ? " · inactief" : ""}`}>{partner.name}</ModalTitle>
        <div style={{ display: "flex", gap: 8 }}>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} style={btnStyle("neutral")}>
              <Icon name="edit" size={13} /> Bewerken
            </button>
          )}
          <CloseButton onClick={onClose} />
        </div>
      </div>
      {editing ? (
        <PartnerForm initial={{ ...EMPTY, ...partner }} user={user} onDone={() => setEditing(false)} />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))", gap: 16, alignItems: "start" }}>
            <Card icon="user" title="Gegevens">
              <InfoRow label="Contactpersoon" muted={!partner.contactPerson}>{partner.contactPerson || "–"}</InfoRow>
              <InfoRow label="E-mail" muted={!partner.email}>{partner.email ? <a href={`mailto:${partner.email}`} style={{ color: C.navy }}>{partner.email}</a> : "–"}</InfoRow>
              <InfoRow label="Telefoon" muted={!partner.phone}>{partner.phone ? <a href={`tel:${partner.phone}`} style={{ color: C.navy }}>{partner.phone}</a> : "–"}</InfoRow>
              <InfoRow label="Regio" muted={!(partner.regions || []).length}>{formatList(REGIONS, partner.regions) || "–"}</InfoRow>
              {partner.notes && <InfoRow label="Notities">{partner.notes}</InfoRow>}
            </Card>
            <Card icon="chart" title="Resultaten">
              <InfoRow label="Leads doorgestuurd">{stats?.forwarded || 0}</InfoRow>
              <InfoRow label="Actieve leads">{stats?.activeLeads || 0}</InfoRow>
              <InfoRow label="Gereserveerd">{stats?.reserved || 0}</InfoRow>
              <InfoRow label="Aankopen afgerond">{stats?.purchased || 0}</InfoRow>
              <InfoRow label="Laatste contact" muted={!stats?.lastContact}>{stats?.lastContact ? formatDateTime(stats.lastContact) : "Nog niet"}</InfoRow>
            </Card>
          </div>
          <Card icon="bell" title={`Opvolgingen (${followUps.length})`}>
            {followUps.length ? (
              followUps.map(({ link, lead }) => (
                <InfoRow key={link.id} label={formatDate(link.nextFollowUpAt)} onClick={() => onOpenLead(lead, "partners")}>
                  {lead.name} <span style={{ color: C.textMuted }}>· {labelOf(PARTNER_LINK_STATUSES, link.status)}</span>
                </InfoRow>
              ))
            ) : (
              <div style={{ fontSize: 13, color: C.textMuted }}>Geen geplande opvolgingen.</div>
            )}
          </Card>
          <Card icon="users" title={`Actieve leads (${active.length})`}>
            {active.length ? active.map(leadRow) : <div style={{ fontSize: 13, color: C.textMuted }}>Geen actieve leads bij deze partner.</div>}
          </Card>
          {history.length > 0 && (
            <Card icon="archive" title={`Historische leads (${history.length})`}>
              {history.map(leadRow)}
            </Card>
          )}
          <div style={{ fontSize: 11.5, color: C.textSubtle }}>Activiteiten per lead (zoals partneropvolgingen) staan in de Tijdlijn van die lead.</div>
        </>
      )}
    </Modal>
  );
}

/** Partners: lijst met feitelijke resultaten, zoeken, toevoegen. */
export function PartnersPage({ partners, links, leads, user, now, onOpenLead, openPartnerId, setOpenPartnerId }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [adding, setAdding] = useState(false);
  const stats = useMemo(() => partnerStats(partners, links, leads, now), [partners, links, leads, now]);
  const rows = stats
    .filter((r) => showInactive || r.partner.active !== false)
    .filter((r) => !type || r.partner.type === type)
    .filter((r) => !q.trim() || [r.partner.name, r.partner.contactPerson, r.partner.email, r.partner.phone].join(" ").toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.activeLeads - a.activeLeads || String(a.partner.name).localeCompare(String(b.partner.name), "nl"));
  const openRow = stats.find((r) => r.partner.id === openPartnerId);
  const th = { textAlign: "left", padding: "11px 14px", fontSize: 12, fontWeight: 600, color: C.textMuted, background: C.surfaceSoft, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
  const td = { padding: "12px 14px", fontSize: 13, color: C.textBody, borderBottom: `1px solid ${C.borderSoft}` };

  return (
    <div>
      <PageHeader
        title="Partners"
        subtitle="Makelaars en andere partijen waaraan we leads doorsturen."
        actions={
          <button type="button" onClick={() => setAdding(true)} style={{ ...btnStyle("primary", true), minHeight: 40, padding: "9px 18px", fontSize: 13 }}>
            <Icon name="plus" size={15} /> Partner toevoegen
          </button>
        }
      />
      {adding && (
        <Card title="Nieuwe partner" style={{ marginBottom: 16 }}>
          <PartnerForm initial={{ ...EMPTY }} user={user} onDone={() => setAdding(false)} />
        </Card>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek partner..." aria-label="Zoek partner" style={{ ...inputStyle, flex: "1 1 260px", maxWidth: 420, background: C.surface }} />
        <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle} aria-label="Type">
          <option value="">Alle types</option>
          {PARTNER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: C.textBody }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Inactieve tonen
        </label>
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflowX: "auto", boxShadow: C.shadowSm }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr>
              {["Partner", "Type", "Actieve leads", "Doorgestuurd", "Gereserveerd", "Aankopen afgerond", "Opvolging nodig", "Laatste contact"].map((h, i) => (
                <th key={h} style={{ ...th, textAlign: i >= 2 && i <= 6 ? "right" : "left" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.partner.id} className="msk-row" onClick={() => setOpenPartnerId(r.partner.id)} style={{ cursor: "pointer", opacity: r.partner.active === false ? 0.6 : 1 }}>
                <td style={{ ...td, fontWeight: 600, color: C.text }}>
                  {r.partner.name}
                  {r.partner.contactPerson && <div style={{ fontSize: 12, fontWeight: 400, color: C.textMuted }}>{r.partner.contactPerson}</div>}
                </td>
                <td style={td}>{labelOf(PARTNER_TYPES, r.partner.type)}</td>
                <td style={{ ...td, textAlign: "right" }}>{r.activeLeads}</td>
                <td style={{ ...td, textAlign: "right" }}>{r.forwarded}</td>
                <td style={{ ...td, textAlign: "right" }}>{r.reserved}</td>
                <td style={{ ...td, textAlign: "right" }}>{r.purchased}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  {r.followUpDue ? (
                    <Badge color="#b3453a" bg="#fbedeb">
                      {r.followUpDue}
                    </Badge>
                  ) : (
                    "–"
                  )}
                </td>
                <td style={td}>{r.lastContact ? formatDate(r.lastContact) : "–"}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} style={{ ...td, color: C.textMuted }}>
                  {partners.length ? "Geen partners gevonden." : "Nog geen partners. Voeg je eerste partner toe."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {openRow && <PartnerDossier partner={openRow.partner} stats={openRow} links={links} leads={leads} user={user} onClose={() => setOpenPartnerId(null)} onOpenLead={onOpenLead} />}
    </div>
  );
}
