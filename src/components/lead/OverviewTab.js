import {
  PIPELINE_STAGES,
  PURCHASE_INTENTS,
  PRIORITIES,
  CLOSURE_REASONS,
  STAGES_REQUIRING_CLOSURE_REASON,
  CONTACT_METHODS,
  APPOINTMENT_STATUSES,
  PARTNER_LINK_STATUSES,
  isClosedStage,
  labelOf,
  nextActionText,
} from "../../crm/constants";
import { getNextActionInfo } from "../../crm/signals";
import { formatDate, formatDateTime } from "../../crm/dates";
import { Panel, TextField, SelectField, UserSelectField, TextAreaField, btnStyle, C } from "../ui";

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 13, padding: "9px 0", borderBottom: `1px solid ${C.borderSoft}` }}>
      <span style={{ color: C.textMuted, fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ color: C.text, textAlign: "right" }}>{children}</span>
    </div>
  );
}

export function OverviewTab({ form, set, setMany, errors, users, lead, isNew, stats, onGoTab }) {
  const needsReason = STAGES_REQUIRING_CLOSURE_REASON.includes(form.pipelineStage);
  const showClosure = needsReason || isClosedStage(form.pipelineStage) || form.closureReason;
  const na = getNextActionInfo(form);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
      <Panel title="Contactgegevens">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <TextField label="Naam *" value={form.name} onChange={(v) => set("name", v)} error={errors.name} />
          </div>
          <TextField label="Telefoon" type="tel" value={form.phone} onChange={(v) => set("phone", v)} error={errors.phone} />
          <TextField label="E-mail" type="email" value={form.email} onChange={(v) => set("email", v)} error={errors.email} />
        </div>
        <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 8 }}>Minimaal een e-mailadres of telefoonnummer is verplicht.</div>
      </Panel>

      <Panel title="Status en kwalificatie">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <SelectField label="Pipelinefase" value={form.pipelineStage} onChange={(v) => set("pipelineStage", v)} options={PIPELINE_STAGES} allowEmpty={false} />
          <UserSelectField
            label="Verantwoordelijke"
            value={form.ownerId}
            users={users}
            onChange={(id, name) => setMany({ ownerId: id, ownerName: name })}
          />
          <SelectField label="Koopintentie" value={form.purchaseIntent} onChange={(v) => set("purchaseIntent", v)} options={PURCHASE_INTENTS} allowEmpty={false} />
          <SelectField label="Prioriteit" value={form.priority} onChange={(v) => set("priority", v)} options={PRIORITIES} allowEmpty={false} />
          {showClosure && (
            <>
              <SelectField
                label={needsReason ? "Afsluitreden *" : "Afsluitreden"}
                value={form.closureReason}
                onChange={(v) => set("closureReason", v)}
                options={CLOSURE_REASONS}
                error={errors.closureReason}
              />
              <TextField label="Toelichting afsluiten" value={form.closureNotes} onChange={(v) => set("closureNotes", v)} error={errors.closureNotes} />
            </>
          )}
        </div>
        {form.ownerName && !form.ownerId && (
          <div style={{ fontSize: 11.5, color: C.goldText, marginTop: 8 }}>
            Oude verantwoordelijke "{form.ownerName}" is niet gekoppeld aan een gebruiker. Kies hierboven de juiste persoon.
          </div>
        )}
      </Panel>

      <Panel title="Samenvatting">
        <TextAreaField
          label="Korte interne samenvatting"
          value={form.leadSummary}
          onChange={(v) => set("leadSummary", v)}
          rows={4}
          placeholder="Bijv.: Wil emigreren naar Torrevieja. Nederlandse woning moet nog verkocht worden. Staat open voor een kennismaking."
        />
        <div style={{ marginTop: 12 }}>
          <TextAreaField label="Notities" value={form.notities} onChange={(v) => set("notities", v)} rows={4} hint="Losse gespreksnotities horen bij voorkeur als activiteit in de tijdlijn." />
        </div>
      </Panel>

      {!isNew && (
        <Panel title="Stand van zaken">
          <Row label="Volgende actie">
            <span style={{ color: na.color, fontWeight: 600 }}>
              {nextActionText(form)}
              {form.nextActionDate ? ` · ${formatDate(form.nextActionDate)}` : ""}
            </span>
          </Row>
          <Row label="Laatste contact">
            {lead.lastContactAt ? `${formatDateTime(lead.lastContactAt)}${lead.lastContactMethod ? ` · ${labelOf(CONTACT_METHODS, lead.lastContactMethod)}` : ""}` : "Nog geen contact"}
          </Row>
          <Row label="Laatste activiteit">{lead.lastActivityAt ? formatDateTime(lead.lastActivityAt) : "–"}</Row>
          <Row label="Kennismaking">
            {lead.appointmentDate ? `${formatDate(lead.appointmentDate)} ${lead.appointmentTime || ""} · ${labelOf(APPOINTMENT_STATUSES, lead.appointmentStatus)}` : "–"}
          </Row>
          <Row label="Partners">
            {stats.partnerLinks.length
              ? stats.partnerLinks.map((l) => `${l.partnerName} (${labelOf(PARTNER_LINK_STATUSES, l.status)})`).join(", ")
              : "Nog niet gekoppeld"}
          </Row>
          <Row label="Open taken">{lead.openTaskCount || 0}</Row>
          <Row label="Bestanden">{stats.files}</Row>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button type="button" onClick={() => onGoTab("activities")} style={btnStyle("primary", true)}>
              + Activiteit toevoegen
            </button>
            <button type="button" onClick={() => onGoTab("followup")} style={btnStyle("primary")}>
              Opvolging plannen
            </button>
            <button type="button" onClick={() => onGoTab("partners")} style={btnStyle("primary")}>
              Partner koppelen
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}
