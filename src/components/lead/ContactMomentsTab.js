// ─── CONTACTMOMENTEN ─────────────────────────────────────────────────────────
// Eén overzicht van alle contact met en rond deze lead. Vastleggen is simpel:
// onderwerp typen, verhaal typen, opslaan. Zodra je begint te typen staat de
// datum en tijd vast (aan te passen als het eerder gebeurde).
//
// De lijst toont naast de nieuwe contactmomenten ook bestaand contact uit de
// tijdlijn (telefoon, WhatsApp, e-mail, gesprekken, partnercontact, afgevinkte
// acties en verwerkte gespreksopnames), zodat niets verloren gaat.

import { useMemo, useRef, useState } from "react";
import { ACTIVITY_TYPES, CONTACT_OUTCOMES, labelOf, optionOf } from "../../crm/constants";
import { addContactMoment, updateContactMoment, deleteContactMoment } from "../../crm/services";
import { toDate, toMillis, toDateTimeLocal, fromDateTimeLocal } from "../../crm/dates";
import { Card, Icon, Notice, Empty, MoreMenu, btnStyle, inputStyle, labelStyle, linkBtnStyle, C } from "../ui";

const DEFAULT_SUBJECTS = ["Klantcontact", "Controle makelaar", "WhatsApp gestuurd", "Telefoongesprek", "E-mail gestuurd", "Follow-up"];

const CONTACT_TYPES = new Set(["contact_moment", "phone_call", "whatsapp", "email", "appointment", "partner_contact", "action_done"]);

/** Hoort deze tijdlijnregel in het contactoverzicht? */
export function isContactEntry(a) {
  return CONTACT_TYPES.has(a.type) || (a.type === "system" && a.metadata?.event === "call_approved");
}

const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const DAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function whenText(d) {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} om ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function kindOf(a) {
  if (a.type === "contact_moment") return a.metadata?.customerContact === false ? "Contactmoment · niet met de klant" : "Contactmoment";
  if (a.type === "action_done") return "Afgevinkte actie";
  if (a.type === "system") return "Gesprek verwerkt";
  return labelOf(ACTIVITY_TYPES, a.type);
}

const TONE = {
  contact_moment: { color: C.navy, bg: C.navySoft },
  action_done: { color: C.success, bg: C.successBg },
  partner_contact: { color: "#85663a", bg: "#f4ede2" },
  system: { color: C.goldText, bg: C.goldSoft },
};

