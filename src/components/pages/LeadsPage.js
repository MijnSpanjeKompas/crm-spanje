import { LeadFilters } from "../LeadFilters";
import { LeadCard, LeadTable } from "../LeadList";
import { Icon, btnStyle, cardStyle, C } from "../ui";
import { purgeDate } from "../../crm/services";
import { formatDate, toDate } from "../../crm/dates";
import { PageHeader } from "../shell/AppShell";

/** Prullenbak: verwijderde leads, 30 dagen terug te zetten. */
function TrashList({ trash, search, onRestore, onPurge }) {
  const q = String(search || "").trim().toLowerCase();
  const items = [...trash]
    .filter((l) => !q || `${l.name} ${l.email} ${l.phone}`.toLowerCase().includes(q))
    .sort((a, b) => (toDate(b.deletedAt)?.getTime() || 0) - (toDate(a.deletedAt)?.getTime() || 0));
  if (!items.length) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: "36px 20px" }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>De prullenbak is leeg</div>
        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Verwijderde leads blijven hier 30 dagen staan.</div>
      </div>
    );
  }
  return (
    <div style={{ ...cardStyle, padding: "4px 18px" }}>
      {items.map((l) => {
        const due = purgeDate(l);
        const days = due ? Math.max(0, Math.ceil((due - new Date()) / 86400000)) : null;
        return (
          <div key={l.id} style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", padding: "14px 0", borderBottom: `1px solid ${C.borderSoft}` }}>
            <div style={{ minWidth: 0, flex: "1 1 220px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{l.name || "Naam onbekend"}</div>
              <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>
                Verwijderd{l.deletedByName ? ` door ${l.deletedByName}` : ""}
                {toDate(l.deletedAt) ? ` op ${formatDate(l.deletedAt)}` : ""}
                {days !== null ? ` · wordt over ${days} ${days === 1 ? "dag" : "dagen"} definitief gewist` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => onRestore(l)} style={btnStyle("primary", true)}>
                <Icon name="refresh" size={14} /> Terugzetten
              </button>
              <button type="button" onClick={() => onPurge(l)} style={btnStyle("danger")} title="Nu definitief verwijderen">
                <Icon name="trash" size={14} />
                <span className="msk-hide-sm">Definitief</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Puur leadmanagement: zoeken, filteren, pipeline, snel contact. Geen dashboard-KPI's. */
export function LeadsPage({ filtered, filters, setFilters, users, partners, places, user, loading, view, setView, tabCounts, actions, onImport, onNewLead, trash = [], onRestore, onPurge }) {
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
        resultCount={filters.trash ? trash.length : filtered.length}
        loading={loading}
        view={view}
        setView={setView}
        tabCounts={tabCounts}
      />

      {filters.trash ? (
        <TrashList trash={trash} search={filters.search} onRestore={onRestore} onPurge={onPurge} />
      ) : loading ? (
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
