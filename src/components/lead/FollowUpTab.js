import { useState } from "react";
import {
  NEXT_ACTION_TYPES,
  APPOINTMENT_TYPES,
  APPOINTMENT_STATUSES,
  PIPELINE_STAGES,
  PRIORITIES,
  labelOf,
} from "../../crm/constants";
import { getNextActionInfo } from "../../crm/signals";
import { todayISO, addDaysISO, formatDate, diffInDays } from "../../crm/dates";
import { addTask, setTaskStatus } from "../../crm/services";
import {
  Panel,
  SelectField,
  TextField,
  TextAreaField,
  UserSelectField,
  Badge,
  Notice,
  Empty,
  btnStyle,
  inputStyle,
} from "../ui";

const STAGE_INDEX = (v) => PIPELINE_STAGES.findIndex((s) => s.value === v);

const QUICK_DATES = [
  { label: "Vandaag", days: 0 },
  { label: "Morgen", days: 1 },
  { label: "Over 3 dagen", days: 3 },
  { label: "Over 1 week", days: 7 },
  { label: "Over 2 weken", days: 14 },
];

function TasksSection({ lead, user, users, tasks, isNew }) {
  const [draft, setDraft] = useState({ title: "", dueDate: "", assignedToUserId: user?.id || "", assignedToName: user?.displayName || "", priority: "normal", description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showDone, setShowDone] = useState(false);

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
      <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.status === "open" ? "#0f172a" : "#94a3b8", textDecoration: t.status === "completed" ? "line-through" : "none" }}>{t.title}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {t.dueDate && <span style={{ color: late ? "#ef4444" : "#64748b", fontWeight: late ? 800 : 400 }}>Deadline {formatDate(t.dueDate)}</span>}
            {t.assignedToName && <span>· {t.assignedToName}</span>}
            {t.priority && t.priority !== "normal" && <span>· Prio {labelOf(PRIORITIES, t.priority).toLowerCase()}</span>}
            {t.status !== "open" && <span>· {t.status === "completed" ? "Afgerond" : "Geannuleerd"}</span>}
          </div>
          {t.description && <div style={{ fontSize: 12, color: "#475569", marginTop: 3, whiteSpace: "pre-wrap" }}>{t.description}</div>}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {t.status === "open" ? (
            <>
              <button type="button" onClick={() => changeStatus(t, "completed")} style={btnStyle("#10b981")}>
                Afronden
              </button>
              <button type="button" onClick={() => changeStatus(t, "cancelled")} style={btnStyle("#64748b")}>
                Annuleren
              </button>
            </>
          ) : (
            <button type="button" onClick={() => changeStatus(t, "open")} style={btnStyle("#6366f1")}>
              Heropenen
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {tasks.error && <Notice tone="error">Taken konden niet worden geladen.</Notice>}
      {tasks.loading ? <Empty>Taken laden...</Empty> : open.length ? <div>{open.map(renderTask)}</div> : <Empty>Geen open taken.</Empty>}
      {done.length > 0 && (
        <button type="button" onClick={() => setShowDone((s) => !s)} style={{ ...btnStyle("#64748b"), alignSelf: "flex-start" }}>
          {showDone ? "Verberg" : "Toon"} afgeronde/geannuleerde taken ({done.length})
        </button>
      )}
      {showDone && <div>{done.map(renderTask)}</div>}

      <div style={{ background: "#f8fafc", borderRadius: 12, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <TextField label="Nieuwe taak" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} placeholder="Bijv. 'Financieringsbewijs opvragen'" />
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
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={submit} disabled={busy} style={btnStyle("#6366f1", true)}>
            {busy ? "Toevoegen..." : "+ Taak toevoegen"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FollowUpTab({ form, set, setMany, errors, users, user, lead, isNew, tasks }) {
  const na = getNextActionInfo(form);
  const planned = form.nextActionType && form.nextActionType !== "none";
  const today = todayISO();

  function setActionType(v) {
    if (v === "none") {
      setMany({ nextActionType: "none", nextActionDate: "", nextActionLabel: "" });
      return;
    }
    const patch = { nextActionType: v };
    if (!form.nextActionDate) patch.nextActionDate = today;
    if (!form.nextActionAssignedTo && user) {
      patch.nextActionAssignedTo = user.id;
      patch.nextActionAssignedToName = user.displayName;
    }
    if (v !== "other") patch.nextActionLabel = "";
    setMany(patch);
  }

  function markAppointmentDone() {
    const patch = { appointmentStatus: "completed" };
    if (STAGE_INDEX(form.pipelineStage) >= 0 && STAGE_INDEX(form.pipelineStage) < STAGE_INDEX("appointment_completed")) {
      patch.pipelineStage = "appointment_completed";
    }
    if (form.nextActionType === "conduct_appointment") {
      patch.nextActionType = "complete_search_profile";
      patch.nextActionDate = today;
    }
    setMany(patch);
  }

  function planAppointment() {
    const patch = { appointmentStatus: "scheduled" };
    if (!form.appointmentAssignedTo && user) {
      patch.appointmentAssignedTo = user.id;
      patch.appointmentAssignedToName = user.displayName;
    }
    if (STAGE_INDEX(form.pipelineStage) >= 0 && STAGE_INDEX(form.pipelineStage) < STAGE_INDEX("appointment_scheduled")) {
      patch.pipelineStage = "appointment_scheduled";
    }
    if (form.appointmentDate && (!planned || form.nextActionType === "schedule_appointment")) {
      patch.nextActionType = "conduct_appointment";
      patch.nextActionDate = form.appointmentDate;
    }
    setMany(patch);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
        <Panel title="Volgende actie" right={<Badge color={na.color} bg={na.bg}>{na.label}</Badge>}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <SelectField label="Actie" value={form.nextActionType || "none"} onChange={setActionType} options={NEXT_ACTION_TYPES} allowEmpty={false} />
            </div>
            {form.nextActionType === "other" && (
              <div style={{ gridColumn: "1 / -1" }}>
                <TextField label="Omschrijving actie *" value={form.nextActionLabel} onChange={(v) => set("nextActionLabel", v)} error={errors.nextActionLabel} />
              </div>
            )}
            {planned && (
              <>
                <TextField label="Datum *" type="date" value={form.nextActionDate} onChange={(v) => set("nextActionDate", v)} error={errors.nextActionDate} />
                <UserSelectField
                  label="Uitvoerder"
                  value={form.nextActionAssignedTo}
                  users={users}
                  onChange={(id, name) => setMany({ nextActionAssignedTo: id, nextActionAssignedToName: name })}
                />
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {QUICK_DATES.map((q) => (
                    <button key={q.label} type="button" onClick={() => set("nextActionDate", addDaysISO(today, q.days))} style={btnStyle("#6366f1")}>
                      {q.label}
                    </button>
                  ))}
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <TextAreaField label="Toelichting" value={form.nextActionNotes} onChange={(v) => set("nextActionNotes", v)} rows={2} />
                </div>
              </>
            )}
            {!planned && (
              <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#64748b" }}>
                Geen actie gepland. Voor actieve leads verschijnt dit als signaal onder "Aandacht nodig".
              </div>
            )}
          </div>
        </Panel>

        <Panel
          title="Kennismaking"
          right={form.appointmentStatus ? <Badge>{labelOf(APPOINTMENT_STATUSES, form.appointmentStatus)}</Badge> : null}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <TextField label="Datum" type="date" value={form.appointmentDate} onChange={(v) => set("appointmentDate", v)} error={errors.appointmentDate} />
            <FieldTime value={form.appointmentTime} onChange={(v) => set("appointmentTime", v)} />
            <SelectField label="Soort" value={form.appointmentType} onChange={(v) => set("appointmentType", v)} options={APPOINTMENT_TYPES} />
            <UserSelectField
              label="Door"
              value={form.appointmentAssignedTo}
              users={users}
              onChange={(id, name) => setMany({ appointmentAssignedTo: id, appointmentAssignedToName: name })}
            />
            <div style={{ gridColumn: "1 / -1" }}>
              <SelectField label="Status" value={form.appointmentStatus} onChange={(v) => set("appointmentStatus", v)} options={APPOINTMENT_STATUSES} placeholder="Geen afspraak" />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {form.appointmentStatus !== "scheduled" && form.appointmentStatus !== "completed" && (
                <button type="button" onClick={planAppointment} disabled={!form.appointmentDate} style={{ ...btnStyle("#0891b2"), opacity: form.appointmentDate ? 1 : 0.5 }}>
                  Afspraak inplannen
                </button>
              )}
              {form.appointmentStatus === "scheduled" && (
                <button type="button" onClick={markAppointmentDone} style={btnStyle("#10b981")}>
                  Markeer als gehad
                </button>
              )}
            </div>
            <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#94a3b8" }}>
              Wijzigingen worden opgeslagen met de knop Opslaan. Een afgeronde kennismaking telt als klantcontact.
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Taken">
        <TasksSection lead={lead} user={user} users={users} tasks={tasks} isNew={isNew} />
      </Panel>
    </div>
  );
}

function FieldTime({ value, onChange }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 5, display: "block" }}>Tijd</label>
      <input type="time" value={value || ""} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}
