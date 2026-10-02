import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACTIVITY_TYPES,
  MANUAL_ACTIVITY_TYPES,
  CONTACT_OUTCOMES,
  selectableActionTypes,
  isCustomerContactType,
  isSuccessfulContact,
  labelOf,
  optionOf,
  TIMELINE_FILTERS,
  QUICK_ACTIVITY_TYPES,
} from "../../crm/constants";
import { addActivity } from "../../crm/services";
import { NextActionDateField } from "./NextActionDateField";
import { toDateTimeLocal, fromDateTimeLocal, formatDateTime, toMillis, todayISO, addDaysISO } from "../../crm/dates";
import { Card, EmptyState, SelectField, TextField, TextAreaField, UserSelectField, Notice, Empty, Icon, btnStyle, labelStyle, inputStyle, C } from "../ui";

const NEXT_ACTION_KEYS = ["nextActionType", "nextActionLabel", "nextActionDate", "nextActionMonthOnly", "nextActionAssignedTo", "nextActionAssignedToName", "nextActionNotes"];

function freshDraft(user) {
  return {
    type: "phone_call",
    occurredAt: toDateTimeLocal(new Date()),
    performedByUserId: user?.id || "",
    performedByName: user?.displayName || "",
    title: "",
    description: "",
    outcome: "",
    planNext: false,
    nextActionType: "call_back",
    nextActionLabel: "",
    nextActionDate: addDaysISO(todayISO(), 3),
    nextActionMonthOnly: false,
    nextActionAssignedTo: user?.id || "",
    nextActionAssignedToName: user?.displayName || "",
    nextActionNotes: "",
  };
}

const TYPE_TONE = {
  phone_call: { color: C.navy, bg: C.navySoft },
  whatsapp: { color: C.success, bg: C.successBg },
  email: { color: C.info, bg: C.infoBg },
  appointment: { color: C.goldText, bg: C.goldSoft },
  note: { color: C.textBody, bg: C.surfaceSunken },
  partner_contact: { color: "#85663a", bg: "#f4ede2" },
  document: { color: C.info, bg: C.infoBg },
  viewing: { color: C.success, bg: C.successBg },
  other: { color: C.textMuted, bg: C.surfaceSunken },
  system: { color: C.textSubtle, bg: C.surfaceSoft },
};

function ActivityItem({ a, last }) {
  const t = optionOf(ACTIVITY_TYPES, a.type);
  const isSystem = a.type === "system";
  const tone = TYPE_TONE[a.type] || TYPE_TONE.other;
  return (
    <div style={{ display: "flex", gap: 14, position: "relative", paddingBottom: last ? 0 : 18 }}>
      {!last && <span aria-hidden="true" style={{ position: "absolute", left: 15, top: 34, bottom: 2, width: 1, background: C.border }} />}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 99,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: tone.bg,
          color: tone.color,
          border: `1px solid ${C.surface}`,
          boxShadow: `0 0 0 1px ${C.borderSoft}`,
          position: "relative",
        }}
      >
        <Icon name={t?.icon || "dot"} size={14} />
      </div>
      <div style={{ minWidth: 0, flex: 1, paddingTop: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
          <div style={{ fontSize: 13.5, fontWeight: isSystem ? 500 : 600, color: isSystem ? C.textMuted : C.text }}>
            {a.title || labelOf(ACTIVITY_TYPES, a.type)}
            {a.outcome && <span style={{ fontWeight: 500, color: C.goldText }}> · {labelOf(CONTACT_OUTCOMES, a.outcome)}</span>}
          </div>
          <div style={{ fontSize: 11.5, color: C.textSubtle, whiteSpace: "nowrap" }}>{formatDateTime(a.occurredAt || a.createdAt)}</div>
        </div>
        {a.description && <div style={{ fontSize: 13, color: C.textBody, marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{a.description}</div>}
        <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 4 }}>
          {labelOf(ACTIVITY_TYPES, a.type)}
          {a.actorType === "agent" ? ` · AI-agent${a.actorId ? ` (${a.actorId})` : ""}` : a.actorType === "system" ? " · automatisch" : ""}
          {(a.performedByName || a.createdByName) && ` · ${a.performedByName || a.createdByName}`}
        </div>
      </div>
    </div>
  );
}

/** "+ Activiteit" met een keuzemenu van de meest gebruikte soorten. */
function AddActivityMenu({ onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const quick = QUICK_ACTIVITY_TYPES.map((v) => optionOf(ACTIVITY_TYPES, v)).filter(Boolean);
  const others = MANUAL_ACTIVITY_TYPES.filter((t) => !QUICK_ACTIVITY_TYPES.includes(t.value));
  const item = (t) => (
    <button
      key={t.value}
      type="button"
      role="menuitem"
      className="msk-list-btn"
      onClick={() => {
        setOpen(false);
        onPick(t.value);
      }}
      style={{ display: "flex", gap: 9, alignItems: "center", width: "100%", textAlign: "left", border: "1px solid transparent", background: "none", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", color: C.text }}
    >
      <Icon name={t.icon} size={14} /> {t.label}
    </button>
  );
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ ...btnStyle("primary", true), minHeight: 36 }}>
        <Icon name="plus" size={14} /> Activiteit
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 40, minWidth: 220, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadowMd, padding: 6 }}>
          {quick.map(item)}
          <div style={{ height: 1, background: C.borderSoft, margin: "4px 6px" }} />
          {others.map(item)}
        </div>
      )}
    </div>
  );
}

