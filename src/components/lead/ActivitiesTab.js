import { useMemo, useState } from "react";
import {
  ACTIVITY_TYPES,
  MANUAL_ACTIVITY_TYPES,
  CONTACT_OUTCOMES,
  NEXT_ACTION_TYPES,
  isCustomerContactType,
  isSuccessfulContact,
  labelOf,
  optionOf,
} from "../../crm/constants";
import { addActivity } from "../../crm/services";
import { toDateTimeLocal, fromDateTimeLocal, formatDateTime, toMillis, todayISO, addDaysISO } from "../../crm/dates";
import { Panel, SelectField, TextField, TextAreaField, UserSelectField, Notice, Empty, Icon, btnStyle, labelStyle, inputStyle, C } from "../ui";

const NEXT_ACTION_KEYS = ["nextActionType", "nextActionLabel", "nextActionDate", "nextActionAssignedTo", "nextActionAssignedToName", "nextActionNotes"];

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
    nextActionAssignedTo: user?.id || "",
    nextActionAssignedToName: user?.displayName || "",
    nextActionNotes: "",
    moveToContact: true,
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
          {(a.performedByName || a.createdByName) && ` · ${a.performedByName || a.createdByName}`}
        </div>
      </div>
    </div>
  );
}

export function ActivitiesTab({ lead, user, users, activities, clearEdits, setMessage }) {
  const [draft, setDraft] = useState(() => freshDraft(user));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSystem, setShowSystem] = useState(true);

  const upd = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const isContact = isCustomerContactType(draft.type);
  const success = isSuccessfulContact(draft.type, draft.outcome);
  const offerStageMove = lead.pipelineStage === "new_lead" && isContact && success;

  const sorted = useMemo(
    () =>
      [...activities.items]
        .filter((a) => showSystem || a.type !== "system")
        .sort((a, b) => (toMillis(b.occurredAt || b.createdAt) || 0) - (toMillis(a.occurredAt || a.createdAt) || 0)),
    [activities.items, showSystem]
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
          nextActionAssignedTo: draft.nextActionAssignedTo,
          nextActionAssignedToName: draft.nextActionAssignedToName,
          nextActionNotes: draft.nextActionNotes.trim(),
        };
      }
      if (offerStageMove && draft.moveToContact) opts.pipelineStage = "contact_phase";
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
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} style={{ ...btnStyle("primary", true), alignSelf: "flex-start", padding: "9px 16px", fontSize: 13 }}>
          <Icon name="plus" size={14} /> Activiteit toevoegen
        </button>
      ) : (
        <Panel title="Activiteit toevoegen">
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

            {offerStageMove && (
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: C.text }}>
                <input type="checkbox" checked={draft.moveToContact} onChange={(e) => upd({ moveToContact: e.target.checked })} />
                Pipelinefase direct naar "Contactfase" zetten
              </label>
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
                  options={NEXT_ACTION_TYPES.filter((o) => o.value !== "none")}
                  allowEmpty={false}
                />
                <TextField label="Datum *" type="date" value={draft.nextActionDate} onChange={(v) => upd({ nextActionDate: v })} />
                <UserSelectField label="Uitvoerder" value={draft.nextActionAssignedTo} users={users} onChange={(id, name) => upd({ nextActionAssignedTo: id, nextActionAssignedToName: name })} />
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
        </Panel>
      )}

      <Panel
        title="Tijdlijn"
        right={
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: C.textMuted, fontWeight: 600 }}>
            <input type="checkbox" checked={showSystem} onChange={(e) => setShowSystem(e.target.checked)} />
            Systeemmeldingen tonen
          </label>
        }
      >
        {activities.error && <Notice tone="error">Activiteiten konden niet worden geladen.</Notice>}
        {activities.loading ? <Empty>Activiteiten laden...</Empty> : sorted.length ? <div style={{ paddingTop: 4 }}>{sorted.map((a, i) => <ActivityItem key={a.id} a={a} last={i === sorted.length - 1} />)}</div> : <Empty>Nog geen activiteiten.</Empty>}
      </Panel>
    </div>
  );
}
