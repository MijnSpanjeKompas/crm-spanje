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
import { baseTextSelection, Icon, Notice, C, btnStyle, iconBtnStyle, cardStyle, BrandLogo } from "./components/ui";
import { LoginScreen, LoadingScreen } from "./components/LoginScreen";
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

  const initials = (user.displayName || user.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
  const today = now.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div
      style={{
        ...baseTextSelection,
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: C.fontUi,
      }}
    >
      {/* HEADER */}
      <header
        style={{
          background: C.surfaceWarm,
          borderBottom: `1px solid ${C.border}`,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          className="msk-header-inner"
          style={{ maxWidth: 1320, margin: "0 auto", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <BrandLogo height={38} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: C.fontDisplay, fontWeight: 600, fontSize: 17, color: C.navy, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Mijn Spanje Kompas</div>
              <div className="msk-hide-sm" style={{ fontSize: 11.5, color: C.textMuted, marginTop: 1 }}>
                CRM · Lead- en klantvolgsysteem
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              title={user.email}
              className="msk-user-chip"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 4,
                paddingRight: 12,
                border: `1px solid ${C.border}`,
                borderRadius: 999,
                background: C.surface,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 99,
                  background: C.gold,
                  color: C.navyDark,
                  fontSize: 11.5,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  letterSpacing: ".02em",
                }}
              >
                {initials}
              </span>
              <span className="msk-hide-sm" style={{ lineHeight: 1.2 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text }}>{user.displayName}</span>
                <span style={{ display: "block", fontSize: 11, color: C.textMuted }}>
                  {user.isAdmin ? "Beheerder" : "Medewerker"}
                </span>
              </span>
            </div>
            <button type="button" onClick={onSignOut} title="Uitloggen" aria-label="Uitloggen" style={btnStyle("neutral")}>
              <Icon name="logout" size={15} />
              <span className="msk-hide-sm">Uitloggen</span>
            </button>
          </div>
        </div>
      </header>

      <main className="msk-container">
        {/* PAGINAKOP */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 6, textTransform: "capitalize" }}>{today}</div>
            <h1
              className="msk-page-title"
              style={{ fontFamily: C.fontDisplay, fontSize: 32, fontWeight: 600, color: C.navy, margin: 0, lineHeight: 1.1, letterSpacing: "-0.015em" }}
            >
              Leads
            </h1>
            <div style={{ fontSize: 14, color: C.textMuted, marginTop: 6 }}>Beheer en volg alle potentiële kopers.</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setPartnersOpen(true)} style={{ ...btnStyle("primary"), padding: "9px 15px", minHeight: 40, fontSize: 13 }}>
              <Icon name="users" size={15} /> Partners
            </button>
            <button type="button" onClick={openNew} style={{ ...btnStyle("primary", true), padding: "9px 18px", minHeight: 40, fontSize: 13 }}>
              <Icon name="plus" size={15} /> Nieuwe lead
            </button>
          </div>
        </div>

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

        <KpiRow kpis={kpis} activeQuick={filters.quick} onQuick={setQuick} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 28 }}>
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
          <div style={{ ...cardStyle, fontSize: 13, color: C.textMuted, textAlign: "center", padding: "36px 20px" }}>Leads laden...</div>
        ) : filtered.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "44px 20px" }}>
            <div style={{ color: C.textSubtle, display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <Icon name="search" size={22} />
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>Geen leads gevonden met deze filters</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Pas de filters aan of klik op Reset om alles te tonen.</div>
          </div>
        ) : view === "tabel" ? (
          <LeadTable leads={filtered} onOpen={(l) => openLead(l)} onArchive={handleArchive} onTogglePin={handleTogglePin} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))", gap: 16 }}>
            {filtered.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onOpen={(l) => openLead(l)} onArchive={handleArchive} onStageChange={handleStageChange} onTogglePin={handleTogglePin} />
            ))}
          </div>
        )}
      </main>

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
