import { useEffect, useMemo, useState } from "react";
import { PIPELINE_STAGES, PURCHASE_INTENTS, PRIORITIES } from "../../crm/constants";
import { emptyLead, findDuplicateLeads } from "../../crm/normalize";
import { validateLead, FIELD_TABS } from "../../crm/validation";
import { getLeadSignals, SEVERITY_STYLE } from "../../crm/signals";
import { createLead, updateLead, setPinned, subscribeLeadSub } from "../../crm/services";
import { Modal, Tabs, Icon, OptionBadge, Badge, Notice, btnStyle } from "../ui";
import { OverviewTab } from "./OverviewTab";
import { ProfileTab } from "./ProfileTab";
import { FollowUpTab } from "./FollowUpTab";
import { ActivitiesTab } from "./ActivitiesTab";
import { PartnersTab } from "./PartnersTab";
import { FilesTab } from "./FilesTab";
import { DetailsTab } from "./DetailsTab";

/** Live subcollection van een lead. */
function useLeadSub(leadId, name) {
  const [state, setState] = useState({ items: [], loading: Boolean(leadId), error: null });
  useEffect(() => {
    if (!leadId) {
      setState({ items: [], loading: false, error: null });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true }));
    return subscribeLeadSub(
      leadId,
      name,
      (items) => setState({ items, loading: false, error: null }),
      (error) => setState({ items: [], loading: false, error })
    );
  }, [leadId, name]);
  return state;
}

