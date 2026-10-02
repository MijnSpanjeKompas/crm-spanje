import { useState } from "react";
import {
  PURCHASE_INTENTS,
  PRIORITIES,
  CLOSURE_REASONS,
  STAGES_REQUIRING_CLOSURE_REASON,
  CONTACT_METHODS,
  APPOINTMENT_TYPES,
  PARTNER_LINK_STATUSES,
  PREFERRED_CONTACT_METHODS,
  PREFERRED_CONTACT_MOMENTS,
  LEAD_SOURCES,
  TAG_SUGGESTIONS,
  REGIONS,
  PURCHASE_GOALS,
  PURCHASE_TIMELINES,
  PROPERTY_TYPES,
  BUILD_PREFERENCES,
  VISIT_SPAIN_STATUSES,
  ACTIVITY_TYPES,
  selectableStages,
  isClosedStage,
  labelOf,
  nextActionText,
  hasNextAction,
} from "../../crm/constants";
import { getNextActionInfo } from "../../crm/signals";
import { formatDate, formatDateTime, formatActionDate, toMillis } from "../../crm/dates";
import { moveNotesToTimeline } from "../../crm/services";
import {
  Card,
  InfoRow,
  EditToggle,
  Disclosure,
  ActionLink,
  contactLinks,
  TextField,
  SelectField,
  UserSelectField,
  TextAreaField,
  Badge,
  Icon,
  btnStyle,
  inputStyle,
  formatBudget,
  formatList,
  C,
} from "../ui";

const twoCols = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const full = { gridColumn: "1 / -1" };

/** Contactvoorkeur: vrije tekst uit het formulier heeft voorrang op de vaste keuze. */
export function contactPreferenceText(lead) {
  if (lead.contactPreferenceText) return lead.contactPreferenceText;
  return lead.preferredContactMethod && lead.preferredContactMethod !== "no_preference" ? labelOf(PREFERRED_CONTACT_METHODS, lead.preferredContactMethod) : "";
}

export function contactMomentText(lead) {
  if (lead.contactMomentText) return lead.contactMomentText;
  return lead.preferredContactMoment ? labelOf(PREFERRED_CONTACT_MOMENTS, lead.preferredContactMoment) : "";
}

// ─── CONTACT ─────────────────────────────────────────────────────────────────
export function ContactSection({ form, set, errors, editing }) {
  if (editing) {
    return (
      <div style={twoCols}>
        <div style={full}>
          <TextField label="Naam *" value={form.name} onChange={(v) => set("name", v)} error={errors.name} placeholder="Bijv. Jan de Vries" />
        </div>
        <TextField label="Telefoon" type="tel" value={form.phone} onChange={(v) => set("phone", v)} error={errors.phone} placeholder="+31 6 12345678" />
        <TextField label="E-mail" type="email" value={form.email} onChange={(v) => set("email", v)} error={errors.email} placeholder="naam@voorbeeld.nl" />
        <SelectField
          label="Voorkeur contact"
          value={form.preferredContactMethod}
          onChange={(v) => set("preferredContactMethod", v)}
          options={PREFERRED_CONTACT_METHODS}
          allowEmpty={false}
          hint={form.contactPreferenceText ? `Formulier: "${form.contactPreferenceText}"` : undefined}
        />
        <SelectField
          label="Beste moment"
          value={form.preferredContactMoment}
          onChange={(v) => set("preferredContactMoment", v)}
          options={PREFERRED_CONTACT_MOMENTS}
          allowEmpty={false}
          hint={form.contactMomentText ? `Formulier: "${form.contactMomentText}"` : undefined}
        />
        <div style={{ ...full, fontSize: 11.5, color: C.textSubtle }}>Minimaal een e-mailadres of telefoonnummer is verplicht.</div>
      </div>
    );
  }
  const links = contactLinks(form);
  return (
    <div>
      <InfoRow label="Naam">{form.name || "–"}</InfoRow>
      <InfoRow
        label="Telefoon"
        muted={!form.phone}
        action={
          form.phone ? (
            <>
              {links.tel && <ActionLink compact href={links.tel} icon="phone" label="Bellen" />}
              {links.whatsapp && <ActionLink compact href={links.whatsapp} icon="chat" label="WhatsApp" />}
            </>
          ) : null
        }
      >
        {form.phone || "Geen telefoonnummer"}
      </InfoRow>
      <InfoRow label="E-mail" muted={!form.email} action={links.mail ? <ActionLink compact href={links.mail} icon="mail" label="E-mail sturen" /> : null}>
        {form.email || "Geen e-mailadres"}
      </InfoRow>
      <InfoRow label="Voorkeur contact" muted={!contactPreferenceText(form)}>
        {contactPreferenceText(form) || "Geen voorkeur"}
      </InfoRow>
      <InfoRow label="Beste moment" muted={!contactMomentText(form)}>
        {contactMomentText(form) || "Onbekend"}
      </InfoRow>
    </div>
  );
}

