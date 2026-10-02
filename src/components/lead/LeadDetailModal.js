import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PIPELINE_STAGES, PRIORITIES, REGIONS, PURCHASE_TIMELINES, isSold, labelOf } from "../../crm/constants";
import { formatDate } from "../../crm/dates";
import { emptyLead, findDuplicateLeads } from "../../crm/normalize";
import { validateLead, FIELD_TABS } from "../../crm/validation";
import { getLeadSignals, SEVERITY_STYLE } from "../../crm/signals";
import { createLead, updateLead, setPinned, subscribeLeadSub, archiveLead, restoreLead, deleteLeadPermanently, dismissPossibleDuplicate } from "../../crm/services";
import {
  Modal,
  Tabs,
  Icon,
  OptionBadge,
  Badge,
  Notice,
  Card,
  MoreMenu,
  ActionLink,
  contactLinks,
  TextAreaField,
  btnStyle,
  linkBtnStyle,
  formatEuro,
  formatBudget,
  C,
  CloseButton,
  MODAL_PAD_X,
  MODAL_PAD_Y,
} from "../ui";
import { OverviewTab, ContactSection, StatusSection, SourceSection } from "./OverviewTab";
import { ProfileTab } from "./ProfileTab";
import { FollowUpTab } from "./FollowUpTab";
import { TimelineTab } from "./TimelineTab";
import { PartnersTab } from "./PartnersTab";
import { FilesTab } from "./FilesTab";

/** Wachttijd na de laatste toetsaanslag voordat een tekstveld wordt opgeslagen. */
export const AUTOSAVE_DELAY_MS = 900;

/**
 * Velden die je typt: debounced opslaan. Alle andere (dropdowns, chips,
 * datums, toggles) worden direct opgeslagen.
 */
const TYPED_FIELDS = new Set([
  "name",
  "phone",
  "email",
  "leadSummary",
  "notities",
  "closureNotes",
  "nextActionLabel",
  "nextActionNotes",
  "visitSpainNotes",
  "extraRequirements",
  "formSource",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "landingPage",
  "budgetMin",
  "budgetMax",
  "availableEquity",
  "bedroomsMin",
  "bathroomsMin",
]);

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

function dirtyKeys(edits, base) {
  return Object.keys(edits).filter((k) => !same(edits[k], base?.[k]));
}

const TAB_LABEL = { overview: "Overzicht", profile: "Zoekprofiel", followup: "Opvolging", timeline: "Tijdlijn" };

// ─── HEADER ──────────────────────────────────────────────────────────────────
function HeaderChips({ lead }) {
  const where = [...(lead.regions || []).filter((r) => r !== "unknown").map((r) => labelOf(REGIONS, r)), ...(lead.places || [])];
  const chips = [
    where.length ? ["map", where.slice(0, 2).join(", ") + (where.length > 2 ? ` +${where.length - 2}` : "")] : null,
    formatBudget(lead) ? ["chart", formatBudget(lead)] : null,
    lead.purchaseTimeline && lead.purchaseTimeline !== "unknown" ? ["clock", labelOf(PURCHASE_TIMELINES, lead.purchaseTimeline)] : null,
  ].filter(Boolean);
  return chips.map(([icon, text]) => (
    <span key={icon} style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 12.5, color: C.textBody }}>
      <span style={{ color: C.textSubtle, display: "flex" }}>
        <Icon name={icon} size={13} />
      </span>
      {text}
    </span>
  ));
}

