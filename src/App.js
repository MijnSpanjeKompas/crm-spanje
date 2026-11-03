// ─── MIJN SPANJE KOMPAS · COMMAND CENTER ────────────────────────────────────
// Orchestrator: inloggen, live data, navigatie, pagina's en het leaddossier.
// Businesslogica staat in src/crm/*, UI in src/components/*.

import { useEffect, useMemo, useRef, useState } from "react";
import { useCrmAuth } from "./crm/useCrmAuth";
import { subscribeLeads, subscribePartners, subscribeAllSub, setPinned, archiveLead, updateLead, deleteLeadPermanently, subscribeNotificationReads, saveNotificationReads, backfillContactAttempts } from "./crm/services";
import { normalizeLead } from "./crm/normalize";
import { validateLead, blockingErrors, FIELD_TABS } from "./crm/validation";
import { buildNotifications } from "./crm/agenda";
import { DEFAULT_FILTERS, applyFilters } from "./crm/filters";
import { labelOf, PIPELINE_STAGES, isClosedStage } from "./crm/constants";
import { baseTextSelection, Notice, C, iconBtnStyle, Icon } from "./components/ui";
import { LoginScreen, LoadingScreen, ProfilePicker } from "./components/LoginScreen";
import { PROFILES, getStoredProfileId, storeProfileId, profileUser } from "./crm/profiles";
import { isRecentlyAdded } from "./crm/filters";
import { LeadDetailModal } from "./components/lead/LeadDetailModal";
import { SaleDialog } from "./components/SaleDialog";
import { ImportModal } from "./components/ImportModal";
import { Sidebar, Topbar, GlobalSearch, NotificationBell } from "./components/shell/AppShell";
import { useHashRoute, usePref } from "./components/shell/useHashRoute";
import { DashboardPage } from "./components/pages/DashboardPage";
import { LeadsPage } from "./components/pages/LeadsPage";
import { AgendaPage } from "./components/pages/AgendaPage";
import { KpiPage } from "./components/pages/KpiPage";
import { PartnersPage } from "./components/pages/PartnersPage";
import { CommissionsPage } from "./components/pages/CommissionsPage";
import { SettingsPage, HelpPage } from "./components/pages/SettingsPage";
import { RecordingBar, CallFlowNotices } from "./components/CallFlowBar";
import { useCallSettings } from "./crm/useCallFlow";

function subscriptionError(e) {
  if (e?.code === "permission-denied") {
    return "Geen toegang tot de CRM-gegevens. Controleer of je bent ingelogd en of de Firestore rules zijn gepubliceerd.";
  }
  return `Gegevens laden mislukt: ${e?.message || "onbekende fout"}`;
}

export default function App() {
  const auth = useCrmAuth();
  const [profileId, setProfileId] = useState(getStoredProfileId);
  const pickProfile = (id) => {
    storeProfileId(id);
    setProfileId(id);
  };
  if (auth.status === "loading") return <LoadingScreen />;
  if (auth.status === "signed_out") return <LoginScreen onSignIn={auth.signIn} onResetPassword={auth.resetPassword} />;
  // Na het inloggen altijd eerst een profiel kiezen (Luke of Indy).
  const user = profileUser(auth.user, profileId);
  const signOut = () => {
    pickProfile(null);
    auth.signOut();
  };
  if (!user) return <ProfilePicker profiles={PROFILES} onPick={pickProfile} onSignOut={signOut} />;
  return <Crm key={user.id} user={user} onSignOut={signOut} onSwitchProfile={() => pickProfile(null)} />;
}