// ─── STATUS & KWALIFICATIE ───────────────────────────────────────────────────
export function StatusSection({ form, set, setMany, errors, users, lead }) {
  const needsReason = STAGES_REQUIRING_CLOSURE_REASON.includes(form.pipelineStage);
  const showClosure = form.pipelineStage !== "completed" && (needsReason || isClosedStage(form.pipelineStage) || form.closureReason);
  return (
    <div style={twoCols}>
      <SelectField
        label="Pipelinefase"
        value={form.pipelineStage}
        onChange={(v) => set("pipelineStage", v)}
        options={selectableStages(lead?.pipelineStage || form.pipelineStage)}
        allowEmpty={false}
      />
      <UserSelectField label="Verantwoordelijke" value={form.ownerId} users={users} onChange={(id, name) => setMany({ ownerId: id, ownerName: name })} />
      <SelectField label="Prioriteit" value={form.priority} onChange={(v) => set("priority", v)} options={PRIORITIES} allowEmpty={false} />
      <SelectField label="Koopintentie" value={form.purchaseIntent} onChange={(v) => set("purchaseIntent", v)} options={PURCHASE_INTENTS} allowEmpty={false} />
      {showClosure && (
        <>
          <SelectField label={needsReason ? "Afsluitreden *" : "Afsluitreden"} value={form.closureReason} onChange={(v) => set("closureReason", v)} options={CLOSURE_REASONS} error={errors.closureReason} />
          <TextField label="Toelichting" value={form.closureNotes} onChange={(v) => set("closureNotes", v)} error={errors.closureNotes} />
        </>
      )}
      {form.ownerName && !form.ownerId && (
        <div style={{ ...full, fontSize: 11.5, color: C.goldText }}>Oude verantwoordelijke "{form.ownerName}" is niet gekoppeld aan een gebruiker. Kies de juiste persoon.</div>
      )}
    </div>
  );
}

