import { LeadFilters } from "../LeadFilters";
import { LeadCard, LeadTable } from "../LeadList";
import { Icon, btnStyle, cardStyle, C } from "../ui";
import { PageHeader } from "../shell/AppShell";

/** Puur leadmanagement: zoeken, filteren, pipeline, snel contact. Geen dashboard-KPI's. */
export function LeadsPage({ filtered, filters, setFilters, users, partners, places, user, loading, view, setView, tabCounts, actions, onImport, onNewLead }) {
  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Beheer en volg alle potentiële kopers."
        actions={
          <>
            <button type="button" onClick={onImport} style={{ ...btnStyle("primary"), minHeight: 40, padding: "9px 15px", fontSize: 13 }}>
              <Icon name="upload" size={15} /> Importeren
            </button>
            <button type="button" onClick={onNewLead} style={{ ...btnStyle("primary", true), minHeight: 40, padding: "9px 18px", fontSize: 13 }}>
              <Icon name="plus" size={15} /> Nieuwe lead
            </button>
          </>
        }
      />

      <LeadFilters
        filters={filters}
        setFilters={setFilters}
        users={users}
        partners={partners}
        places={places}
        currentUser={user}
        resultCount={filtered.length}
        loading={loading}
        view={view}
        setView={setView}
        tabCounts={tabCounts}
      />

      {loading ? (
        <div style={{ ...cardStyle, fontSize: 13, color: C.textMuted, textAlign: "center", padding: "36px 20px" }}>Leads laden...</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "36px 20px" }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>Geen leads gevonden met deze filters</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Pas de filters aan of klik op Reset om alles te tonen.</div>
        </div>
      ) : view === "tabel" ? (
        <LeadTable leads={filtered} {...actions} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))", gap: 16 }}>
          {filtered.map((lead) => (
            <LeadCard key={lead.id} lead={lead} {...actions} />
          ))}
        </div>
      )}
    </div>
  );
}