export function Crm({ user, onSignOut, onSwitchProfile }) {
  const [rawLeads, setRawLeads] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [links, setLinks] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [view, setView] = usePref(user.id, "leadView", "kaarten");
  const [collapsed, setCollapsed] = usePref(user.id, "sidebarCollapsed", typeof window !== "undefined" && window.innerWidth < 1180);
  const [readIds, setReadIdsState] = useState([]);
  const [subError, setSubError] = useState(null);
  const route = useHashRoute();
  const [modal, setModal] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [saleLeadId, setSaleLeadId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const callSettings = useCallSettings();

  const userId = user.id;
  useEffect(() => {
    const unsubs = [
      subscribeLeads(
        (docs) => {
          setRawLeads(docs);
          setLoading(false);
          setError(null);
        },
        (e) => {
          console.error(e);
          setError(subscriptionError(e));
          setLoading(false);
        }
      ),
      subscribePartners(setPartners, (e) => console.error("partners", e)),
      // Taken en partnerkoppelingen van alle leads (Agenda, notificaties, KPI's, Partners).
      // Lukt dit niet, dan tonen we dat: anders mist de Agenda stilletjes items.
      subscribeAllSub("tasks", setTasks, (e) => {
        console.error("tasks", e);
        setSubError("Taken konden niet worden geladen, dus de Agenda is mogelijk niet compleet. Publiceer de Firestore rules (zie README).");
      }),
      subscribeAllSub("partnerLinks", setLinks, (e) => {
        console.error("partnerLinks", e);
        setSubError("Partneropvolgingen konden niet worden geladen, dus de Agenda is mogelijk niet compleet. Publiceer de Firestore rules (zie README).");
      }),
      // Gelezen notificaties per profiel, in Firestore: blijft bewaard na herstarten en op elk apparaat.
      subscribeNotificationReads(userId, setReadIdsState, (e) => console.error("notificaties", e)),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [userId]);

  // Datumgevoelige signalen (vandaag/te laat) elke 5 minuten verversen.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Teamleden = de profielen (Luke en Indy).
  const activeUsers = PROFILES;
  const leads = useMemo(() => rawLeads.map((r) => normalizeLead(r, { users: PROFILES })), [rawLeads]);

  // Eenmalig per sessie: "eerste benadering" afleiden voor leads die dat nog missen
  // (uit de tijdlijn). Vult alleen lege velden, verzint niets.
  const backfilled = useRef(false);
  useEffect(() => {
    if (loading || backfilled.current || !rawLeads.length) return;
    backfilled.current = true;
    backfillContactAttempts(leads, user).catch((e) => console.error("backfill benadering", e));
  }, [loading, rawLeads.length, leads, user]);

  const places = useMemo(
    () => Array.from(new Set(leads.flatMap((l) => l.places || []))).sort((a, b) => a.localeCompare(b, "nl")),
    [leads]
  );
  // Aantallen per tabblad (fase), los van de andere filters.
  const tabCounts = useMemo(() => {
    const c = { open: 0, archived: 0, recent: 0 };
    leads.forEach((l) => {
      if (!l.archived && isRecentlyAdded(l, now)) c.recent += 1;
      if (l.archived) {
        c.archived += 1;
        return;
      }
      c[l.pipelineStage] = (c[l.pipelineStage] || 0) + 1;
      if (!isClosedStage(l.pipelineStage)) c.open += 1;
    });
    return c;
  }, [leads, now]);

  const notifications = useMemo(() => buildNotifications({ leads, tasks, links, now }), [leads, tasks, links, now]);
  // Gelezen-status opslaan in Firestore (per profiel). Niet meer "opschonen" bij het
  // opstarten: toen waren de leads nog niet geladen en ging alles verloren.
  function setReadIds(updater) {
    setReadIdsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveNotificationReads(userId, next).catch((e) => console.error("notificaties opslaan", e));
      return next;
    });
  }

  const filtered = useMemo(() => applyFilters(leads, filters, { currentUserId: user.id, now }), [leads, filters, user.id, now]);

  const modalLead = modal && !modal.isNew ? leads.find((l) => l.id === modal.leadId) : null;

  // Lead is (door iemand anders) definitief verwijderd terwijl hij open stond.
  const seenModalLead = useRef(null);
  useEffect(() => {
    if (modalLead) seenModalLead.current = modalLead.id;
    else if (modal && !modal.isNew && seenModalLead.current === modal.leadId) {
      seenModalLead.current = null;
      setModal(null);
    }
  }, [modal, modalLead]);

  function openLead(lead, tab, extra = {}) {
    setModal({ key: `${lead.id}-${Date.now()}`, leadId: lead.id, isNew: false, initialTab: tab || "overview", ...extra });
  }

  function openLeadById(id, tab) {
    const l = leads.find((x) => x.id === id);
    if (l) openLead(l, tab);
  }

  function openNew() {
    setModal({ key: `new-${Date.now()}`, isNew: true });
  }

  /** Vanaf Dashboard naar Leads met een filter (bijv. snelfilter of fase). */
  function showLeads(patch) {
    setFilters({ ...DEFAULT_FILTERS, ...patch });
    route.navigate("leads");
  }

  function openPartner(p) {
    if (p) route.navigate("partners", p.id);
  }

  async function handleStageChange(lead, stage) {
    if (stage === lead.pipelineStage) return;
    const after = { ...lead, pipelineStage: stage };
    const ctx = { partnerCount: lead.partnerSummary?.count || 0, previousStage: lead.pipelineStage };
    const v = validateLead(after, ctx);
    v.errors = blockingErrors(lead, after, ctx);
    v.valid = Object.keys(v.errors).length === 0;
    if (!v.valid) {
      const firstKey = Object.keys(v.errors)[0];
      openLead(lead, FIELD_TABS[firstKey] || "overview", {
        initialEdits: { pipelineStage: stage },
        initialMessage: { tone: "warn", text: `Vul nog even aan om de fase op '${labelOf(PIPELINE_STAGES, stage)}' te zetten: ${Object.values(v.errors).join(" ")}` },
      });
      return;
    }
    if (v.warnings.length && !window.confirm(`${v.warnings.join("\n\n")}\n\nToch doorgaan?`)) return;
    try {
      await updateLead(lead, after, user);
    } catch (e) {
      console.error(e);
      setNotice({ tone: "error", text: `Fase wijzigen mislukt: ${e.message || "onbekende fout"}` });
    }
  }

  async function handleArchive(lead) {
    if (!window.confirm(`${lead.name || "Deze lead"} archiveren? Je vindt de lead daarna terug via het filter "Archief".`)) return;
    try {
      await archiveLead(lead, user);
      setNotice({ tone: "ok", text: `${lead.name || "Lead"} is gearchiveerd.` });
    } catch (e) {
      console.error(e);
      setNotice({ tone: "error", text: `Archiveren mislukt: ${e.message || "onbekende fout"}` });
    }
  }

  const saleLead = saleLeadId ? leads.find((l) => l.id === saleLeadId) : null;

  function handleSold(lead) {
    setSaleLeadId(lead.id);
  }

  async function handleDelete(lead) {
    const name = lead.name || "deze lead";
    if (!window.confirm(`${name} definitief verwijderen?\n\nDit verwijdert ook alle activiteiten, taken, partnerkoppelingen en bestanden. Dit kan niet ongedaan worden gemaakt.\n\nWil je de lead alleen uit beeld halen? Kies dan Archiveren.`)) return;
    try {
      await deleteLeadPermanently(lead);
      setNotice({ tone: "ok", text: `${lead.name || "Lead"} is verwijderd.` });
    } catch (e) {
      console.error(e);
      setNotice({ tone: "error", text: e?.code === "permission-denied" ? "Verwijderen mislukt: geen rechten." : `Verwijderen mislukt: ${e.message || "onbekende fout"}` });
    }
  }

  async function handleTogglePin(lead) {
    try {
      await setPinned(lead, !lead.pinned);
    } catch (e) {
      console.error(e);
      setNotice({ tone: "error", text: "Pinnen mislukt." });
    }
  }

  const actions = {
    onOpen: (l) => openLead(l),
    onArchive: handleArchive,
    onDelete: handleDelete,
    onSold: handleSold,
    onStageChange: handleStageChange,
    onTogglePin: handleTogglePin,
  };
  const badges = { agenda: notifications.filter((n) => n.severity === "high").length };
  const page = route.page;

  return (
    <div style={{ ...baseTextSelection, minHeight: "100vh", background: C.bg, color: C.text, fontFamily: C.fontUi, display: "flex" }}>
      <Sidebar page={page} navigate={route.navigate} collapsed={collapsed} setCollapsed={setCollapsed} badges={badges} />
      <div className="msk-shell-main">
        <Topbar
          user={user}
          onSignOut={onSignOut}
          onSwitchProfile={onSwitchProfile}
          search={<GlobalSearch leads={leads} partners={partners} onOpenLead={(l) => openLead(l)} onOpenPartner={openPartner} />}
          bell={
            <NotificationBell
              notifications={notifications}
              readIds={readIds}
              markRead={(id) => setReadIds((r) => (r.includes(id) ? r : [...r, id]))}
              markAllRead={() => setReadIds(notifications.map((n) => n.id))}
              onOpen={(n) => {
                const l = n.leadId && leads.find((x) => x.id === n.leadId);
                if (l) openLead(l, n.tab);
                else if (n.partnerId) route.navigate("partners", n.partnerId);
              }}
            />
          }
        />
        <main className="msk-container" style={{ width: "100%", maxWidth: 1400 }}>
          {error && (
            <div style={{ marginBottom: 16 }}>
              <Notice tone="error">{error}</Notice>
            </div>
          )}
          {subError && (
            <div style={{ marginBottom: 16 }}>
              <Notice tone="warn">{subError}</Notice>
            </div>
          )}
          <CallFlowNotices settings={callSettings} leads={leads} onOpenLead={(id) => openLeadById(id, "calls")} />
          {notice && (
            <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <Notice tone={notice.tone}>{notice.text}</Notice>
              </div>
              <button type="button" onClick={() => setNotice(null)} aria-label="Melding sluiten" className="msk-icon-btn" style={{ ...iconBtnStyle, width: 32, height: 32, marginTop: 4 }}>
                <Icon name="x" size={15} />
              </button>
            </div>
          )}

          {page === "dashboard" && (
            <DashboardPage user={user} leads={leads} tasks={tasks} links={links} now={now} onOpenLead={(l, tab) => l && openLead(l, tab)} onNewLead={openNew} onImport={() => setImportOpen(true)} navigate={route.navigate} setLeadFilter={showLeads} />
          )}
          {page === "leads" && (
            <LeadsPage
              filtered={filtered}
              filters={filters}
              setFilters={setFilters}
              users={activeUsers}
              partners={partners}
              places={places}
              user={user}
              loading={loading}
              view={view}
              setView={setView}
              tabCounts={tabCounts}
              actions={actions}
              onImport={() => setImportOpen(true)}
              onNewLead={openNew}
            />
          )}
          {page === "agenda" && <AgendaPage leads={leads} tasks={tasks} links={links} users={activeUsers} now={now} initialView={route.param} onOpenLead={(l, tab) => l && openLead(l, tab)} />}
          {page === "kpis" && <KpiPage leads={leads} links={links} partners={partners} now={now} navigate={route.navigate} onOpenPartner={openPartner} onShowLeads={showLeads} />}
          {page === "partners" && (
            <PartnersPage partners={partners} links={links} leads={leads} user={user} now={now} onOpenLead={(l, tab) => l && openLead(l, tab)} openPartnerId={route.param || null} setOpenPartnerId={(id) => route.navigate("partners", id || "")} />
          )}
          {page === "commissies" && <CommissionsPage leads={leads} partners={partners} users={activeUsers} user={user} now={now} onOpenLead={(l) => openLead(l)} onOpenPartner={openPartner} />}
          {page === "instellingen" && <SettingsPage user={user} leads={leads} view={view} setView={setView} onImport={() => setImportOpen(true)} onResetNotifications={() => setReadIds([])} callSettings={callSettings} />}
          {page === "help" && <HelpPage />}
        </main>
      </div>

      <RecordingBar user={user} onOpenLead={(id) => openLeadById(id, "calls")} />

      {modal && (
        <LeadDetailModal
          key={modal.key}
          lead={modalLead}
          isNew={modal.isNew}
          initialEdits={modal.initialEdits}
          initialTab={modal.initialTab}
          initialMessage={modal.initialMessage}
          users={activeUsers}
          partners={partners}
          allLeads={leads}
          user={user}
          onClose={() => setModal(null)}
          onCreated={(id) => setModal({ key: `${id}-created`, leadId: id, isNew: false, initialTab: "overview", initialMessage: { tone: "ok", text: "Lead aangemaakt. Wijzigingen worden vanaf nu automatisch opgeslagen." } })}
          onOpenLead={(l) => openLead(l)}
          onSold={handleSold}
        />
      )}

      {importOpen && (
        <ImportModal
          leads={leads}
          user={user}
          onClose={() => setImportOpen(false)}
          onOpenLead={(l) => {
            if (!l) return;
            setImportOpen(false);
            openLead(l);
          }}
        />
      )}

      {saleLead && (
        <SaleDialog
          key={saleLead.id}
          lead={saleLead}
          user={user}
          partners={partners}
          onClose={() => setSaleLeadId(null)}
          onSaved={(l, wasEdit) =>
            setNotice({ tone: "ok", text: wasEdit ? `Aankoopgegevens van ${l.name || "de lead"} bijgewerkt.` : `${l.name || "Lead"} staat op Aankoop afgerond. De commissie staat onder Commissies.` })
          }
        />
      )}

    </div>
  );
}
