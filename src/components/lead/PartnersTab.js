import { useState } from "react";
import { PARTNER_TYPES, PARTNER_LINK_STATUSES, PARTNER_WAITING_STATUSES, THRESHOLDS, labelOf } from "../../crm/constants";
import { addPartnerLink, updatePartnerLink, removePartnerLink, savePartner } from "../../crm/services";
import { formatDate, formatDateTime, daysSince, diffInDays, toDate } from "../../crm/dates";
import { Card, InfoRow, EmptyState, MoreMenu, SelectField, TextField, TextAreaField, Notice, Empty, Badge, OptionBadge, Icon, btnStyle, inputStyle, labelStyle, C } from "../ui";

function linkWarning(link) {
  if (!PARTNER_WAITING_STATUSES.includes(link.status)) return null;
  if (link.nextFollowUpAt && diffInDays(link.nextFollowUpAt) < 0) return "Opvolgdatum verlopen";
  const since = daysSince(toDate(link.lastFollowUpAt) || toDate(link.linkedAt));
  if (since !== null && since >= THRESHOLDS.PARTNER_FOLLOW_UP_DAYS) return `${since} dagen geen terugkoppeling`;
  return null;
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 };

function LinkCard({ link, lead, user, onError }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [followUpNote, setFollowUpNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const warning = linkWarning(link);

  async function run(fn) {
    setBusy(true);
    onError("");
    try {
      await fn();
      return true;
    } catch (e) {
      console.error(e);
      onError(e.message || "Opslaan mislukt. Er is niets verloren gegaan; probeer het opnieuw.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    setDraft({ status: link.status, nextFollowUpAt: link.nextFollowUpAt || "", notes: link.notes || "" });
    setEditing(true);
  }

  async function saveEdit() {
    const patch = {};
    if (draft.status !== link.status) patch.status = draft.status;
    if ((draft.nextFollowUpAt || "") !== (link.nextFollowUpAt || "")) patch.nextFollowUpAt = draft.nextFollowUpAt;
    if ((draft.notes || "") !== (link.notes || "")) patch.notes = draft.notes;
    if (!Object.keys(patch).length) {
      setEditing(false);
      return;
    }
    if (await run(() => updatePartnerLink(lead, link, patch, user))) setEditing(false);
  }

  return (
    <div
      style={{
        border: `1px solid ${warning ? C.dangerBorder : C.border}`,
        borderRadius: 14,
        padding: "14px 16px",
        background: C.surface,
        opacity: busy ? 0.7 : 1,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {warning && <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: C.danger }} />}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{link.partnerName}</span>
            <OptionBadge options={PARTNER_LINK_STATUSES} value={link.status} />
            {warning && (
              <Badge color="#b3453a" bg="#fbedeb" icon="alertCircle">
                {warning}
              </Badge>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 3 }}>
            {labelOf(PARTNER_TYPES, link.partnerType)}
            {link.contactPerson && ` · ${link.contactPerson}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {!showFollowUp && !editing && (
            <button type="button" onClick={() => setShowFollowUp(true)} style={btnStyle("primary")}>
              <Icon name="plus" size={13} /> Opvolging registreren
            </button>
          )}
          <MoreMenu
            label={`Meer acties voor ${link.partnerName}`}
            items={[
              !editing && { label: "Status, datum of notitie wijzigen", icon: "edit", onClick: startEdit },
              {
                label: "Partner ontkoppelen",
                icon: "x",
                danger: true,
                onClick: () => {
                  if (window.confirm(`Koppeling met ${link.partnerName} verwijderen? De partner zelf blijft bestaan.`)) run(() => removePartnerLink(lead, link, user));
                },
              },
            ]}
          />
        </div>
      </div>

      {editing ? (
        <div style={{ ...grid, marginTop: 12 }}>
          <SelectField label="Status" value={draft.status} onChange={(v) => setDraft({ ...draft, status: v })} options={PARTNER_LINK_STATUSES} allowEmpty={false} />
          <TextField label="Volgende opvolging" type="date" value={draft.nextFollowUpAt} onChange={(v) => setDraft({ ...draft, nextFollowUpAt: v })} />
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Notitie</label>
            <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => setEditing(false)} style={btnStyle("neutral")}>
              Annuleren
            </button>
            <button type="button" onClick={saveEdit} disabled={busy} style={btnStyle("primary", true)}>
              Opslaan
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <InfoRow label="Gekoppeld">
            {formatDate(link.linkedAt)}
            {link.linkedByName ? ` door ${link.linkedByName}` : ""}
          </InfoRow>
          <InfoRow label="Volgende opvolging" muted={!link.nextFollowUpAt}>
            {link.nextFollowUpAt ? formatDate(link.nextFollowUpAt) : "Niet gepland"}
          </InfoRow>
          <InfoRow label="Laatste opvolging" muted={!link.lastFollowUpAt}>
            {link.lastFollowUpAt ? formatDateTime(link.lastFollowUpAt) : "Nog niet"}
          </InfoRow>
          {link.notes && <InfoRow label="Notitie">{link.notes}</InfoRow>}
        </div>
      )}

      {showFollowUp && (
        <div style={{ background: C.surfaceSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: 14, marginTop: 12, display: "grid", gap: 10 }}>
          <TextAreaField label="Wat is er besproken met de partner?" value={followUpNote} onChange={setFollowUpNote} rows={2} />
          <div style={{ maxWidth: 220 }}>
            <TextField label="Volgende opvolging (optioneel)" type="date" value={nextDate} onChange={setNextDate} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowFollowUp(false)} style={btnStyle("neutral")}>
              Annuleren
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await updatePartnerLink(lead, link, nextDate ? { nextFollowUpAt: nextDate } : {}, user, { logFollowUp: true, followUpNote });
                  setFollowUpNote("");
                  setNextDate("");
                  setShowFollowUp(false);
                })
              }
              style={btnStyle("primary", true)}
            >
              Opvolging opslaan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LinkForm({ lead, user, partners, linkedIds, onDone, onError }) {
  const [partnerId, setPartnerId] = useState("");
  const [status, setStatus] = useState("sent");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [notes, setNotes] = useState("");
  const [quick, setQuick] = useState(null);
  const [busy, setBusy] = useState(false);
  const available = partners.filter((p) => p.active !== false && !linkedIds.has(p.id));

  async function link() {
    onError("");
    const partner = partners.find((p) => p.id === partnerId);
    if (!partner) {
      onError("Kies een partner.");
      return;
    }
    setBusy(true);
    try {
      await addPartnerLink(lead, partner, { status, nextFollowUpAt, notes }, user);
      onDone();
    } catch (e) {
      console.error(e);
      onError(e.message || "Koppelen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function createQuick() {
    onError("");
    if (!String(quick.name || "").trim()) {
      onError("Vul een naam in voor de nieuwe partner.");
      return;
    }
    setBusy(true);
    try {
      const id = await savePartner({ ...quick, active: true }, user);
      setPartnerId(id);
      setQuick(null);
    } catch (e) {
      onError(e.message || "Partner aanmaken mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: C.surfaceSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 14, padding: 16 }}>
      <div style={grid}>
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
            style={{ ...inputStyle, background: C.surface }}
            aria-label="Partner"
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
        <TextField label="Volgende opvolging" type="date" value={nextFollowUpAt} onChange={setNextFollowUpAt} />
        <div style={{ gridColumn: "1 / -1" }}>
          <TextField label="Notitie" value={notes} onChange={setNotes} placeholder="Bijv. 'Zoekprofiel gemaild aan Jan'" />
        </div>
      </div>

      {quick && (
        <div style={{ ...grid, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <TextField label="Naam partner *" value={quick.name} onChange={(v) => setQuick({ ...quick, name: v })} />
          <SelectField label="Soort" value={quick.type} onChange={(v) => setQuick({ ...quick, type: v })} options={PARTNER_TYPES} allowEmpty={false} />
          <TextField label="Contactpersoon" value={quick.contactPerson} onChange={(v) => setQuick({ ...quick, contactPerson: v })} />
          <TextField label="E-mail" value={quick.email} onChange={(v) => setQuick({ ...quick, email: v })} />
          <TextField label="Telefoon" value={quick.phone} onChange={(v) => setQuick({ ...quick, phone: v })} />
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setQuick(null)} style={btnStyle("neutral")}>
              Annuleren
            </button>
            <button type="button" onClick={createQuick} disabled={busy} style={btnStyle("primary")}>
              Partner aanmaken
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, color: C.textSubtle }}>Koppelen verandert de pipelinefase niet automatisch.</span>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onDone} style={btnStyle("neutral")}>
            Annuleren
          </button>
          <button type="button" onClick={link} disabled={busy || !partnerId} style={btnStyle("primary", true)}>
            {busy ? "Bezig..." : "Koppelen"}
          </button>
        </span>
      </div>
    </div>
  );
}

export function PartnersTab({ lead, user, partners, links }) {
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const linkedIds = new Set(links.items.map((l) => l.partnerId));
  const sorted = [...links.items].sort((a, b) => String(a.partnerName).localeCompare(String(b.partnerName), "nl"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {links.error && <Notice tone="error">Partnerkoppelingen konden niet worden geladen.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <Card
        icon="users"
        title={`Huidige partnerkoppelingen${links.items.length ? ` (${links.items.length})` : ""}`}
        right={
          sorted.length > 0 && !adding ? (
            <button type="button" onClick={() => setAdding(true)} style={{ ...btnStyle("primary"), minHeight: 30, padding: "4px 12px", fontSize: 12 }}>
              <Icon name="plus" size={13} /> Partner koppelen
            </button>
          ) : null
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {links.loading ? (
            <Empty>Laden...</Empty>
          ) : sorted.length ? (
            sorted.map((l) => <LinkCard key={l.id} link={l} lead={lead} user={user} onError={setError} />)
          ) : (
            !adding && <EmptyState text="Geen partner gekoppeld" actionLabel="Partner koppelen" onAction={() => setAdding(true)} />
          )}
          {adding && <LinkForm lead={lead} user={user} partners={partners} linkedIds={linkedIds} onDone={() => setAdding(false)} onError={setError} />}
        </div>
      </Card>
    </div>
  );
}