// ─── SAMENVATTING ────────────────────────────────────────────────────────────
function SummarySection({ form, set, lead, user, isNew, setMessage }) {
  const [busy, setBusy] = useState(false);
  const oldNotes = String(lead?.notities || "").trim();
  return (
    <div>
      <TextAreaField
        value={form.leadSummary}
        onChange={(v) => set("leadSummary", v)}
        rows={4}
        placeholder="Bijv. Wil samen met partner permanent naar Spanje verhuizen. Nederlandse woning moet eerst verkocht worden. Verwacht in november naar Spanje te komen."
        hint="De blijvende, actuele samenvatting. Losse opmerkingen horen als notitie in de Tijdlijn."
      />
      {oldNotes && !isNew && (
        <div style={{ marginTop: 12, background: C.surfaceSoft, border: `1px dashed ${C.borderStrong}`, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>Notities uit de vorige versie</div>
          <div style={{ fontSize: 13, color: C.textBody, whiteSpace: "pre-wrap", maxHeight: 140, overflow: "auto" }}>{oldNotes}</div>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await moveNotesToTimeline(lead, user);
                setMessage?.({ tone: "ok", text: "Notities staan nu als interne notitie in de Tijdlijn." });
              } catch (e) {
                setMessage?.({ tone: "error", text: `Verplaatsen mislukt: ${e.message || "onbekende fout"}` });
              } finally {
                setBusy(false);
              }
            }}
            style={{ ...btnStyle("primary"), marginTop: 8 }}
          >
            <Icon name="arrowRight" size={13} /> Naar Tijdlijn verplaatsen
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ACTUELE STAND VAN ZAKEN (afgeleid, niet bewerkbaar) ────────────────────
function latestActivity(items) {
  return [...(items || [])].sort((a, b) => (toMillis(b.occurredAt || b.createdAt) || 0) - (toMillis(a.occurredAt || a.createdAt) || 0))[0] || null;
}

function StandSection({ lead, stats, onGoTab }) {
  const na = getNextActionInfo(lead);
  const planned = hasNextAction(lead);
  const appt = lead.appointmentStatus === "scheduled" && lead.appointmentDate;
  const links = stats.partnerLinks || [];
  const last = latestActivity(stats.activities);
  return (
    <div>
      <InfoRow label="Volgende actie" icon="bell" onClick={() => onGoTab("followup")} muted={!planned}>
        {planned ? (
          <>
            <span style={{ fontWeight: 600 }}>{nextActionText(lead)}</span>
            <span style={{ display: "block", fontSize: 12.5, color: ["overdue", "nodate"].includes(na.state) ? na.color : C.textMuted }}>
              {lead.nextActionDate ? formatActionDate(lead.nextActionDate, lead.nextActionMonthOnly) : "Datum ontbreekt"}
              {["overdue", "today"].includes(na.state) ? ` · ${na.label.toLowerCase()}` : ""}
              {lead.nextActionAssignedToName ? ` · ${lead.nextActionAssignedToName}` : ""}
            </span>
          </>
        ) : (
          "Geen actie gepland"
        )}
      </InfoRow>
      <InfoRow label="Volgend gesprek" icon="calendar" onClick={() => onGoTab("followup")} muted={!appt}>
        {appt ? `${formatDate(lead.appointmentDate)}${lead.appointmentTime ? ` · ${lead.appointmentTime}` : ""}${lead.appointmentType ? ` · ${labelOf(APPOINTMENT_TYPES, lead.appointmentType)}` : ""}` : "Geen gesprek gepland"}
      </InfoRow>
      <InfoRow label="Partner" icon="users" onClick={() => onGoTab("partners")} muted={!links.length}>
        {links.length
          ? links.map((l) => (
              <span key={l.id} style={{ display: "block" }}>
                {l.partnerName} <span style={{ color: C.textMuted }}>· {labelOf(PARTNER_LINK_STATUSES, l.status)}</span>
              </span>
            ))
          : "Nog geen partner"}
      </InfoRow>
      <InfoRow label="Open taken" icon="check" onClick={() => onGoTab("followup")} muted={!lead.openTaskCount}>
        {lead.openTaskCount || 0}
        {lead.nextTaskTitle && lead.openTaskCount ? <span style={{ color: C.textMuted }}> · {lead.nextTaskTitle}</span> : null}
      </InfoRow>
      <InfoRow label="Laatste contact" icon="phone" muted={!lead.lastContactAt}>
        {lead.lastContactAt ? `${formatDate(lead.lastContactAt)}${lead.lastContactMethod ? ` · ${labelOf(CONTACT_METHODS, lead.lastContactMethod)}` : ""}` : "Nog geen contact"}
      </InfoRow>
      <InfoRow label="Laatste activiteit" icon="clock" onClick={() => onGoTab("timeline")} muted={!last}>
        {last ? `${formatDate(last.occurredAt || last.createdAt)} · ${last.title || labelOf(ACTIVITY_TYPES, last.type)}` : "Nog niets gebeurd"}
      </InfoRow>
    </div>
  );
}

// ─── BRON & TOESTEMMING ──────────────────────────────────────────────────────
const CONSENT_OPTIONS = [
  { value: "yes", label: "Ja" },
  { value: "no", label: "Nee" },
];

function consentLabel(v) {
  if (v === true) return "Ja";
  if (v === false) return "Nee";
  return "Onbekend";
}

const UTM_FIELDS = [
  ["utmSource", "UTM source"],
  ["utmMedium", "UTM medium"],
  ["utmCampaign", "UTM campaign"],
  ["utmContent", "UTM content"],
  ["landingPage", "Landingspagina"],
];

export function SourceSection({ form, set, lead, editing }) {
  if (editing) {
    return (
      <div style={twoCols}>
        <SelectField label="Binnengekomen via" value={form.leadSource} onChange={(v) => set("leadSource", v)} options={LEAD_SOURCES} allowEmpty={false} />
        <SelectField
          label="Toestemming voor contact"
          value={form.consentContact === true ? "yes" : form.consentContact === false ? "no" : ""}
          onChange={(v) => set("consentContact", v === "yes" ? true : v === "no" ? false : null)}
          options={CONSENT_OPTIONS}
          placeholder="Onbekend"
        />
        <div style={full}>
          <TextField label="Formulier" value={form.formSource} onChange={(v) => set("formSource", v)} placeholder="Bijv. Gratis zoekprofiel" />
        </div>
        <div style={full}>
          <Disclosure summary="Meer brongegevens (UTM)">
            <div style={twoCols}>
              {UTM_FIELDS.map(([key, label]) => (
                <TextField key={key} label={label} value={form[key]} onChange={(v) => set(key, v)} />
              ))}
            </div>
          </Disclosure>
        </div>
      </div>
    );
  }
  const submitted = lead?.sourceSubmittedAt || lead?.createdAt;
  const utm = UTM_FIELDS.filter(([key]) => form[key]);
  const sync = lead?.syncInfo || {};
  return (
    <div>
      <InfoRow label="Binnengekomen via">{labelOf(LEAD_SOURCES, form.leadSource)}</InfoRow>
      <InfoRow label="Binnengekomen op" muted={!submitted}>
        {submitted ? formatDateTime(submitted) : "Onbekend"}
      </InfoRow>
      {form.formSource && <InfoRow label="Formulier">{form.formSource}</InfoRow>}
      <InfoRow label="Contact toegestaan" muted={form.consentContact === null || form.consentContact === undefined}>
        {form.consentContact === true && (
          <span style={{ color: C.success, display: "inline-flex", gap: 5, alignItems: "center", fontWeight: 600 }}>
            <Icon name="checkCircle" size={14} /> Ja
          </span>
        )}
        {form.consentContact !== true && consentLabel(form.consentContact)}
      </InfoRow>
      {(utm.length > 0 || lead?.sourceSubmissionId) && (
        <Disclosure summary="Meer brongegevens">
          {utm.map(([key, label]) => (
            <InfoRow key={key} label={label}>
              {form[key]}
            </InfoRow>
          ))}
          {lead?.sourceSubmissionId && <InfoRow label="Submission ID">{lead.sourceSubmissionId}</InfoRow>}
        </Disclosure>
      )}
      {sync.growthSyncError && (
        <div style={{ marginTop: 10 }}>
          <Badge color="#b3453a" bg="#fbedeb" icon="alertCircle">
            Synchronisatiefout
          </Badge>
          <Disclosure summary="Technische details">
            <InfoRow label="Sync-status">{sync.growthSyncStatus || "–"}</InfoRow>
            {sync.growthSyncedAt && <InfoRow label="Laatste sync">{formatDateTime(sync.growthSyncedAt)}</InfoRow>}
            <InfoRow label="Foutmelding">{sync.growthSyncError}</InfoRow>
            {sync.mailStatus && <InfoRow label="Mailstatus">{sync.mailStatus}</InfoRow>}
          </Disclosure>
        </div>
      )}
    </div>
  );
}

// ─── LABELS ──────────────────────────────────────────────────────────────────
function LabelsSection({ form, set }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const tags = form.tags || [];
  const add = (raw) => {
    const v = String(raw || "").trim();
    if (v && !tags.some((t) => t.toLowerCase() === v.toLowerCase())) set("tags", [...tags, v]);
    setText("");
  };
  const suggestions = TAG_SUGGESTIONS.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()));
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {tags.map((t) => (
          <span
            key={t}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.surfaceSoft, border: `1px solid ${C.border}`, color: C.textBody, borderRadius: 999, padding: "3px 6px 3px 10px", fontSize: 12.5 }}
          >
            {t}
            <button
              type="button"
              aria-label={`Label ${t} verwijderen`}
              onClick={() => set("tags", tags.filter((x) => x !== t))}
              style={{ border: "none", background: "none", color: C.textSubtle, cursor: "pointer", display: "flex", padding: 2, borderRadius: 99 }}
            >
              <Icon name="x" size={12} />
            </button>
          </span>
        ))}
        {!tags.length && !adding && <span style={{ fontSize: 13, color: C.textSubtle }}>Geen labels</span>}
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} style={{ ...btnStyle("neutral"), minHeight: 28, padding: "3px 10px", fontSize: 12, borderRadius: 999 }}>
            <Icon name="plus" size={12} /> Label
          </button>
        )}
      </div>
      {adding && (
        <div style={{ marginTop: 10 }}>
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(text);
              }
              if (e.key === "Escape") setAdding(false);
            }}
            onBlur={() => {
              add(text);
              setAdding(false);
            }}
            placeholder="Typ een label en druk op Enter"
            aria-label="Nieuw label"
            style={inputStyle}
          />
          {suggestions.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(s)}
                  style={{ ...btnStyle("neutral"), minHeight: 26, padding: "2px 9px", fontSize: 11.5, borderRadius: 999, borderStyle: "dashed", color: C.textMuted }}
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 8 }}>Alleen voor extra kenmerken. Doel, regio, bouwtype enz. staan in het zoekprofiel.</div>
    </div>
  );
}