// Systeemmeldingen die wél in "Alles" horen (betekenisvolle gebeurtenissen).
const KEY_EVENTS = new Set([
  "partner_linked",
  "partner_unlinked",
  "partner_status_changed",
  "task_completed",
  "file_added",
  "lead_created",
  "lead_imported",
  "sold",
  "lead_closed",
  "lead_reopened",
  "notes_moved_to_timeline",
]);
const KEY_FIELDS = new Set(["pipelineStage", "nextAction"]);

function isPartnerActivity(a) {
  return a.type === "partner_contact" || /^partner_/.test(a.metadata?.event || "");
}

/** Hoort een activiteit bij het gekozen filter? */
export function matchesTimelineFilter(a, filter, showSystem) {
  const isSystem = a.type === "system";
  const keySystem = isSystem && (KEY_EVENTS.has(a.metadata?.event) || KEY_FIELDS.has(a.metadata?.field));
  switch (filter) {
    case "contact":
      return isCustomerContactType(a.type);
    case "notes":
      return ["note", "other", "document", "viewing"].includes(a.type);
    case "partners":
      return isPartnerActivity(a);
    case "system":
      return isSystem;
    default:
      return !isSystem || keySystem || showSystem;
  }
}

export function TimelineTab({ lead, user, users, activities, clearEdits, setMessage }) {
  const [draft, setDraft] = useState(() => freshDraft(user));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSystem, setShowSystem] = useState(false);
  const [filter, setFilter] = useState("all");

  const upd = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const isContact = isCustomerContactType(draft.type);
  const success = isSuccessfulContact(draft.type, draft.outcome);


  const sorted = useMemo(
    () =>
      [...activities.items]
        .filter((a) => matchesTimelineFilter(a, filter, showSystem))
        .sort((a, b) => (toMillis(b.occurredAt || b.createdAt) || 0) - (toMillis(a.occurredAt || a.createdAt) || 0)),
    [activities.items, showSystem, filter]
  );

  async function submit() {
    setError("");
    if (!draft.title.trim() && !draft.description.trim() && !draft.outcome) {
      setError("Vul een titel, beschrijving of uitkomst in.");
      return;
    }
    if (draft.planNext) {
      if (!draft.nextActionDate) {
        setError("Kies een datum voor de volgende actie.");
        return;
      }
      if (draft.nextActionType === "other" && !draft.nextActionLabel.trim()) {
        setError("Omschrijf de volgende actie.");
        return;
      }
    }
    setBusy(true);
    try {
      const activity = {
        type: draft.type,
        occurredAt: fromDateTimeLocal(draft.occurredAt),
        performedByUserId: draft.performedByUserId,
        performedByName: draft.performedByName,
        title: draft.title.trim() || labelOf(ACTIVITY_TYPES, draft.type),
        description: draft.description.trim(),
        outcome: isContact ? draft.outcome : "",
      };
      const opts = {};
      if (draft.planNext) {
        opts.nextAction = {
          nextActionType: draft.nextActionType,
          nextActionLabel: draft.nextActionType === "other" ? draft.nextActionLabel.trim() : "",
          nextActionDate: draft.nextActionDate,
          nextActionMonthOnly: Boolean(draft.nextActionMonthOnly),
          nextActionAssignedTo: draft.nextActionAssignedTo,
          nextActionAssignedToName: draft.nextActionAssignedToName,
          nextActionNotes: draft.nextActionNotes.trim(),
        };
      }
      await addActivity(lead, activity, user, opts);
      if (opts.nextAction) clearEdits(NEXT_ACTION_KEYS);
      if (opts.pipelineStage) clearEdits(["pipelineStage"]);
      setDraft(freshDraft(user));
      setOpen(false);
      setMessage?.({ tone: "ok", text: "Activiteit opgeslagen." });
    } catch (e) {
      console.error(e);
      setError(e.message || "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div role="group" aria-label="Filter tijdlijn" style={{ display: "flex", gap: 2, padding: 3, background: C.surfaceSunken, border: `1px solid ${C.borderSoft}`, borderRadius: 10 }}>
          {TIMELINE_FILTERS.map((f) => {
            const on = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f.value)}
                style={{
                  border: "none",
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: on ? 600 : 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: on ? C.surface : "transparent",
                  color: on ? C.navy : C.textMuted,
                  boxShadow: on ? "0 1px 2px rgba(16,42,67,0.08)" : "none",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        {!open && (
          <AddActivityMenu
            onPick={(type) => {
              setDraft({ ...freshDraft(user), type });
              setOpen(true);
            }}
          />
        )}
      </div>

      {open && (
        <Card icon="plus" title={`${labelOf(ACTIVITY_TYPES, draft.type)} vastleggen`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <span style={labelStyle}>Soort</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {MANUAL_ACTIVITY_TYPES.map((t) => {
                  const on = draft.type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => upd({ type: t.value, outcome: "" })}
                      aria-pressed={on}
                      style={{ ...btnStyle(on ? "primary" : "neutral", on), padding: "7px 12px", boxShadow: "none" }}
                    >
                      <Icon name={t.icon} size={13} /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              <div>
                <label style={labelStyle}>Datum en tijd</label>
                <input type="datetime-local" value={draft.occurredAt} onChange={(e) => upd({ occurredAt: e.target.value })} style={inputStyle} />
              </div>
              <UserSelectField label="Medewerker" value={draft.performedByUserId} users={users} onChange={(id, name) => upd({ performedByUserId: id, performedByName: name })} />
              {isContact && <SelectField label="Uitkomst" value={draft.outcome} onChange={(v) => upd({ outcome: v })} options={CONTACT_OUTCOMES} placeholder="Kies uitkomst..." />}
            </div>
            <TextField label="Titel (optioneel)" value={draft.title} onChange={(v) => upd({ title: v })} placeholder={labelOf(ACTIVITY_TYPES, draft.type)} />
            <TextAreaField label="Beschrijving" value={draft.description} onChange={(v) => upd({ description: v })} rows={3} placeholder="Wat is er besproken of gebeurd?" />

            {isContact && draft.outcome && !success && (
              <div style={{ fontSize: 11.5, color: C.textSubtle }}>Deze uitkomst telt als contactpoging, niet als 'laatste contact'.</div>
            )}

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: C.text, fontWeight: 600 }}>
              <input type="checkbox" checked={draft.planNext} onChange={(e) => upd({ planNext: e.target.checked })} />
              Direct volgende actie plannen
            </label>

            {draft.planNext && (
              <div style={{ background: C.surfaceSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 14, padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <SelectField
                  label="Volgende actie"
                  value={draft.nextActionType}
                  onChange={(v) => upd({ nextActionType: v })}
                  options={selectableActionTypes(draft.nextActionType, { includeNone: false })}
                  allowEmpty={false}
                />
                <UserSelectField label="Uitvoerder" value={draft.nextActionAssignedTo} users={users} onChange={(id, name) => upd({ nextActionAssignedTo: id, nextActionAssignedToName: name })} />
                <div style={{ gridColumn: "1 / -1" }}>
                  <NextActionDateField value={draft.nextActionDate} monthOnly={draft.nextActionMonthOnly} onChange={upd} />
                </div>
                {draft.nextActionType === "other" && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <TextField label="Omschrijving actie *" value={draft.nextActionLabel} onChange={(v) => upd({ nextActionLabel: v })} />
                  </div>
                )}
                <div style={{ gridColumn: "1 / -1" }}>
                  <TextField label="Toelichting" value={draft.nextActionNotes} onChange={(v) => upd({ nextActionNotes: v })} />
                </div>
                <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: C.textSubtle }}>Dit vervangt de huidige volgende actie van de lead.</div>
              </div>
            )}

            {error && <Notice tone="error">{error}</Notice>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={() => { setOpen(false); setError(""); }} style={btnStyle("neutral")}>
                Annuleren
              </button>
              <button type="button" onClick={submit} disabled={busy} style={{ ...btnStyle("primary", true), padding: "8px 16px" }}>
                <Icon name="save" size={13} /> {busy ? "Opslaan..." : draft.planNext ? "Opslaan + actie plannen" : "Activiteit opslaan"}
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card
        icon="clock"
        title="Tijdlijn"
        right={
          filter === "all" ? (
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: C.textMuted, fontWeight: 500 }}>
              <input type="checkbox" checked={showSystem} onChange={(e) => setShowSystem(e.target.checked)} />
              Alle systeemmeldingen tonen
            </label>
          ) : null
        }
      >
        {activities.error && <Notice tone="error">Activiteiten konden niet worden geladen.</Notice>}
        {activities.loading ? (
          <Empty>Activiteiten laden...</Empty>
        ) : sorted.length ? (
          <div style={{ paddingTop: 4 }}>
            {sorted.map((a, i) => (
              <ActivityItem key={a.id} a={a} last={i === sorted.length - 1} />
            ))}
          </div>
        ) : (
          <EmptyState text={filter === "all" ? "Nog geen activiteiten" : "Niets gevonden met dit filter"} actionLabel="Activiteit toevoegen" onAction={() => setOpen(true)} />
        )}
      </Card>
    </div>
  );
}