// ─── NIEUW CONTACTMOMENT ─────────────────────────────────────────────────────
function Composer({ lead, user, subjects, onSaved, onError }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [at, setAt] = useState(null); // vastgezet zodra je begint te typen
  const [editAt, setEditAt] = useState(false);
  const [customer, setCustomer] = useState(true);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef(null);

  const started = Boolean(title || text);
  function touch() {
    if (!at) setAt(new Date());
  }
  function reset() {
    setTitle("");
    setText("");
    setAt(null);
    setEditAt(false);
    setCustomer(true);
  }

  async function save() {
    if (!title.trim() && !text.trim()) return;
    setBusy(true);
    onError("");
    try {
      await addContactMoment(lead, { title, description: text, occurredAt: at || new Date(), customerContact: customer }, user);
      reset();
      onSaved();
      titleRef.current?.focus();
    } catch (e) {
      onError(e.message || "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      save();
    }
  }

  return (
    <Card icon="plus" title="Nieuw contactmoment" bodyStyle={{ padding: "14px 18px 16px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }} onKeyDown={onKeyDown}>
        <div>
          <label style={labelStyle} htmlFor="cm-title">
            Onderwerp
          </label>
          <input
            id="cm-title"
            ref={titleRef}
            autoFocus
            list="cm-subjects"
            value={title}
            onChange={(e) => {
              touch();
              setTitle(e.target.value);
            }}
            placeholder="Bijv. Klantcontact of Controle makelaar"
            style={{ ...inputStyle, fontWeight: 600 }}
          />
          <datalist id="cm-subjects">
            {subjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <label style={labelStyle} htmlFor="cm-text">
            Wat is er gebeurd of besproken?
          </label>
          <textarea
            id="cm-text"
            value={text}
            onChange={(e) => {
              touch();
              setText(e.target.value);
            }}
            rows={4}
            placeholder="Typ hier het verhaal…"
            style={{ ...inputStyle, minHeight: 96, resize: "vertical", lineHeight: 1.5 }}
          />
        </div>

        {started && at && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, color: C.textBody, background: C.surfaceSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: "8px 10px" }}>
            <Icon name="clock" size={14} />
            {editAt ? (
              <input type="datetime-local" value={toDateTimeLocal(at)} onChange={(e) => setAt(fromDateTimeLocal(e.target.value))} style={{ ...inputStyle, width: "auto", minHeight: 32 }} aria-label="Datum en tijd" />
            ) : (
              <strong style={{ fontWeight: 600, color: C.navy }}>{whenText(at)}</strong>
            )}
            <button type="button" onClick={() => setEditAt((v) => !v)} className="msk-link" style={linkBtnStyle}>
              {editAt ? "klaar" : "aanpassen"}
            </button>
            <span style={{ color: C.textSubtle }}>· {user?.displayName}</span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12.5, color: C.textBody, cursor: "pointer" }} title="Uitzetten bij bijvoorbeeld contact met de makelaar. Dan telt het niet als klantcontact in de KPI's.">
            <input type="checkbox" checked={customer} onChange={(e) => setCustomer(e.target.checked)} />
            Contact met de klant zelf
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {started && (
              <button type="button" onClick={reset} style={btnStyle("neutral")}>
                Wissen
              </button>
            )}
            <button type="button" onClick={save} disabled={busy || !started} style={btnStyle("primary", true)} title="Opslaan (Ctrl/Cmd + Enter)">
              <Icon name="check" size={14} /> {busy ? "Opslaan…" : "Opslaan"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── ÉÉN REGEL ───────────────────────────────────────────────────────────────
function EntryRow({ a, lead, user, onError }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const d = toDate(a.occurredAt) || toDate(a.createdAt);
  const tone = TONE[a.type] || { color: C.textBody, bg: C.surfaceSunken };
  const icon = a.type === "system" ? "mic" : optionOf(ACTIVITY_TYPES, a.type)?.icon || "chat";
  const editable = a.type === "contact_moment";
  const who = a.performedByName || a.createdByName;

  function startEdit() {
    setDraft({ title: a.title || "", description: a.description || "", occurredAt: toDateTimeLocal(d || new Date()), customerContact: a.metadata?.customerContact !== false });
    setEditing(true);
  }

  async function saveEdit() {
    try {
      await updateContactMoment(lead, a, { ...draft, occurredAt: fromDateTimeLocal(draft.occurredAt) }, user);
      setEditing(false);
    } catch (e) {
      onError(e.message || "Opslaan mislukt.");
    }
  }

  async function remove() {
    if (!window.confirm(`Contactmoment "${a.title || "zonder titel"}" verwijderen?`)) return;
    try {
      await deleteContactMoment(lead, a, user);
    } catch (e) {
      onError(e.message || "Verwijderen mislukt.");
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 14, padding: "12px 0", borderBottom: `1px solid ${C.borderSoft}` }}>
      <div style={{ fontVariantNumeric: "tabular-nums" }}>
        {d ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>
              {DAYS[d.getDay()]} {d.getDate()} {MONTHS[d.getMonth()].slice(0, 3)}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              {pad(d.getHours())}:{pad(d.getMinutes())}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: C.textSubtle }}>–</div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ ...inputStyle, fontWeight: 600 }} aria-label="Onderwerp" />
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} aria-label="Tekst" />
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input type="datetime-local" value={draft.occurredAt} onChange={(e) => setDraft({ ...draft, occurredAt: e.target.value })} style={{ ...inputStyle, width: "auto", minHeight: 32 }} aria-label="Datum en tijd" />
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: C.textBody }}>
                <input type="checkbox" checked={draft.customerContact} onChange={(e) => setDraft({ ...draft, customerContact: e.target.checked })} /> Contact met de klant zelf
              </label>
              <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button type="button" onClick={() => setEditing(false)} style={btnStyle("neutral")}>
                  Annuleren
                </button>
                <button type="button" onClick={saveEdit} style={btnStyle("primary", true)}>
                  Opslaan
                </button>
              </span>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 99, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: tone.bg, color: tone.color }}>
                  <Icon name={icon} size={12} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text, overflowWrap: "anywhere" }}>
                  {a.title || kindOf(a)}
                  {a.outcome && <span style={{ fontWeight: 500, color: C.goldText }}> · {labelOf(CONTACT_OUTCOMES, a.outcome)}</span>}
                </span>
              </div>
              {editable && (
                <MoreMenu
                  label="Acties voor contactmoment"
                  items={[
                    { label: "Aanpassen", icon: "edit", onClick: startEdit },
                    { label: "Verwijderen", icon: "trash", danger: true, onClick: remove },
                  ]}
                />
              )}
            </div>
            {a.description && <div style={{ fontSize: 13, color: C.textBody, marginTop: 5, whiteSpace: "pre-wrap", lineHeight: 1.55, overflowWrap: "anywhere" }}>{a.description}</div>}
            <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 5 }}>
              {kindOf(a)}
              {who ? ` · ${who}` : ""}
              {a.editedAt ? " · aangepast" : ""}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── TAB ─────────────────────────────────────────────────────────────────────
