// ─── MIJN SPANJE KOMPAS · COMMAND CENTER ────────────────────────────────────
// Orchestrator: inloggen, live data, navigatie, pagina's en het leaddossier.
// Businesslogica staat in src/crm/*, UI in src/components/*.

import { useEffect, useMemo, useRef, useState } from "react";
import { useCrmAuth } from "./crm/useCrmAuth";
import { subscribeLeads, subscribeUsers, subscribePartners, subscribeAllSub, setPinned, archiveLead, updateLead, deleteLeadPermanently } from "./crm/services";
import { normalizeLead } from "./crm/normalize";
import { validateLead, FIELD_TABS } from "./crm/validation";
import { buildNotifications } from "./crm/agenda";
import { DEFAULT_FILTERS, applyFilters } from "./crm/filters";
import { labelOf, PIPELINE_STAGES, isClosedStage } from "./crm/constants";
import { baseTextSelection, Notice, C, iconBtnStyle, Icon } from "./components/ui";
import { LoginScreen, LoadingScreen } from "./components/LoginScreen";
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

function subscriptionError(e) {
  if (e?.code === "permission-denied") {
    return "Geen toegang tot de CRM-gegevens. Controleer of je bent ingelogd en of de Firestore rules zijn gepubliceerd.";
  }
  return `Gegevens laden mislukt: ${e?.message || "onbekende fout"}`;
}

export default function App() {
  const auth = useCrmAuth();
  if (auth.status === "loading") return <LoadingScreen />;
  if (auth.status === "signed_out") return <LoginScreen onSignIn={auth.signIn} onResetPassword={auth.resetPassword} />;
  return <Crm user={auth.user} onSignOut={auth.signOut} />;
}

export function Crm({ user, onSignOut }) {
  const [rawLeads, setRawLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [links, setLinks] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [view, setView] = usePref(user.id, "leadView", "kaarten");
  const [collapsed, setCollapsed] = usePref(user.id, "sidebarCollapsed", typeof window !== "undefined" && window.innerWidth < 1180);
  const [readIds, setReadIds] = usePref(user.id, "notificationsRead", []);
  const route = useHashRoute();
  const [modal, setModal] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [saleLeadId, setSaleLeadId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [now, setNow] = useState(() => new Date());

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
      subscribeUsers(setUsers, (e) => console.error("users", e)),
      subscribePartners(setPartners, (e) => console.error("partners", e)),
      // Taken en partnerkoppelingen van alle leads (Agenda, notificaties, KPI's, Partners).
      subscribeAllSub("tasks", setTasks, (e) => console.error("tasks", e)),
      subscribeAllSub("partnerLinks", setLinks, (e) => console.error("partnerLinks", e)),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [userId]);

  // Datumgevoelige signalen (vandaag/te laat) elke 5 minuten verversen.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const activeUsers = useMemo(() => users.filter((u) => u.active !== false), [users]);
  const leads = useMemo(() => rawLeads.map((r) => normalizeLead(r, { users })), [rawLeads, users]);

  const places = useMemo(
    () => Array.from(new Set(leads.flatMap((l) => l.places || []))).sort((a, b) => a.localeCompare(b, "nl")),
    [leads]
  );
  // Aantallen per tabblad (fase), los van de andere filters.
  const tabCounts = useMemo(() => {
    const c = { open: 0, archived: 0 };
    leads.forEach((l) => {
      if (l.archived) {
        c.archived += 1;
        return;
      }
      c[l.pipelineStage] = (c[l.pipelineStage] || 0) + 1;
      if (!isClosedStage(l.pipelineStage)) c.open += 1;
    });
    return c;
  }, [leads]);

  const notifications = useMemo(() => buildNotifications({ leads, tasks, links, now }), [leads, tasks, links, now]);
  const allIds = notifications.map((n) => n.id).join("|");
  // Gelezen-lijst opschonen: alleen ids die nog bestaan bewaren.
  useEffect(() => {
    const ids = new Set(allIds.split("|"));
    setReadIds((r) => (r.some((id) => !ids.has(id)) ? r.filter((id) => ids.has(id)) : r));
  }, [allIds, setReadIds]);

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
    const v = validateLead(after, { partnerCount: lead.partnerSummary?.count || 0, previousStage: lead.pipelineStage });
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
          {page === "kpis" && <KpiPage leads={leads} links={links} partners={partners} users={users} now={now} navigate={route.navigate} onOpenPartner={openPartner} onShowLeads={showLeads} />}
          {page === "partners" && (
            <PartnersPage partners={partners} links={links} leads={leads} user={user} now={now} onOpenLead={(l, tab) => l && openLead(l, tab)} openPartnerId={route.param || null} setOpenPartnerId={(id) => route.navigate("partners", id || "")} />
          )}
          {page === "commissies" && <CommissionsPage leads={leads} partners={partners} users={activeUsers} user={user} now={now} onOpenLead={(l) => openLead(l)} onOpenPartner={openPartner} />}
          {page === "instellingen" && <SettingsPage user={user} leads={leads} view={view} setView={setView} onImport={() => setImportOpen(true)} onResetNotifications={() => setReadIds([])} />}
          {page === "help" && <HelpPage />}
        </main>
      </div>

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
