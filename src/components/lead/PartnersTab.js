import { useState } from "react";
import { PARTNER_TYPES, PARTNER_LINK_STATUSES, PARTNER_WAITING_STATUSES, THRESHOLDS, labelOf } from "../../crm/constants";
import { addPartnerLink, updatePartnerLink, removePartnerLink, savePartner } from "../../crm/services";
import { formatDate, formatDateTime, daysSince, diffInDays, toDate } from "../../crm/dates";
import { Panel, SelectField, TextField, TextAreaField, Notice, Empty, Badge, OptionBadge, btnStyle, inputStyle, labelStyle, C } from "../ui";

function linkWarning(link) {
  if (!PARTNER_WAITING_STATUSES.includes(link.status)) return null;
  if (link.nextFollowUpAt && diffInDays(link.nextFollowUpAt) < 0) return "Opvolgdatum verlopen";
  const since = daysSince(toDate(link.lastFollowUpAt) || toDate(link.linkedAt));
  if (since !== null && since >= THRESHOLDS.PARTNER_FOLLOW_UP_DAYS) return `${since} dagen geen terugkoppeling`;
  return null;
}

function LinkCard({ link, lead, user, onError }) {
  const [notes, setNotes] = useState(link.notes || "");
  const [followUpNote, setFollowUpNote] = useState("");
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const warning = linkWarning(link);

  async function run(fn) {
    setBusy(true);
    onError("");
    try {
      await fn();
    } catch (e) {
      console.error(e);
      onError(e.message || "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        border: `1px solid ${warning ? C.dangerBorder : C.border}`,
        borderRadius: 14,
        padding: "16px 18px",
        background: C.surface,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        opacity: busy ? 0.7 : 1,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {warning && <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: C.danger }} />}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{link.partnerName}</span>
            <OptionBadge options={PARTNER_LINK_STATUSES} value={link.status} />
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
            {labelOf(PARTNER_TYPES, link.partnerType)}
            {link.contactPerson && ` · ${link.contactPerson}`} · gekoppeld {formatDate(link.linkedAt)}
            {link.linkedByName && ` door ${link.linkedByName}`}
          </div>
        </div>
        {warning && <Badge color="#b3453a" bg="#fbedeb" icon="alertCircle">{warning}</Badge>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <SelectField
          label="Status"
          value={link.status}
          onChange={(v) => run(() => updatePartnerLink(lead, link, { status: v }, user))}
          options={PARTNER_LINK_STATUSES}
          allowEmpty={false}
        />
        <TextField
          label="Volgende opvolging"
          type="date"
          value={link.nextFollowUpAt || ""}
          onChange={(v) => run(() => updatePartnerLink(lead, link, { nextFollowUpAt: v }, user))}
        />
        <div>
          <span style={labelStyle}>Laatste opvolging</span>
          <div style={{ fontSize: 13.5, color: C.text, padding: "9px 0", minHeight: 38 }}>{link.lastFollowUpAt ? formatDateTime(link.lastFollowUpAt) : "Nog niet"}</div>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Notities</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (link.notes || "") && run(() => updatePartnerLink(lead, link, { notes }, user))}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {showFollowUp && (
        <div style={{ background: C.surfaceSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <TextAreaField label="Wat is er besproken met de partner?" value={followUpNote} onChange={setFollowUpNote} rows={2} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowFollowUp(false)} style={btnStyle("neutral")}>
              Annuleren
            </button>
            <button
              type="button"
              onClick={() =>
                run(async () => {
                  await updatePartnerLink(lead, link, {}, user, { logFollowUp: true, followUpNote });
                  setFollowUpNote("");
                  setShowFollowUp(false);
                })
              }
              style={btnStyle("success", true)}
            >
              Opvolging opslaan
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {!showFollowUp && (
          <button type="button" onClick={() => setShowFollowUp(true)} style={btnStyle("success")}>
            Opvolging vastleggen
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Koppeling met ${link.partnerName} verwijderen? De partner zelf blijft bestaan.`)) {
              run(() => removePartnerLink(lead, link, user));
            }
          }}
          style={btnStyle("danger")}
        >
          Ontkoppelen
        </button>
      </div>
    </div>
  );
}

export function PartnersTab({ lead, user, partners, links, onManagePartners }) {
  const [error, setError] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [status, setStatus] = useState("sent");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [notes, setNotes] = useState("");
  const [quick, setQuick] = useState(null);
  const [busy, setBusy] = useState(false);

  const linkedIds = new Set(links.items.map((l) => l.partnerId));
  const available = partners.filter((p) => p.active !== false && !linkedIds.has(p.id));

  async function link() {
    setError("");
    const partner = partners.find((p) => p.id === partnerId);
    if (!partner) {
      setError("Kies een partner.");
      return;
    }
    setBusy(true);
    try {
      await addPartnerLink(lead, partner, { status, nextFollowUpAt, notes }, user);
      setPartnerId("");
      setNotes("");
      setNextFollowUpAt("");
    } catch (e) {
      console.error(e);
      setError(e.message || "Koppelen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function createQuick() {
    setError("");
    setBusy(true);
    try {
      const id = await savePartner({ ...quick, active: true }, user);
      setPartnerId(id);
      setQuick(null);
    } catch (e) {
      setError(e.message || "Partner aanmaken mislukt.");
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...links.items].sort((a, b) => String(a.partnerName).localeCompare(String(b.partnerName), "nl"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {links.error && <Notice tone="error">Partnerkoppelingen konden niet worden geladen.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <Panel title={`Partnerkoppelingen (${links.items.length})`}>
        {links.loading ? (
          <Empty>Laden...</Empty>
        ) : sorted.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sorted.map((l) => (
              <LinkCard key={l.id} link={l} lead={lead} user={user} onError={setError} />
            ))}
          </div>
        ) : (
          <Empty>Deze lead is nog aan geen enkele partner gekoppeld.</Empty>
        )}
      </Panel>

      <Panel
        title="Partner koppelen"
        right={
          <button type="button" onClick={onManagePartners} style={btnStyle("neutral")}>
            Partnerdatabase beheren
          </button>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <label style={labelStyle}>Partner</label>
            <select
              value={partnerId}
              onChange={(e) => {
                if (e.target.value === "__new") {
                  setQuick({ name: "", type: "realtor", contactPerson: "", email: "", phone: "" });
                  setPartnerId("");
                } else setPartnerId(e.target.value);
              }}
              style={inputStyle}
            >
              <option value="">Kies partner...</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({labelOf(PARTNER_TYPES, p.type)})
                </option>
              ))}
              <option value="__new">+ Nieuwe partner toevoegen...</option>
            </select>
          </div>
          <SelectField label="Status" value={status} onChange={setStatus} options={PARTNER_LINK_STATUSES} allowEmpty={false} />
          <TextField label="Opvolgen op" type="date" value={nextFollowUpAt} onChange={setNextFollowUpAt} />
          <div style={{ gridColumn: "1 / -1" }}>
            <TextField label="Notitie" value={notes} onChange={setNotes} placeholder="Bijv. 'Zoekprofiel gemaild aan Jan'" />
          </div>
        </div>

        {quick && (
          <div style={{ background: C.surfaceSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 14, padding: 16, marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            <TextField label="Naam partner *" value={quick.name} onChange={(v) => setQuick({ ...quick, name: v })} />
            <SelectField label="Soort" value={quick.type} onChange={(v) => setQuick({ ...quick, type: v })} options={PARTNER_TYPES} allowEmpty={false} />
            <TextField label="Contactpersoon" value={quick.contactPerson} onChange={(v) => setQuick({ ...quick, contactPerson: v })} />
            <TextField label="E-mail" value={quick.email} onChange={(v) => setQuick({ ...quick, email: v })} />
            <TextField label="Telefoon" value={quick.phone} onChange={(v) => setQuick({ ...quick, phone: v })} />
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setQuick(null)} style={btnStyle("neutral")}>
                Annuleren
              </button>
              <button type="button" onClick={createQuick} disabled={busy} style={btnStyle("primary", true)}>
                Partner opslaan
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" onClick={link} disabled={busy || !partnerId} style={{ ...btnStyle("primary", true), opacity: busy || !partnerId ? 0.6 : 1 }}>
            {busy ? "Bezig..." : "Koppelen"}
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 8 }}>
          Koppelen verandert de pipelinefase niet automatisch. Zet de lead zelf op "Gekoppeld aan partner" als dat klopt.
        </div>
      </Panel>
    </div>
  );
}
