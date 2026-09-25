// ─── MIJN SPANJE KOMPAS CRM ──────────────────────────────────────────────────
// Orchestrator: inloggen, live data, dashboard, lijst en leaddetail.
// Businesslogica staat in src/crm/*, UI-bouwstenen in src/components/*.

import { useEffect, useMemo, useRef, useState } from "react";
import { useCrmAuth } from "./crm/useCrmAuth";
import { subscribeLeads, subscribeUsers, subscribePartners, setPinned, archiveLead, updateLead } from "./crm/services";
import { normalizeLead } from "./crm/normalize";
import { validateLead, FIELD_TABS } from "./crm/validation";
import { computeKpis, getTodayItems, getAttentionList } from "./crm/signals";
import { DEFAULT_FILTERS, applyFilters } from "./crm/filters";
import { labelOf, PIPELINE_STAGES } from "./crm/constants";
import { baseTextSelection, Icon, Notice } from "./components/ui";
import { LoginScreen, NoAccessScreen, LoadingScreen } from "./components/LoginScreen";
import { KpiRow, StageChart, TodayPanel, AttentionPanel } from "./components/Dashboard";
import { LeadFilters } from "./components/LeadFilters";
import { LeadCard, LeadTable } from "./components/LeadList";
import { LeadDetailModal } from "./components/lead/LeadDetailModal";
import { PartnersModal } from "./components/PartnersModal";

function scrollToList() {
  const el = document.getElementById("lead-list");
  if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function subscriptionError(e) {
  if (e?.code === "permission-denied") {
    return "Geen toegang tot de CRM-gegevens. Controleer of je gebruikersaccount actief is en of de Firestore rules zijn gepubliceerd.";
  }
  return `Gegevens laden mislukt: ${e?.message || "onbekende fout"}`;
}

export default function App() {
  const auth = useCrmAuth();
  if (auth.status === "loading") return <LoadingScreen />;
  if (auth.status === "signed_out") return <LoginScreen onSignIn={auth.signIn} onResetPassword={auth.resetPassword} />;
  if (auth.status === "no_access") return <NoAccessScreen authUser={auth.authUser} onSignOut={auth.signOut} />;
  return <Crm user={auth.user} onSignOut={auth.signOut} />;
}

export function Crm({ user, onSignOut }) {
  const [rawLeads, setRawLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [view, setView] = useState("kaarten");
  const [modal, setModal] = useState(null);
  const [partnersOpen, setPartnersOpen] = useState(false);
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
  const liveLeads = useMemo(() => leads.filter((l) => !l.archived), [leads]);

  const kpis = useMemo(() => computeKpis(liveLeads, now), [liveLeads, now]);
  const todayItems = useMemo(() => getTodayItems(liveLeads, now), [liveLeads, now]);
  const attention = useMemo(() => getAttentionList(liveLeads, now), [liveLeads, now]);
  const places = useMemo(
    () => Array.from(new Set(leads.flatMap((l) => l.places || []))).sort((a, b) => a.localeCompare(b, "nl")),
    [leads]
  );
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

  function setQuick(q) {
    setFilters((f) => ({ ...f, quick: q }));
    if (q) scrollToList();
  }

  async function handleStageChange(lead, stage) {
    if (stage === lead.pipelineStage) return;
    const after = { ...lead, pipelineStage: stage };
    const v = validateLead(after, { partnerCount: lead.partnerSummary?.count || 0 });
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

  async function handleTogglePin(lead) {
    try {
      await setPinned(lead, !lead.pinned);
    } catch (e) {
      console.error(e);
      setNotice({ tone: "error", text: "Pinnen mislukt." });
    }
  }

  return (
    <div
      style={{
        ...baseTextSelection,
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #f1f5f9",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 62,
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22 }}>🇪🇸</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a" }}>Mijn Spanje Kompas</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Lead- en klantvolgsysteem</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }} title={user.email}>
            {user.displayName}
            {user.isAdmin ? " · beheerder" : ""}
          </span>
          <button
            type="button"
            onClick={() => setPartnersOpen(true)}
            style={{ background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", gap: 7, alignItems: "center", fontFamily: "inherit" }}
          >
            <Icon name="users" size={14} /> Partners
          </button>
          <button
            type="button"
            onClick={openNew}
            style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", gap: 7, alignItems: "center", fontFamily: "inherit" }}
          >
            <Icon name="plus" size={14} /> Nieuwe lead
          </button>
          <button
            type="button"
            onClick={onSignOut}
            title="Uitloggen"
            aria-label="Uitloggen"
            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex" }}
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "26px 24px" }}>
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
            <button type="button" onClick={() => setNotice(null)} aria-label="Melding sluiten" style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", marginTop: 6 }}>
              <Icon name="x" size={14} />
            </button>
          </div>
        )}

        <KpiRow kpis={kpis} activeQuick={filters.quick} onQuick={setQuick} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 16, marginBottom: 20 }}>
          <StageChart
            leads={leads}
            onPick={(stage) => {
              setFilters((f) => ({ ...f, stage, quick: null, scope: "all" }));
              scrollToList();
            }}
          />
          <TodayPanel items={todayItems} onOpen={(lead, tab) => openLead(lead, tab)} />
          <AttentionPanel list={attention} onOpen={(lead) => openLead(lead, "overview")} onShowAll={() => setQuick("attention")} />
        </div>

        <LeadFilters
          filters={filters}
          setFilters={setFilters}
          users={activeUsers}
          partners={partners}
          places={places}
          currentUser={user}
          resultCount={filtered.length}
          loading={loading}
          view={view}
          setView={setView}
        />

        {loading ? (
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Leads laden...</div>
        ) : filtered.length === 0 ? (
          <div style={{ fontSize: 13, color: "#94a3b8", padding: "20px 0" }}>Geen leads gevonden met deze filters.</div>
        ) : view === "tabel" ? (
          <LeadTable leads={filtered} onOpen={(l) => openLead(l)} onArchive={handleArchive} onTogglePin={handleTogglePin} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {filtered.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onOpen={(l) => openLead(l)} onArchive={handleArchive} onStageChange={handleStageChange} onTogglePin={handleTogglePin} />
            ))}
          </div>
        )}
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
          onCreated={(id) => setModal({ key: `${id}-created`, leadId: id, isNew: false, initialTab: "activities", initialMessage: { tone: "ok", text: "Lead aangemaakt. Leg hier direct het eerste contact vast." } })}
          onOpenLead={(l) => openLead(l)}
          onManagePartners={() => setPartnersOpen(true)}
        />
      )}

      {partnersOpen && <PartnersModal partners={partners} leads={leads} user={user} onClose={() => setPartnersOpen(false)} />}
    </div>
  );
}
