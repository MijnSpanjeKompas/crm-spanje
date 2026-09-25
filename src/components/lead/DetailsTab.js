import { useState } from "react";
import { LEAD_SOURCES, PREFERRED_CONTACT_METHODS, PREFERRED_CONTACT_MOMENTS, TAG_SUGGESTIONS, CONTACT_METHODS, labelOf } from "../../crm/constants";
import { archiveLead, restoreLead, deleteLeadPermanently } from "../../crm/services";
import { formatDateTime, formatDate } from "../../crm/dates";
import { Panel, SelectField, TextField, TagInput, Notice, Badge, btnStyle, Icon } from "../ui";

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, padding: "5px 0", borderBottom: "1px solid #f8fafc" }}>
      <span style={{ color: "#64748b", fontWeight: 700 }}>{label}</span>
      <span style={{ color: "#0f172a", textAlign: "right", wordBreak: "break-word" }}>{children || "–"}</span>
    </div>
  );
}

const UNMAPPED_LABELS = {
  status: "Status",
  leadSource: "Leadbron",
  budget: "Budget",
  gewensteRegio: "Regio",
  woningtype: "Woningtype",
  bouwtype: "Bouwtype",
  slaapkamers: "Slaapkamers",
  doelAankoop: "Doel van aankoop",
  verhuurinteresse: "Verhuur",
  tijdshorizon: "Tijdlijn",
  volgendeActie: "Volgende actie",
  verantwoordelijke: "Verantwoordelijke",
};

export function DetailsTab({ form, set, lead, user, users, isNew, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const legacy = form._legacy;
  const createdBy = users.find((u) => u.id === lead.createdBy)?.displayName || lead.createdByName;
  const updatedBy = users.find((u) => u.id === lead.updatedBy)?.displayName;

  async function run(fn, closeAfter) {
    setBusy(true);
    setError("");
    try {
      await fn();
      if (closeAfter) onClose();
    } catch (e) {
      console.error(e);
      setError(e.code === "permission-denied" ? "Je hebt hier geen rechten voor." : e.message || "Actie mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
        <Panel title="Contactvoorkeur">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <SelectField label="Wil benaderd worden via" value={form.preferredContactMethod} onChange={(v) => set("preferredContactMethod", v)} options={PREFERRED_CONTACT_METHODS} allowEmpty={false} />
            <SelectField label="Voorkeursmoment" value={form.preferredContactMoment} onChange={(v) => set("preferredContactMoment", v)} options={PREFERRED_CONTACT_MOMENTS} allowEmpty={false} />
          </div>
          {!isNew && (
            <div style={{ marginTop: 12 }}>
              <Row label="Laatste contact">
                {form.lastContactAt ? `${formatDateTime(form.lastContactAt)}${form.lastContactMethod ? ` · ${labelOf(CONTACT_METHODS, form.lastContactMethod)}` : ""}` : "Nog geen contact"}
              </Row>
              <Row label="Laatste contactpoging">{form.lastContactAttemptAt ? formatDateTime(form.lastContactAttemptAt) : ""}</Row>
              <Row label="Laatste activiteit">{form.lastActivityAt ? formatDateTime(form.lastActivityAt) : ""}</Row>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>Deze datums worden automatisch bijgewerkt via de activiteiten.</div>
            </div>
          )}
        </Panel>

        <Panel title="Tags">
          <TagInput
            label="Extra labels"
            value={form.tags}
            onChange={(v) => set("tags", v)}
            suggestions={TAG_SUGGESTIONS}
            hint="Alleen aanvullende labels. Aankoopdoel, bouwtype, urgentie enz. staan in de vaste velden."
          />
        </Panel>
      </div>

      <Panel title="Marketing / technische gegevens">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <SelectField label="Leadbron" value={form.leadSource} onChange={(v) => set("leadSource", v)} options={LEAD_SOURCES} allowEmpty={false} />
          <TextField label="UTM source" value={form.utmSource} onChange={(v) => set("utmSource", v)} />
          <TextField label="UTM medium" value={form.utmMedium} onChange={(v) => set("utmMedium", v)} />
          <TextField label="UTM campaign" value={form.utmCampaign} onChange={(v) => set("utmCampaign", v)} />
          <TextField label="UTM content" value={form.utmContent} onChange={(v) => set("utmContent", v)} />
          <TextField label="Landingspagina" value={form.landingPage} onChange={(v) => set("landingPage", v)} />
        </div>
        {!isNew && (
          <div style={{ marginTop: 14 }}>
            <Row label="Aangemaakt">
              {lead.createdAt ? formatDateTime(lead.createdAt) : lead.startdatum ? `${formatDate(lead.startdatum)} (oude startdatum)` : "–"}
              {createdBy ? ` · ${createdBy}` : ""}
            </Row>
            <Row label="Laatst gewijzigd">
              {formatDateTime(lead.updatedAt)}
              {updatedBy ? ` · ${updatedBy}` : ""}
            </Row>
            {lead.closedAt && <Row label="Afgesloten">{formatDateTime(lead.closedAt)}</Row>}
            {lead.archived && <Row label="Gearchiveerd">{`${formatDateTime(lead.archivedAt)}${lead.archivedByName ? ` · ${lead.archivedByName}` : ""}`}</Row>}
            <Row label="Lead-ID">
              <code style={{ fontSize: 11 }}>{lead.id}</code>
            </Row>
          </div>
        )}
      </Panel>

      {legacy && (
        <Panel title="Gegevens uit de oude CRM-versie">
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>Alleen ter controle. Deze waarden blijven bewaard en worden niet meer gebruikt.</div>
          <Row label="Oude status">{legacy.status}</Row>
          <Row label="Oud leadtype">{legacy.leadType}</Row>
          <Row label="Oude leadbron">{legacy.source}</Row>
          <Row label="Oude startdatum">{legacy.startdatum ? formatDate(legacy.startdatum) : ""}</Row>
          {legacy.tags?.length > 0 && (
            <Row label="Omgezette tags">
              <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {legacy.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </span>
            </Row>
          )}
          {Object.entries(legacy.unmapped || {}).map(([k, v]) => (
            <Row key={k} label={`Niet omgezet: ${UNMAPPED_LABELS[k] || k}`}>
              {String(v)}
            </Row>
          ))}
        </Panel>
      )}

      {!isNew && (
        <Panel title="Archief">
          {error && <Notice tone="error">{error}</Notice>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: error ? 10 : 0 }}>
            {lead.archived ? (
              <button type="button" disabled={busy} onClick={() => run(() => restoreLead(lead, user))} style={btnStyle("#10b981")}>
                Terugzetten uit archief
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => window.confirm(`${lead.name || "Deze lead"} archiveren? Je kunt de lead later terugvinden via het filter "Archief".`) && run(() => archiveLead(lead, user), true)}
                style={btnStyle("#f59e0b")}
              >
                <Icon name="archive" size={13} /> Archiveren
              </button>
            )}
            {user?.isAdmin && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const typed = window.prompt(
                    `LET OP: dit verwijdert ${lead.name || "deze lead"} definitief, inclusief activiteiten, taken, partnerkoppelingen en bestanden.\n\nTyp VERWIJDER om te bevestigen.`
                  );
                  if (typed === "VERWIJDER") run(() => deleteLeadPermanently(lead), true);
                }}
                style={btnStyle("#ef4444")}
              >
                <Icon name="trash" size={13} /> Definitief verwijderen (beheerder)
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Archiveren verwijdert niets. Definitief verwijderen kan alleen een beheerder.</div>
        </Panel>
      )}
    </div>
  );
}
