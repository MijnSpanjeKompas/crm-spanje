import { useState } from "react";
import {
  selectableActionTypes,
  APPOINTMENT_TYPES,
  APPOINTMENT_STATUSES,
  PIPELINE_STAGES,
  PRIORITIES,
  labelOf,
  nextActionText,
} from "../../crm/constants";
import { getNextActionInfo } from "../../crm/signals";
import { todayISO, formatDate, diffInDays, formatActionDate } from "../../crm/dates";
import { addTask, setTaskStatus } from "../../crm/services";
import { NextActionDateField } from "./NextActionDateField";
import {
  Card,
  InfoRow,
  EmptyState,
  MoreMenu,
  SelectField,
  TextField,
  TextAreaField,
  UserSelectField,
  Badge,
  Notice,
  Empty,
  btnStyle,
  inputStyle,
  labelStyle,
  linkBtnStyle,
  Icon,
  C,
} from "../ui";

const STAGE_INDEX = (v) => PIPELINE_STAGES.findIndex((s) => s.value === v);


function TasksSection({ lead, user, users, tasks, isNew }) {
  const [draft, setDraft] = useState({ title: "", dueDate: "", assignedToUserId: user?.id || "", assignedToName: user?.displayName || "", priority: "normal", description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);

  if (isNew) return <Notice>Sla de lead eerst op. Daarna kun je hier taken toevoegen.</Notice>;

  const items = [...tasks.items].sort((a, b) => String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999")));
  const open = items.filter((t) => t.status === "open");
  const done = items.filter((t) => t.status !== "open");

  async function submit() {
    setError("");
    if (!draft.title.trim()) {
      setError("Geef de taak een titel.");
      return;
    }
    setBusy(true);
    try {
      await addTask(lead, draft, user);
      setDraft((d) => ({ ...d, title: "", description: "", dueDate: "" }));
      setAdding(false);
    } catch (e) {
      setError(e.message || "Taak toevoegen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(task, status) {
    setError("");
    try {
      await setTaskStatus(lead, task, status, user);
    } catch (e) {
      setError(e.message || "Bijwerken mislukt.");
    }
  }

  const renderTask = (t) => {
    const diff = t.dueDate ? diffInDays(t.dueDate) : null;
    const late = t.status === "open" && diff !== null && diff < 0;
    return (
      <div
        key={t.id}
        className="msk-row"
        style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "12px 10px", margin: "0 -10px", borderRadius: 12, borderBottom: `1px solid ${C.borderSoft}`, flexWrap: "wrap" }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0, flex: "1 1 240px" }}>
          <span
            aria-hidden="true"
            style={{
              width: 20,
              height: 20,
              marginTop: 1,
              borderRadius: 99,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1.5px solid ${t.status === "completed" ? C.success : late ? C.danger : C.borderStrong}`,
              background: t.status === "completed" ? C.success : C.surface,
              color: t.status === "completed" ? "#fff" : C.textSubtle,
            }}
          >
            {t.status === "completed" && <Icon name="check" size={12} />}
            {t.status === "cancelled" && <Icon name="x" size={11} />}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: t.status === "open" ? C.text : C.textSubtle, textDecoration: t.status === "completed" ? "line-through" : "none" }}>{t.title}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {t.dueDate && (
                <span style={{ color: late ? C.danger : C.textMuted, fontWeight: late ? 600 : 400, display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <Icon name={late ? "alertCircle" : "calendar"} size={12} />
                  Deadline {formatDate(t.dueDate)}
                  {late ? " · te laat" : ""}
                </span>
              )}
              {t.assignedToName && <span>· {t.assignedToName}</span>}
              {t.priority && t.priority !== "normal" && <span>· Prio {labelOf(PRIORITIES, t.priority).toLowerCase()}</span>}
              {t.status !== "open" && <span>· {t.status === "completed" ? "Afgerond" : "Geannuleerd"}</span>}
            </div>
            {t.description && <div style={{ fontSize: 12.5, color: C.textBody, marginTop: 4, whiteSpace: "pre-wrap" }}>{t.description}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {t.status === "open" ? (
            <>
              <button type="button" onClick={() => changeStatus(t, "completed")} style={btnStyle("success")}>
                <Icon name="check" size={13} /> Afronden
              </button>
              <MoreMenu label="Meer acties voor taak" items={[{ label: "Taak annuleren", icon: "x", onClick: () => changeStatus(t, "cancelled") }]} />
            </>
          ) : (
            <button type="button" onClick={() => changeStatus(t, "open")} style={btnStyle("primary")}>
              Heropenen
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {tasks.error && <Notice tone="error">Taken konden niet worden geladen.</Notice>}
      {tasks.loading ? (
        <Empty>Taken laden...</Empty>
      ) : open.length ? (
        <div>{open.map(renderTask)}</div>
      ) : (
        !adding && <EmptyState text="Geen open taken" actionLabel="Taak toevoegen" onAction={() => setAdding(true)} />
      )}
      {open.length > 0 && !adding && (
        <button type="button" onClick={() => setAdding(true)} style={{ ...btnStyle("primary"), alignSelf: "flex-start" }}>
          <Icon name="plus" size={13} /> Taak toevoegen
        </button>
      )}
      {done.length > 0 && (
        <button type="button" onClick={() => setShowDone((v) => !v)} className="msk-link" style={{ ...linkBtnStyle, alignSelf: "flex-start", color: C.textMuted }}>
          {showDone ? "Verberg" : "Toon"} afgeronde/geannuleerde taken ({done.length})
        </button>
      )}
      {showDone && <div>{done.map(renderTask)}</div>}

      {adding && (
        <div style={{ background: C.surfaceSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 14, padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <TextField label="Titel *" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} placeholder="Bijv. 'Financieringsbewijs opvragen'" autoFocus />
          </div>
          <TextField label="Deadline" type="date" value={draft.dueDate} onChange={(v) => setDraft({ ...draft, dueDate: v })} />
          <UserSelectField label="Toegewezen aan" value={draft.assignedToUserId} users={users} onChange={(id, name) => setDraft({ ...draft, assignedToUserId: id, assignedToName: name })} />
          <SelectField label="Prioriteit" value={draft.priority} onChange={(v) => setDraft({ ...draft, priority: v })} options={PRIORITIES} allowEmpty={false} />
          <div style={{ gridColumn: "1 / -1" }}>
            <TextAreaField label="Omschrijving (optioneel)" value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} rows={2} />
          </div>
          {error && (
            <div style={{ gridColumn: "1 / -1" }}>
              <Notice tone="error">{error}</Notice>
            </div>
          )}
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => { setAdding(false); setError(""); }} style={btnStyle("neutral")}>
              Annuleren
            </button>
            <button type="button" onClick={submit} disabled={busy} style={btnStyle("primary", true)}>
              {busy ? "Toevoegen..." : "Taak opslaan"}
            </button>
          </div>
        </div>
      )}
      {error && !adding && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

// ─── VOLGENDE ACTIE ──────────────────────────────────────────────────────────
function NextActionSection({ form, set, setMany, errors, users, user }) {
  const na = getNextActionInfo(form);
  const planned = form.nextActionType && form.nextActionType !== "none";
  const hasError = Boolean(errors.nextActionDate || errors.nextActionLabel);
  const [editing, setEditing] = useState(false);
  const open = editing || hasError;
  const today = todayISO();

  function setActionType(v) {
    if (v === "none") {
      setMany({ nextActionType: "none", nextActionDate: "", nextActionLabel: "", nextActionMonthOnly: false });
      return;
    }
    const patch = { nextActionType: v };
    if (!form.nextActionDate) {
      patch.nextActionDate = today;
      patch.nextActionMonthOnly = false;
    }
    if (!form.nextActionAssignedTo && user) {
      patch.nextActionAssignedTo = user.id;
      patch.nextActionAssignedToName = user.displayName;
    }
    if (v !== "other") patch.nextActionLabel = "";
    setMany(patch);
  }

  return (
    <Card
      icon="bell"
      title="Volgende actie"
      right={
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {planned && <Badge color={na.color} bg={na.bg}>{na.label}</Badge>}
          <button type="button" onClick={() => setEditing((v) => !v)} style={{ ...btnStyle(open ? "primary" : "neutral", open), minHeight: 30, padding: "4px 12px", fontSize: 12 }}>
            {open ? "Klaar" : planned ? "Wijzigen" : "Plannen"}
          </button>
        </span>
      }
    >
      {!open ? (
        planned ? (
          <div>
            <InfoRow label="Actie">
              <strong style={{ fontWeight: 600 }}>{nextActionText(form)}</strong>
            </InfoRow>
            <InfoRow label="Datum" muted={!form.nextActionDate}>
              {form.nextActionDate ? formatActionDate(form.nextActionDate, form.nextActionMonthOnly) : "Datum ontbreekt"}
            </InfoRow>
            <InfoRow label="Uitvoerder" muted={!form.nextActionAssignedToName}>
              {form.nextActionAssignedToName || "Niemand"}
            </InfoRow>
            {form.nextActionNotes && <InfoRow label="Toelichting">{form.nextActionNotes}</InfoRow>}
          </div>
        ) : (
          <EmptyState text="Geen actie gepland" actionLabel="Actie plannen" onAction={() => setEditing(true)} />
        )
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <SelectField label="Actie" value={form.nextActionType || "none"} onChange={setActionType} options={selectableActionTypes(form.nextActionType)} allowEmpty={false} />
          </div>
          {form.nextActionType === "other" && (
            <div style={{ gridColumn: "1 / -1" }}>
              <TextField label="Omschrijving actie *" value={form.nextActionLabel} onChange={(v) => set("nextActionLabel", v)} error={errors.nextActionLabel} />
            </div>
          )}
          {planned && (
            <>
              <div style={{ gridColumn: "1 / -1" }}>
                <NextActionDateField value={form.nextActionDate} monthOnly={form.nextActionMonthOnly} onChange={setMany} error={errors.nextActionDate} />
              </div>
              <UserSelectField label="Uitvoerder" value={form.nextActionAssignedTo} users={users} onChange={(id, name) => setMany({ nextActionAssignedTo: id, nextActionAssignedToName: name })} />
              <div style={{ gridColumn: "1 / -1" }}>
                <TextAreaField label="Toelichting" value={form.nextActionNotes} onChange={(v) => set("nextActionNotes", v)} rows={2} />
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── GESPREK ─────────────────────────────────────────────────────────────────
function emptyAppointmentDraft(form, user) {
  return {
    appointmentDate: form.appointmentStatus === "scheduled" ? form.appointmentDate || "" : "",
    appointmentTime: form.appointmentStatus === "scheduled" ? form.appointmentTime || "" : "",
    appointmentType: form.appointmentStatus === "scheduled" ? form.appointmentType || "phone" : "phone",
    appointmentAssignedTo: form.appointmentAssignedTo || user?.id || "",
    appointmentAssignedToName: form.appointmentAssignedToName || user?.displayName || "",
  };
}

function AppointmentSection({ form, setMany, errors, users, user, isNew }) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const planned = form.nextActionType && form.nextActionType !== "none";
  const today = todayISO();
  const scheduled = form.appointmentStatus === "scheduled";
  const hasRecord = Boolean(form.appointmentStatus && form.appointmentDate);

  function startPlanning() {
    setError("");
    setDraft(emptyAppointmentDraft(form, user));
  }

  function savePlan() {
    if (!draft.appointmentDate) {
      setError("Kies een datum voor het gesprek.");
      return;
    }
    const patch = { ...draft, appointmentStatus: "scheduled" };
    if (STAGE_INDEX(form.pipelineStage) >= 0 && STAGE_INDEX(form.pipelineStage) < STAGE_INDEX("appointment_scheduled")) {
      patch.pipelineStage = "appointment_scheduled";
    }
    if (!planned || ["schedule_appointment", "conduct_appointment"].includes(form.nextActionType)) {
      patch.nextActionType = "conduct_appointment";
      patch.nextActionDate = draft.appointmentDate;
      patch.nextActionMonthOnly = false;
      if (!form.nextActionAssignedTo) {
        patch.nextActionAssignedTo = draft.appointmentAssignedTo;
        patch.nextActionAssignedToName = draft.appointmentAssignedToName;
      }
    }
    setMany(patch);
    setDraft(null);
  }

  function markDone() {
    // De fase blijft "Gesprek gepland" tot de lead wordt doorgestuurd.
    const patch = { appointmentStatus: "completed" };
    if (form.nextActionType === "conduct_appointment") {
      patch.nextActionType = "follow_up_whatsapp";
      patch.nextActionDate = today;
      patch.nextActionMonthOnly = false;
    }
    setMany(patch);
  }

  const summary = hasRecord
    ? `${formatDate(form.appointmentDate)}${form.appointmentTime ? ` · ${form.appointmentTime}` : ""}${form.appointmentType ? ` · ${labelOf(APPOINTMENT_TYPES, form.appointmentType)}` : ""}`
    : "";

  return (
    <Card
      icon="calendar"
      title="Gesprek"
      right={
        scheduled && !draft ? (
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button type="button" onClick={markDone} style={{ ...btnStyle("success"), minHeight: 30, padding: "4px 12px", fontSize: 12 }}>
              <Icon name="check" size={13} /> Gesprek gehad
            </button>
            <MoreMenu
              items={[
                { label: "Gesprek wijzigen", icon: "edit", onClick: startPlanning },
                { label: "Niet verschenen", icon: "x", onClick: () => setMany({ appointmentStatus: "no_show" }) },
                { label: "Gesprek annuleren", icon: "x", danger: true, onClick: () => window.confirm("Gesprek annuleren?") && setMany({ appointmentStatus: "cancelled" }) },
              ]}
            />
          </span>
        ) : null
      }
    >
      {isNew ? (
        <div style={{ fontSize: 13, color: C.textMuted }}>Plan een gesprek nadat de lead is aangemaakt.</div>
      ) : draft ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <TextField label="Datum *" type="date" value={draft.appointmentDate} onChange={(v) => setDraft({ ...draft, appointmentDate: v })} />
          <div>
            <label style={labelStyle}>Tijd</label>
            <input type="time" value={draft.appointmentTime} onChange={(e) => setDraft({ ...draft, appointmentTime: e.target.value })} style={inputStyle} aria-label="Tijd" />
          </div>
          <SelectField label="Soort gesprek" value={draft.appointmentType} onChange={(v) => setDraft({ ...draft, appointmentType: v })} options={APPOINTMENT_TYPES} allowEmpty={false} />
          <UserSelectField label="Door" value={draft.appointmentAssignedTo} users={users} onChange={(id, name) => setDraft({ ...draft, appointmentAssignedTo: id, appointmentAssignedToName: name })} />
          {(error || errors.appointmentDate) && (
            <div style={{ gridColumn: "1 / -1" }}>
              <Notice tone="error">{error || errors.appointmentDate}</Notice>
            </div>
          )}
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => setDraft(null)} style={btnStyle("neutral")}>
              Annuleren
            </button>
            <button type="button" onClick={savePlan} style={btnStyle("primary", true)}>
              <Icon name="calendar" size={13} /> Gesprek inplannen
            </button>
          </div>
        </div>
      ) : scheduled ? (
        <div>
          <InfoRow label="Gepland">
            <strong style={{ fontWeight: 600 }}>{summary}</strong>
          </InfoRow>
          <InfoRow label="Door" muted={!form.appointmentAssignedToName}>
            {form.appointmentAssignedToName || "Niemand"}
          </InfoRow>
          <InfoRow label="Status">{labelOf(APPOINTMENT_STATUSES, form.appointmentStatus)}</InfoRow>
        </div>
      ) : (
        <div>
          {errors.appointmentDate && (
            <div style={{ marginBottom: 10 }}>
              <Notice tone="error">{errors.appointmentDate}</Notice>
            </div>
          )}
          <EmptyState text="Geen gesprek gepland" actionLabel="Gesprek plannen" onAction={startPlanning} />
          {hasRecord && (
            <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 8 }}>
              Laatste gesprek: {summary} · {labelOf(APPOINTMENT_STATUSES, form.appointmentStatus).toLowerCase()}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function FollowUpTab(props) {
  const { lead, user, users, tasks, isNew } = props;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))", gap: 16, alignItems: "start" }}>
        <NextActionSection {...props} />
        <AppointmentSection {...props} />
      </div>
      <Card icon="check" title={`Taken${lead?.openTaskCount ? ` (${lead.openTaskCount} open)` : ""}`}>
        {isNew ? <div style={{ fontSize: 13, color: C.textMuted }}>Taken voeg je toe nadat de lead is aangemaakt.</div> : <TasksSection lead={lead} user={user} users={users} tasks={tasks} isNew={isNew} />}
      </Card>
    </div>
  );
}