function same(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

const FORM_TABS = ["overview", "profile", "followup", "details"];

/**
 * Leaddetail (bestaande lead) of nieuwe lead.
 * Formuliervelden worden pas bij "Opslaan" weggeschreven; activiteiten, taken,
 * partnerkoppelingen en bestanden worden direct opgeslagen.
 */
export function LeadDetailModal({
  lead,
  isNew,
  initialEdits,
  initialTab,
  initialMessage,
  users,
  partners,
  allLeads,
  user,
  onClose,
  onCreated,
  onOpenLead,
  onManagePartners,
}) {
  const [newBase] = useState(() => emptyLead(user));
  const base = isNew ? newBase : lead;
  const [edits, setEdits] = useState(() => initialEdits || {});
  const [tab, setTab] = useState(initialTab || "overview");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(initialMessage || null);
  const [duplicates, setDuplicates] = useState(null);

  const leadId = isNew ? null : lead?.id;
  const activities = useLeadSub(leadId, "activities");
  const partnerLinks = useLeadSub(leadId, "partnerLinks");
  const files = useLeadSub(leadId, "files");
  const tasks = useLeadSub(leadId, "tasks");

  const form = useMemo(() => ({ ...base, ...edits }), [base, edits]);
  const dirty = Object.keys(edits).some((k) => !same(edits[k], base?.[k]));

  const set = (key, value) => {
    setEdits((e) => ({ ...e, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };
  const setMany = (obj) => {
    setEdits((e) => ({ ...e, ...obj }));
    setErrors((er) => {
      const next = { ...er };
      Object.keys(obj).forEach((k) => delete next[k]);
      return next;
    });
  };
  const clearEdits = (keys) =>
    setEdits((e) => {
      const next = { ...e };
      keys.forEach((k) => delete next[k]);
      return next;
    });

  if (!base) {
    return (
      <Modal onClose={onClose}>
        <div style={{ color: "#94a3b8", fontSize: 13 }}>Lead laden...</div>
      </Modal>
    );
  }

  const ctx = { user, users, partners, lead: base, form, set, setMany, errors, isNew, setMessage };

  function requestClose() {
    if (dirty && !window.confirm("Je hebt niet-opgeslagen wijzigingen. Toch sluiten?")) return;
    onClose();
  }

  async function save(forceDuplicate = false) {
    setMessage(null);
    const partnerCount = isNew ? 0 : partnerLinks.items.length || base.partnerSummary?.count || 0;
    const v = validateLead(form, { partnerCount });
    if (!v.valid) {
      setErrors(v.errors);
      const firstKey = Object.keys(v.errors)[0];
      if (FIELD_TABS[firstKey]) setTab(FIELD_TABS[firstKey]);
      setMessage({ tone: "error", text: "Niet opgeslagen: controleer de rood gemarkeerde velden." });
      return;
    }
    if (v.warnings.length && !window.confirm(`${v.warnings.join("\n\n")}\n\nToch opslaan?`)) return;

    if (isNew && !forceDuplicate) {
      const dups = findDuplicateLeads(allLeads, { email: form.email, phone: form.phone });
      if (dups.length) {
        setDuplicates(dups);
        return;
      }
    }

    setSaving(true);
    try {
      if (isNew) {
        const id = await createLead(form, user);
        setEdits({});
        setDuplicates(null);
        onCreated(id);
      } else {
        const res = await updateLead(base, form, user);
        setEdits({});
        setErrors({});
        setMessage({ tone: "ok", text: res.changed ? "Opgeslagen." : "Er waren geen wijzigingen." });
      }
    } catch (e) {
      console.error(e);
      setMessage({ tone: "error", text: `Opslaan mislukt: ${e.message || "onbekende fout"}` });
    } finally {
      setSaving(false);
    }
  }

  async function togglePin() {
    if (isNew) set("pinned", !form.pinned);
    else await setPinned(base, !base.pinned);
  }

  const signals = isNew ? [] : getLeadSignals(base);
  const lockedMsg = "Sla de lead eerst op. Daarna kun je hier activiteiten, partners en bestanden toevoegen.";
  const tabs = [
    { key: "overview", label: "Overzicht", alert: ["name", "email", "phone", "closureReason", "closureNotes"].some((k) => errors[k]) },
    { key: "profile", label: "Zoekprofiel", alert: Boolean(errors.budgetMax) },
    { key: "activities", label: "Activiteiten", count: activities.items.length, disabled: isNew },
    { key: "followup", label: "Opvolging", count: base.openTaskCount || 0, alert: ["nextActionDate", "nextActionLabel", "appointmentDate"].some((k) => errors[k]) },
    { key: "partners", label: "Partners", count: partnerLinks.items.length, disabled: isNew },
    { key: "files", label: "Bestanden", count: files.items.length, disabled: isNew },
    { key: "details", label: "Details" },
  ];

  const showFooter = FORM_TABS.includes(tab) || dirty;

  return (
    <Modal onClose={requestClose}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 18 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <button
              type="button"
              onClick={togglePin}
              title={form.pinned ? "Lead losmaken" : "Lead vastpinnen"}
              style={{ border: "none", background: "transparent", color: form.pinned ? "#f59e0b" : "#cbd5e1", cursor: "pointer", padding: 0, display: "flex" }}
            >
              <Icon name="star" size={20} />
            </button>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{isNew ? "Nieuwe lead toevoegen" : base.name || "Lead"}</div>
          </div>
          {!isNew && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              <OptionBadge options={PIPELINE_STAGES} value={base.pipelineStage} />
              <OptionBadge options={PURCHASE_INTENTS} value={base.purchaseIntent} />
              <OptionBadge options={PRIORITIES} value={base.priority} prefix="Prio: " />
              {base.ownerName && <Badge color="#0f172a" bg="#f1f5f9">{base.ownerName}</Badge>}
              {base.archived && <Badge>Gearchiveerd</Badge>}
            </div>
          )}
        </div>
        <button type="button" onClick={requestClose} aria-label="Sluiten" style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
          <Icon name="x" size={22} />
        </button>
      </div>

      {signals.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {signals.map((s) => (
            <Badge key={s.key} color={SEVERITY_STYLE[s.severity].color} bg={SEVERITY_STYLE[s.severity].bg}>
              {s.label}
            </Badge>
          ))}
        </div>
      )}

      {base._isLegacy && !isNew && (
        <Notice tone="info">
          Deze lead is aangemaakt in de oude CRM-versie. De gegevens zijn automatisch vertaald naar de nieuwe velden. Controleer ze en klik op
          Opslaan om de lead definitief bij te werken. Oude waarden blijven bewaard (zie tabblad Details).
        </Notice>
      )}

      {duplicates && (
        <Notice tone="warn">
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Er bestaat mogelijk al een lead met dit e-mailadres of telefoonnummer.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {duplicates.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <span>
                  <strong>{d.name || "Naam onbekend"}</strong> · {d.email || "–"} · {d.phone || "–"}
                  {d.archived ? " · gearchiveerd" : ""}
                </span>
                <button type="button" onClick={() => onOpenLead(d)} style={btnStyle("#6366f1")}>
                  Bestaande lead openen
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => save(true)} style={btnStyle("#f59e0b", true)}>
              Toch nieuwe lead aanmaken
            </button>
            <button type="button" onClick={() => setDuplicates(null)} style={btnStyle("#64748b")}>
              Terug naar formulier
            </button>
          </div>
        </Notice>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div style={{ minHeight: 280 }}>
        {tab === "overview" && <OverviewTab {...ctx} stats={{ activities: activities.items.length, partnerLinks: partnerLinks.items, files: files.items.length }} onGoTab={setTab} />}
        {tab === "profile" && <ProfileTab {...ctx} />}
        {tab === "followup" && <FollowUpTab {...ctx} tasks={tasks} />}
        {tab === "details" && <DetailsTab {...ctx} onClose={onClose} />}
        {tab === "activities" && (isNew ? <Notice>{lockedMsg}</Notice> : <ActivitiesTab {...ctx} activities={activities} clearEdits={clearEdits} />)}
        {tab === "partners" && (isNew ? <Notice>{lockedMsg}</Notice> : <PartnersTab {...ctx} links={partnerLinks} onManagePartners={onManagePartners} />)}
        {tab === "files" && (isNew ? <Notice>{lockedMsg}</Notice> : <FilesTab {...ctx} files={files} />)}
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {showFooter && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            position: "sticky",
            bottom: -24,
            background: "#fff",
            padding: "12px 0 4px",
            borderTop: "1px solid #f1f5f9",
          }}
        >
          <div style={{ fontSize: 12, color: dirty ? "#f59e0b" : "#94a3b8", fontWeight: 700 }}>
            {dirty ? "Niet-opgeslagen wijzigingen" : isNew ? "" : "Alles opgeslagen"}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" onClick={requestClose} style={{ ...btnStyle("#64748b"), padding: "9px 18px" }}>
              {dirty ? "Annuleren" : "Sluiten"}
            </button>
            <button type="button" onClick={() => save(false)} disabled={saving} style={{ ...btnStyle("#6366f1", true), padding: "10px 22px", fontSize: 13, opacity: saving ? 0.7 : 1 }}>
              <Icon name="save" size={14} /> {saving ? "Opslaan..." : isNew ? "Lead aanmaken" : "Opslaan"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