// ─── ZOEKPROFIEL IN HET KORT ─────────────────────────────────────────────────
export function visitSpainText(lead) {
  const status = lead.visitSpainStatus;
  if (status === "date_known" && lead.visitSpainDate) return formatDate(lead.visitSpainDate);
  if (status) return labelOf(VISIT_SPAIN_STATUSES, status);
  return lead.visitSpainNotes || "";
}

function ProfileSummary({ lead, onGoTab }) {
  const where = [...(lead.regions || []).filter((r) => r !== "unknown").map((r) => labelOf(REGIONS, r)), ...(lead.places || [])];
  const cells = [
    ["Aankoopdoel", lead.purchaseGoal ? labelOf(PURCHASE_GOALS, lead.purchaseGoal) : ""],
    ["Aankooptermijn", lead.purchaseTimeline ? labelOf(PURCHASE_TIMELINES, lead.purchaseTimeline) : ""],
    ["Budget", formatBudget(lead)],
    ["Regio", where.join(", ")],
    ["Woningtype", formatList(PROPERTY_TYPES, lead.propertyTypes)],
    ["Bouwtype", lead.buildPreference ? labelOf(BUILD_PREFERENCES, lead.buildPreference) : ""],
    ["Slaapkamers", lead.bedroomsMin ? `Minimaal ${lead.bedroomsMin}` : ""],
    ["Bezoek Spanje", visitSpainText(lead)],
  ];
  return (
    <Card
      icon="home"
      title="Zoekprofiel in het kort"
      right={
        <button type="button" onClick={() => onGoTab("profile")} style={{ ...btnStyle("neutral"), minHeight: 30, padding: "4px 10px", fontSize: 12 }}>
          Naar zoekprofiel <Icon name="arrowRight" size={13} />
        </button>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px 16px" }}>
        {cells.map(([label, value]) => (
          <div key={label} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11.5, color: C.textSubtle }}>{label}</div>
            <div style={{ fontSize: 13.5, color: value ? C.text : C.textDisabled, fontWeight: value ? 500 : 400, marginTop: 2 }}>{value || "–"}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── TAB ─────────────────────────────────────────────────────────────────────
export function OverviewTab(props) {
  const { form, lead, stats, onGoTab } = props;
  const [editContact, setEditContact] = useState(false);
  const [editSource, setEditSource] = useState(false);
  const contactError = Boolean(props.errors.name || props.errors.email || props.errors.phone);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <Card icon="user" title="Contact" right={<EditToggle editing={editContact || contactError} onToggle={() => setEditContact((v) => !v)} />}>
            <ContactSection {...props} editing={editContact || contactError} />
          </Card>
          <Card icon="edit" title="Interne samenvatting">
            <SummarySection {...props} />
          </Card>
          <Card icon="clock" title="Actuele stand van zaken">
            <StandSection lead={form} stats={stats} onGoTab={onGoTab} />
          </Card>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <Card icon="chart" title="Status & kwalificatie">
            <StatusSection {...props} />
          </Card>
          <Card icon="tag" title="Labels">
            <LabelsSection {...props} />
          </Card>
          <Card icon="map" title="Bron & toestemming" right={<EditToggle editing={editSource} onToggle={() => setEditSource((v) => !v)} />}>
            <SourceSection {...props} editing={editSource} lead={lead} />
          </Card>
        </div>
      </div>
      <ProfileSummary lead={form} onGoTab={onGoTab} />
    </div>
  );
}