export function ContactMomentsTab({ lead, user, activities }) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");

  const entries = useMemo(
    () =>
      activities.items
        .filter(isContactEntry)
        .sort((a, b) => (toMillis(b.occurredAt || b.createdAt) || 0) - (toMillis(a.occurredAt || a.createdAt) || 0)),
    [activities.items]
  );

  const subjects = useMemo(() => {
    const used = entries.filter((a) => a.type === "contact_moment" && a.title).map((a) => a.title);
    return Array.from(new Set([...DEFAULT_SUBJECTS, ...used]));
  }, [entries]);

  const q = query.trim().toLowerCase();
  const shown = q ? entries.filter((a) => `${a.title || ""} ${a.description || ""} ${a.performedByName || a.createdByName || ""}`.toLowerCase().includes(q)) : entries;

  // Groeperen per maand voor overzicht in één oogopslag.
  const groups = [];
  shown.forEach((a) => {
    const d = toDate(a.occurredAt) || toDate(a.createdAt);
    const key = d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "Zonder datum";
    if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, items: [] });
    groups[groups.length - 1].items.push(a);
  });

  const last = entries[0] && (toDate(entries[0].occurredAt) || toDate(entries[0].createdAt));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))", gap: 16, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Composer
          lead={lead}
          user={user}
          subjects={subjects}
          onError={setError}
          onSaved={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          }}
        />
        {error && <Notice tone="error">{error}</Notice>}
        {saved && <Notice tone="ok">Contactmoment opgeslagen.</Notice>}
      </div>

      <Card
        icon="chat"
        title={`Alle contactmomenten (${entries.length})`}
        right={last ? <span style={{ fontSize: 12, color: C.textMuted }}>Laatste: {whenText(last)}</span> : null}
        bodyStyle={{ padding: "6px 18px 12px" }}
      >
        {entries.length > 4 && (
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek in contactmomenten…" style={{ ...inputStyle, margin: "8px 0 4px" }} aria-label="Zoek in contactmomenten" />
        )}
        {activities.loading ? (
          <Empty>Laden…</Empty>
        ) : activities.error ? (
          <Notice tone="error">Contactmomenten konden niet worden geladen.</Notice>
        ) : !entries.length ? (
          <Empty>Nog geen contactmomenten. Typ links een onderwerp om te beginnen.</Empty>
        ) : !shown.length ? (
          <Empty>Niets gevonden voor "{query}".</Empty>
        ) : (
          groups.map((g) => (
            <div key={g.key}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: C.textSubtle, padding: "12px 0 2px" }}>{g.key}</div>
              {g.items.map((a) => (
                <EntryRow key={a.id} a={a} lead={lead} user={user} onError={setError} />
              ))}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