function SaveStatus({ state, onRetry, onGoTab }) {
  if (state.status === "saving" || state.status === "pending") {
    return <span style={{ color: C.textMuted }}>Opslaan…</span>;
  }
  if (state.status === "error") {
    return (
      <span style={{ color: C.danger, display: "inline-flex", gap: 8, alignItems: "center" }}>
        <Icon name="alertCircle" size={14} /> Opslaan mislukt
        <button type="button" onClick={onRetry} className="msk-link" style={{ ...linkBtnStyle, color: C.danger }}>
          opnieuw proberen
        </button>
      </span>
    );
  }
  if (state.status === "invalid") {
    return (
      <span style={{ color: C.goldText, display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Icon name="alertCircle" size={14} /> Nog niet opgeslagen: {state.text}
        {state.tab && (
          <button type="button" onClick={() => onGoTab(state.tab)} className="msk-link" style={linkBtnStyle}>
            naar {TAB_LABEL[state.tab] || state.tab}
          </button>
        )}
      </span>
    );
  }
  if (state.status === "saved") {
    return (
      <span style={{ color: C.success, display: "inline-flex", gap: 6, alignItems: "center" }}>
        <Icon name="checkCircle" size={14} /> Opgeslagen
      </span>
    );
  }
  return (
    <span style={{ color: C.textSubtle, display: "inline-flex", gap: 6, alignItems: "center" }}>
      <Icon name="checkCircle" size={14} /> Wijzigingen worden automatisch opgeslagen
    </span>
  );
}

// ─── NIEUWE LEAD ─────────────────────────────────────────────────────────────
function Step({ n, title, children }) {
  return (
    <Card
      title={
        <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
          <span style={{ width: 24, height: 24, borderRadius: 99, background: C.gold, color: C.navyDark, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
          {title}
        </span>
      }
    >
      {children}
    </Card>
  );
}

function NewLeadForm(props) {
  const { form, set } = props;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Step n={1} title="Contactgegevens">
        <ContactSection {...props} editing />
      </Step>
      <Step n={2} title="Status & kwalificatie">
        <StatusSection {...props} />
      </Step>
      <Step n={3} title="Interne samenvatting">
        <TextAreaField
          value={form.leadSummary}
          onChange={(v) => set("leadSummary", v)}
          rows={3}
          placeholder="Bijv. Wil samen met partner verhuizen naar Spanje. Budget rond de € 300.000. Zoekt rustige omgeving en staat open voor advies over regio's."
        />
      </Step>
      <Step n={4} title="Zoekprofiel">
        <ProfileTab {...props} compact />
      </Step>
      <Step n={5} title="Herkomst en toestemming">
        <SourceSection {...props} editing />
      </Step>
    </div>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
/**
 * Leaddossier (bestaande lead) of nieuwe lead.
 * Bestaande lead: elk veld wordt automatisch opgeslagen (dropdowns direct,
 * tekstvelden na een korte pauze). Nieuwe lead: één formulier + "Lead aanmaken".
 * Activiteiten, taken, partnerkoppelingen en bestanden slaan zichzelf op.
 */
export function LeadDetailModal({ lead, isNew, initialEdits, initialTab, initialMessage, users, partners, allLeads, user, onClose, onCreated, onOpenLead, onSold }) {
  const [newBase] = useState(() => emptyLead(user));
  const base = isNew ? newBase : lead;
  const [edits, setEdits] = useState(() => initialEdits || {});
  const [tab, setTab] = useState(() => (initialTab === "activities" ? "timeline" : initialTab === "details" ? "overview" : initialTab || "overview"));
  const [errors, setErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState(initialMessage || null);
  const [duplicates, setDuplicates] = useState(null);
  const [saveState, setSaveState] = useState({ status: "idle" });

  const leadId = isNew ? null : lead?.id;
  const activities = useLeadSub(leadId, "activities");
  const partnerLinks = useLeadSub(leadId, "partnerLinks");
  const files = useLeadSub(leadId, "files");
  const tasks = useLeadSub(leadId, "tasks");

  const form = useMemo(() => ({ ...base, ...edits }), [base, edits]);
  const dirty = dirtyKeys(edits, base).length > 0;

  // ─── AUTOSAVE ──────────────────────────────────────────────────────────────
  const editsRef = useRef(edits);
  const baseRef = useRef(base);
  const partnerCountRef = useRef(0);
  editsRef.current = edits;
  baseRef.current = base;
  partnerCountRef.current = partnerLinks.items.length || base?.partnerSummary?.count || 0;
  const timerRef = useRef(null);
  const inFlightRef = useRef(null);
  const immediateRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
    },
    []
  );

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    if (isNew) return true;
    if (inFlightRef.current) await inFlightRef.current;
    const current = baseRef.current;
    if (!current) return true;
    const snapshot = editsRef.current;
    const keys = dirtyKeys(snapshot, current);
    if (!keys.length) {
      if (Object.keys(snapshot).length) setEdits({});
      return true;
    }
    const after = { ...current, ...snapshot };
    const v = validateLead(after, { partnerCount: partnerCountRef.current, previousStage: current.pipelineStage });
    if (!v.valid) {
      setErrors(v.errors);
      const firstKey = Object.keys(v.errors)[0];
      setSaveState({ status: "invalid", text: v.errors[firstKey], tab: FIELD_TABS[firstKey] });
      return false;
    }
    setErrors({});
    setSaveState({ status: "saving" });
    const p = updateLead(current, after, user)
      .then(() => {
        if (!mountedRef.current) return true;
        // Alleen velden wissen die sindsdien niet opnieuw zijn gewijzigd.
        setEdits((e) => {
          const next = { ...e };
          keys.forEach((k) => same(next[k], snapshot[k]) && delete next[k]);
          return next;
        });
        setSaveState({ status: "saved" });
        return true;
      })
      .catch((e) => {
        console.error(e);
        if (mountedRef.current) setSaveState({ status: "error", text: e?.message || "onbekende fout" });
        return false;
      })
      .finally(() => {
        inFlightRef.current = null;
      });
    inFlightRef.current = p;
    return p;
  }, [isNew, user]);

  // Na elke wijziging opnieuw plannen; typen wacht even, kiezen gaat direct.
  useEffect(() => {
    if (isNew || !base) return undefined;
    if (!dirtyKeys(edits, base).length) return undefined;
    setSaveState((s) => (s.status === "invalid" ? s : { status: "pending" }));
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, immediateRef.current ? 0 : AUTOSAVE_DELAY_MS);
    return undefined;
  }, [edits, base, isNew, flush]);

  // Na "Aankoop afgerond vastleggen" (eigen dialoog) mogen oude formulierwijzigingen
  // aan fase en volgende actie de nieuwe waarden niet overschrijven.
  const baseStage = base?.pipelineStage;
  useEffect(() => {
    if (isNew || baseStage !== "completed") return;
    setEdits((e) => {
      const keys = ["pipelineStage", "nextActionType", "nextActionDate", "nextActionMonthOnly", "nextActionLabel", "saleDate", "salePrice", "saleProperty", "saleCommission", "saleNotes"];
      if (!keys.some((k) => k in e)) return e;
      const next = { ...e };
      keys.forEach((k) => delete next[k]);
      return next;
    });
  }, [baseStage, isNew]);

  const set = useCallback((key, value) => {
    immediateRef.current = !TYPED_FIELDS.has(key);
    setEdits((e) => ({ ...e, [key]: value }));
    setErrors((er) => (er[key] ? { ...er, [key]: undefined } : er));
  }, []);
  const setMany = useCallback((obj) => {
    immediateRef.current = Object.keys(obj).some((k) => !TYPED_FIELDS.has(k));
    setEdits((e) => ({ ...e, ...obj }));
    setErrors((er) => {
      const next = { ...er };
      Object.keys(obj).forEach((k) => delete next[k]);
      return next;
    });
  }, []);
  const clearEdits = useCallback(
    (keys) =>
      setEdits((e) => {
        const next = { ...e };
        keys.forEach((k) => delete next[k]);
        return next;
      }),
    []
  );

  if (!base) {
    return (
      <Modal onClose={onClose}>
        <div style={{ color: C.textMuted, fontSize: 13 }}>Lead laden...</div>
      </Modal>
    );
  }

  const ctx = { user, users, partners, lead: base, form, set, setMany, errors, isNew, setMessage };

  async function requestClose() {
    if (isNew) {
      if (dirty && !window.confirm("De nieuwe lead is nog niet aangemaakt. Toch sluiten?")) return;
      onClose();
      return;
    }
    const ok = await flush();
    if (!ok && dirtyKeys(editsRef.current, baseRef.current).length) {
      if (!window.confirm("Sommige wijzigingen konden niet worden opgeslagen. Toch sluiten? Die wijzigingen gaan dan verloren.")) return;
    }
    onClose();
  }

  async function create(forceDuplicate = false) {
    setMessage(null);
    const v = validateLead(form, { partnerCount: 0, isCreate: true });
    if (!v.valid) {
      setErrors(v.errors);
      setMessage({ tone: "error", text: `Nog niet aangemaakt: ${Object.values(v.errors)[0]}` });
      return;
    }
    if (!forceDuplicate) {
      const dups = findDuplicateLeads(allLeads, { email: form.email, phone: form.phone });
      if (dups.length) {
        setDuplicates(dups);
        return;
      }
    }
    setCreating(true);
    try {
      const id = await createLead(form, user);
      setEdits({});
      setDuplicates(null);
      onCreated(id);
    } catch (e) {
      console.error(e);
      setMessage({ tone: "error", text: `Aanmaken mislukt: ${e.message || "onbekende fout"}` });
      setCreating(false);
    }
  }

  async function runAndClose(fn, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await flush();
      await fn();
      onClose();
    } catch (e) {
      console.error(e);
      setMessage({ tone: "error", text: e.code === "permission-denied" ? "Je hebt hier geen rechten voor." : e.message || "Actie mislukt." });
    }
  }

  async function togglePin() {
    if (isNew) set("pinned", !form.pinned);
    else await setPinned(base, !base.pinned);
  }

  const signals = isNew ? [] : getLeadSignals(base);
  const sold = !isNew && isSold(base);
  const links = contactLinks(form);
  const dupIds = (base.possibleDuplicateOf || []).filter((id) => id !== base.id);
  const dupLeads = dupIds.map((id) => allLeads.find((l) => l.id === id)).filter(Boolean);
  const tabs = [
    { key: "overview", label: "Overzicht", alert: ["name", "email", "phone", "closureReason", "closureNotes", "forwarding", "consentStatus", "leadSource"].some((k) => errors[k]) },
    { key: "profile", label: "Zoekprofiel", alert: Boolean(errors.budgetMax) },
    { key: "followup", label: "Opvolging", count: base.openTaskCount || 0, alert: ["nextActionDate", "nextActionLabel", "appointmentDate"].some((k) => errors[k]) },
    { key: "timeline", label: "Tijdlijn", count: activities.items.filter((a) => a.type !== "system").length },
    { key: "partners", label: "Partners", count: partnerLinks.items.length },
    { key: "files", label: "Bestanden", count: files.items.length + (base.searchProfilePdf?.url ? 1 : 0) },
  ];

  return (
    <Modal onClose={requestClose} maxWidth={1120}>
      {/* VASTE HEADER + TABS */}
      <div
        className="msk-sticky-head"
        style={{
          background: C.surface,
          margin: `-${MODAL_PAD_Y}px -${MODAL_PAD_X}px 0`,
          padding: `${MODAL_PAD_Y - 4}px ${MODAL_PAD_X}px 0`,
          borderRadius: "20px 20px 0 0",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: "1 1 320px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                onClick={togglePin}
                title={form.pinned ? "Favoriet: losmaken" : "Als favoriet vastpinnen"}
                aria-label={form.pinned ? "Lead losmaken" : "Lead vastpinnen"}
                aria-pressed={Boolean(form.pinned)}
                style={{ border: "none", background: "transparent", color: form.pinned ? C.gold : "#cfc8bb", cursor: "pointer", padding: 2, display: "flex", borderRadius: 6 }}
              >
                <Icon name="star" size={20} />
              </button>
              <h2 style={{ fontFamily: C.fontDisplay, fontSize: 26, fontWeight: 600, color: C.navy, lineHeight: 1.15, letterSpacing: "-0.01em", minWidth: 0, overflowWrap: "anywhere", margin: 0 }}>
                {isNew ? "Nieuwe lead toevoegen" : base.name || "Lead"}
              </h2>
            </div>
            {isNew ? (
              <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Voeg een nieuwe lead handmatig toe aan het CRM.</div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                <OptionBadge options={PIPELINE_STAGES} value={base.pipelineStage} />
                <OptionBadge options={PRIORITIES} value={base.priority} prefix="Prio: " />
                {base.ownerName && (
                  <Badge color="#334a5e" bg="#ffffff" icon="user">
                    {base.ownerName}
                  </Badge>
                )}
                {base.archived && <Badge icon="archive">Gearchiveerd</Badge>}
                <span style={{ width: 1, height: 16, background: C.border, margin: "0 2px" }} aria-hidden="true" />
                <HeaderChips lead={base} />
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {!isNew && (
              <>
                {links.tel && <ActionLink href={links.tel} icon="phone" label="Bellen" />}
                {links.whatsapp && <ActionLink href={links.whatsapp} icon="chat" label="WhatsApp" />}
                {links.mail && <ActionLink href={links.mail} icon="mail" label="E-mail" />}
                <MoreMenu
                  items={[
                    onSold && !base.archived && { label: sold ? "Aankoopgegevens aanpassen" : "Aankoop afgerond vastleggen", icon: "checkCircle", onClick: () => onSold(base) },
                    base.archived
                      ? { label: "Terugzetten uit archief", icon: "archive", onClick: () => runAndClose(() => restoreLead(base, user)) }
                      : { label: "Archiveren", icon: "archive", onClick: () => runAndClose(() => archiveLead(base, user), `${base.name || "Deze lead"} archiveren? Je vindt de lead terug onder Archief.`) },
                    {
                      label: "Lead verwijderen",
                      icon: "trash",
                      danger: true,
                      onClick: () =>
                        runAndClose(
                          () => deleteLeadPermanently(base),
                          `${base.name || "Deze lead"} definitief verwijderen?\n\nDit verwijdert ook alle activiteiten, taken, partnerkoppelingen en bestanden. Dit kan niet ongedaan worden gemaakt.`
                        ),
                    },
                  ]}
                />
              </>
            )}
            <CloseButton onClick={requestClose} />
          </div>
        </div>

        {dupLeads.length > 0 && (
          <Notice tone="warn">
            <span style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ fontWeight: 600 }}>Mogelijk bestaande lead gevonden:</strong>
              {dupLeads.map((d) => (
                <button key={d.id} type="button" onClick={() => onOpenLead(d)} className="msk-link" style={{ ...linkBtnStyle, color: "#7d5710" }}>
                  {d.name || "naam onbekend"} openen
                </button>
              ))}
              <button type="button" onClick={() => dismissPossibleDuplicate(base, user)} className="msk-link" style={{ ...linkBtnStyle, color: C.textMuted }}>
                Geen dubbele lead
              </button>
            </span>
          </Notice>
        )}

        {sold && (
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 12, padding: "8px 14px", fontSize: 13 }}>
            <span style={{ color: C.success, display: "flex", gap: 6, alignItems: "center", fontWeight: 600 }}>
              <Icon name="checkCircle" size={16} /> Aankoop afgerond{base.saleDate ? ` op ${formatDate(base.saleDate)}` : ""}
            </span>
            <span style={{ color: C.text }}>{base.saleProperty || "Woning onbekend"}</span>
            <span style={{ color: C.textMuted }}>
              {formatEuro(base.salePrice) || "–"} · commissie {base.saleCommission > 0 ? formatEuro(base.saleCommission) : "nog invullen"}
            </span>
            {onSold && (
              <button type="button" onClick={() => onSold(base)} className="msk-link" style={{ ...linkBtnStyle, marginLeft: "auto" }}>
                Aanpassen
              </button>
            )}
          </div>
        )}

        {signals.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {signals.map((s) => (
              <Badge key={s.key} color={SEVERITY_STYLE[s.severity].color} bg={SEVERITY_STYLE[s.severity].bg} icon="alertCircle">
                {s.label}
              </Badge>
            ))}
          </div>
        )}

        {!isNew && <Tabs tabs={tabs} active={tab} onChange={setTab} />}
      </div>

      {base._isLegacy && !isNew && (
        <Notice tone="info">
          Deze lead komt uit de oude CRM-versie. De gegevens zijn automatisch vertaald naar de nieuwe velden en worden bij de eerste wijziging definitief bijgewerkt. Oude waarden blijven bewaard.
        </Notice>
      )}

      {duplicates && (
        <Notice tone="warn">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Er bestaat mogelijk al een lead met dit e-mailadres of telefoonnummer.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {duplicates.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <span>
                  <strong>{d.name || "Naam onbekend"}</strong> · {d.email || "–"} · {d.phone || "–"}
                  {d.archived ? " · gearchiveerd" : ""}
                </span>
                <button type="button" onClick={() => onOpenLead(d)} style={btnStyle("primary")}>
                  Bestaande lead openen
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => create(true)} style={btnStyle("gold", true)}>
              Toch nieuwe lead aanmaken
            </button>
            <button type="button" onClick={() => setDuplicates(null)} style={btnStyle("neutral")}>
              Terug naar formulier
            </button>
          </div>
        </Notice>
      )}

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <div style={{ minHeight: 280 }}>
        {isNew ? (
          <NewLeadForm {...ctx} />
        ) : (
          <>
            {tab === "overview" && <OverviewTab {...ctx} stats={{ activities: activities.items, partnerLinks: partnerLinks.items }} onGoTab={setTab} />}
            {tab === "profile" && <ProfileTab {...ctx} />}
            {tab === "followup" && <FollowUpTab {...ctx} tasks={tasks} />}
            {tab === "timeline" && <TimelineTab {...ctx} activities={activities} clearEdits={clearEdits} />}
            {tab === "partners" && <PartnersTab {...ctx} links={partnerLinks} />}
            {tab === "files" && <FilesTab {...ctx} files={files} />}
          </>
        )}
      </div>

      <div
        className="msk-modal-footer"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          background: C.surfaceWarm,
          margin: `0 -${MODAL_PAD_X}px -${MODAL_PAD_Y}px`,
          padding: `12px ${MODAL_PAD_X}px`,
          borderTop: `1px solid ${C.border}`,
          borderRadius: "0 0 20px 20px",
          fontSize: 12.5,
        }}
      >
        <div role="status" aria-live="polite">
          {isNew ? <span style={{ color: C.textMuted }}>Velden met * zijn verplicht.</span> : <SaveStatus state={saveState} onRetry={flush} onGoTab={setTab} />}
        </div>
        <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
          <button type="button" onClick={requestClose} style={{ ...btnStyle("neutral"), padding: "8px 18px", minHeight: 38, fontSize: 13 }}>
            {isNew ? "Annuleren" : "Sluiten"}
          </button>
          {isNew && (
            <button type="button" onClick={() => create(false)} disabled={creating} style={{ ...btnStyle("primary", true), padding: "8px 20px", minHeight: 38, fontSize: 13 }}>
              <Icon name="plus" size={15} /> {creating ? "Aanmaken..." : "Lead aanmaken"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
