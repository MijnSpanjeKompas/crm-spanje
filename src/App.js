import { useState, useEffect, useMemo } from "react";

// ─── DEMO DATA ────────────────────────────────────────────────────────────────
const DEMO_LEADS = [
  {
    id: "1",
    naam: "Familie Van den Berg",
    telefoon: "+31 6 12 34 56 78",
    email: "vandenberg@gmail.com",
    regio: "Costa Blanca",
    status: "Actieve klant",
    startdatum: "2025-02-10",
    typeKlant: "Pensioenmigratie",
    budget: "€ 280.000 – 350.000",
    verantwoordelijke: "Luke",
    volgendActie: "2026-05-12",
    laatsteContact: "2026-04-28",
    notities: `Stel zoekt een vrijstaande villa met privézwembad, bij voorkeur in de regio Altea of Jávea. Beide partners gaan volgend jaar met pensioen.\n\nWensen:\n- Minimaal 3 slaapkamers\n- Privézwembad\n- Rustige ligging, maar niet te afgelegen\n- Dicht bij golf (man speelt 2x per week)\n\nBezwaren:\n- Zorgen over taalbarrière bij notaris en belastingaangiften\n- Onzeker over procedure niet-residente belasting\n\nAfspraken:\n- Volgende week bel ik terug met 3 concrete objecten\n- Ik stuur het artikel over de NIE-aanvraag\n\nPersoonlijke notitie: Erg vriendelijk stel. Vrouw wil graag dicht bij de zee wonen. Man meer geïnteresseerd in de praktische kant.`,
  },
  {
    id: "2",
    naam: "Marieke Janssen",
    telefoon: "+31 6 98 76 54 32",
    email: "marieke.janssen@outlook.com",
    regio: "Costa del Sol",
    status: "In gesprek",
    startdatum: "2025-03-18",
    typeKlant: "Vakantiehuis",
    budget: "€ 150.000 – 200.000",
    verantwoordelijke: "Luke",
    volgendActie: "2026-05-09",
    laatsteContact: "2026-05-02",
    notities: `Marieke zoekt een appartement als vakantiehuis, dat ze ook wil verhuren in de zomers. Oriëntatiefase.\n\nWensen:\n- Zwembad in complex\n- Max 15 min van strand\n- Verhuurpotentieel is heel belangrijk\n- Budget is absoluut maximum\n\nBezwaren:\n- Twijfelt over de belastingplicht bij verhuurinkomsten vanuit NL\n- Vraagt of ze dit als investering of als genot moet zien\n\nAfspraken:\n- Ik zoek 2 complexen met verhuurgeschiedenis\n- Ze wil liefst een bezichtigingstour in september\n\nPersoonlijke notitie: Enthousiast maar twijfelachtig. Geef haar wat meer zekerheid door cijfers te onderbouwen.`,
  },
  {
    id: "3",
    naam: "Peter & Inge Smits",
    telefoon: "+32 476 11 22 33",
    email: "smitsfamilie@telenet.be",
    regio: "Murcia / Mar Menor",
    status: "Wacht op reactie",
    startdatum: "2025-04-01",
    typeKlant: "Permanente bewoning",
    budget: "€ 200.000 – 250.000",
    verantwoordelijke: "Luke",
    volgendActie: "2026-05-08",
    laatsteContact: "2026-04-18",
    notities: `Belgisch koppel dat al een jaar twijfelt over de stap. Peter heeft een early retirement deal geaccepteerd.\n\nWensen:\n- Wil absoluut niet meer dan 250k uitgeven\n- Grondgebonden woning\n- Inge wil een grote tuin voor haar moestuin\n- Hond aanwezig, dus hekwerk is must\n\nBezwaren:\n- Peter twijfelt of de Spaanse gezondheidszorg echt goed genoeg is\n- Inge wil niet te ver van een Nederlandse winkel (Lidl/Aldi)\n- Zijn bang dat ze de taal niet leren\n\nAfspraken:\n- Ik stuur hen het document over gezondheidszorg en residency\n- Wachten op reactie al 2 weken – opvolgen!\n\nPersoonlijke notitie: Ze zijn bijna over de streep maar Inge aarzelt nog. Volgende keer meer aandacht voor haar specifieke wensen.`,
  },
  {
    id: "4",
    naam: "Thomas Groen",
    telefoon: "+31 6 55 44 33 22",
    email: "t.groen@icloud.com",
    regio: "Alicante stad",
    status: "Nieuwe lead",
    startdatum: "2026-04-29",
    typeKlant: "Investering",
    budget: "€ 180.000 – 220.000",
    verantwoordelijke: "Luke",
    volgendActie: "2026-05-10",
    laatsteContact: "2026-04-29",
    notities: `Thomas reageerde via het contactformulier op de website. Zoekt als investering een appartement om te verhuren.\n\nNog weinig info. Eerste gesprek inplannen.\n\nEerste indruk: zakelijk type, wil vooral rendementen en cijfers zien.`,
  },
  {
    id: "5",
    naam: "Ans & Cor Visser",
    telefoon: "+31 6 22 33 44 55",
    email: "ansencor@kpnmail.nl",
    regio: "Costa Cálida",
    status: "Afgerond",
    startdatum: "2024-09-05",
    typeKlant: "Pensioenmigratie",
    budget: "€ 310.000",
    verantwoordelijke: "Luke",
    volgendActie: null,
    laatsteContact: "2026-02-15",
    notities: `Ans en Cor hebben in februari 2026 hun droomhuis gekocht in Lo Pagán. Traject van 5 maanden.\n\nMooie villa met 3 slaapkamers, gezwembad en zonneterras. Koopakte getekend bij notaris in Cartagena.\n\nKlant was erg tevreden. Ze gaven een 9 als beoordeling en willen een testimonial schrijven.\n\nAftercare:\n- NIE geregeld ✓\n- Stroomaansluiting omgezet ✓\n- Habia-overschrijving water lopend`,
  },
  {
    id: "6",
    naam: "Dirk Vermeulen",
    telefoon: "+32 495 77 88 99",
    email: "dirk.vermeulen@hotmail.com",
    regio: "Costa Brava",
    status: "Niet doorgegaan",
    startdatum: "2025-01-15",
    typeKlant: "Vakantiehuis",
    budget: "€ 130.000",
    verantwoordelijke: "Luke",
    volgendActie: null,
    laatsteContact: "2025-11-10",
    notities: `Dirk heeft uiteindelijk besloten niet door te gaan. Gezinsomstandigheid veranderd (scheiding).\n\nMogelijk in de toekomst opnieuw interesse. Op vriendschappelijke voet afgerond.\n\nNogmaals contact opnemen in 2027 kan kansen opleveren.`,
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  "Nieuwe lead":      { color: "#6366f1", bg: "#eef2ff", label: "Nieuwe lead" },
  "In gesprek":       { color: "#f59e0b", bg: "#fffbeb", label: "In gesprek" },
  "Wacht op reactie": { color: "#ef4444", bg: "#fef2f2", label: "Wacht op reactie" },
  "Actieve klant":    { color: "#10b981", bg: "#ecfdf5", label: "Actieve klant" },
  "Afgerond":         { color: "#64748b", bg: "#f1f5f9", label: "Afgerond" },
  "Niet doorgegaan":  { color: "#94a3b8", bg: "#f8fafc", label: "Niet doorgegaan" },
};

const STATUSSEN = Object.keys(STATUS_CONFIG);

function looptijdDagen(startdatum) {
  if (!startdatum) return 0;
  const start = new Date(startdatum);
  const nu = new Date();
  return Math.floor((nu - start) / (1000 * 60 * 60 * 24));
}

function formatDatum(d) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" });
}

function isOpvolgingBinnenkort(datum) {
  if (!datum) return false;
  const d = new Date(datum);
  const nu = new Date();
  const diff = (d - nu) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 3;
}

function isOpvolgingVerlopen(datum) {
  if (!datum) return false;
  return new Date(datum) < new Date();
}

const LEEG_KLANT = {
  naam: "", telefoon: "", email: "", regio: "", status: "Nieuwe lead",
  startdatum: new Date().toISOString().split("T")[0], typeKlant: "",
  budget: "", verantwoordelijke: "Luke", volgendActie: "", laatsteContact: "",
  notities: "",
};

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "crm_spanje_kompas_v1";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEMO_LEADS;
  } catch { return DEMO_LEADS; }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 16 }) => {
  const icons = {
    search: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>,
    edit: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    trash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
    x: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>,
    user: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    phone: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    mail: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    map: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    calendar: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    bell: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    chart: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    flag: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
    sun: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    back: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>,
    save: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  };
  return icons[name] || null;
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent, icon }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "20px 24px",
      display: "flex", flexDirection: "column", gap: 6,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9",
      flex: 1, minWidth: 140,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: accent, fontSize: 12, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" }}>
        <Icon name={icon} size={14} />
        {label}
      </div>
      <div style={{ fontSize: 34, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{value}</div>
    </div>
  );
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: "#64748b", bg: "#f1f5f9" };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}22`,
      borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
    }}>{status}</span>
  );
}

// ─── MINI CHART (status verdeling) ───────────────────────────────────────────
function StatusChart({ leads }) {
  const counts = {};
  STATUSSEN.forEach(s => { counts[s] = leads.filter(l => l.status === s).length; });
  const max = Math.max(...Object.values(counts), 1);

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", border: "1px solid #f1f5f9", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
        <Icon name="chart" size={14} /> Leads per status
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {STATUSSEN.map(s => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 110, fontSize: 11, color: "#64748b", textAlign: "right", flexShrink: 0 }}>{s}</div>
            <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 6, height: 14, overflow: "hidden" }}>
              <div style={{
                width: `${(counts[s] / max) * 100}%`, height: "100%",
                background: STATUS_CONFIG[s]?.color || "#94a3b8", borderRadius: 6,
                transition: "width .5s ease",
              }} />
            </div>
            <div style={{ width: 20, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{counts[s]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── OPVOLGING PANEL ──────────────────────────────────────────────────────────
function OpvolgingPanel({ leads, onOpen }) {
  const urgent = leads.filter(l => l.volgendActie && (isOpvolgingBinnenkort(l.volgendActie) || isOpvolgingVerlopen(l.volgendActie)) && l.status !== "Afgerond" && l.status !== "Niet doorgegaan");
  if (!urgent.length) return null;

  return (
    <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14, padding: "16px 20px", marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <Icon name="bell" size={14} /> Opvolging vereist ({urgent.length})
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {urgent.map(l => (
          <button key={l.id} onClick={() => onOpen(l)} style={{
            background: "#fff", border: "1px solid #fcd34d", borderRadius: 8,
            padding: "6px 12px", fontSize: 12, color: "#92400e", cursor: "pointer",
            display: "flex", gap: 6, alignItems: "center",
          }}>
            <span style={{ fontWeight: 700 }}>{l.naam}</span>
            <span style={{ opacity: .7 }}>→ {formatDatum(l.volgendActie)}</span>
            {isOpvolgingVerlopen(l.volgendActie) && <span style={{ color: "#ef4444", fontWeight: 800 }}>VERLOPEN</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── KLANT KAART ─────────────────────────────────────────────────────────────
function KlantKaart({ klant, onOpen, onDelete }) {
  const looptijd = looptijdDagen(klant.startdatum);
  const opvolgingKleur = isOpvolgingVerlopen(klant.volgendActie) ? "#ef4444"
    : isOpvolgingBinnenkort(klant.volgendActie) ? "#f59e0b" : "#64748b";

  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: 12,
      transition: "box-shadow .2s", cursor: "pointer",
    }}
      onClick={() => onOpen(klant)}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{klant.naam}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
            <Icon name="map" size={11} />{klant.regio}
          </div>
        </div>
        <StatusBadge status={klant.status} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: 12, color: "#475569" }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}><Icon name="flag" size={11} />{klant.typeKlant || "–"}</div>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}><Icon name="chart" size={11} />{looptijd} dagen</div>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}><Icon name="sun" size={11} />Budget: {klant.budget || "–"}</div>
        <div style={{ display: "flex", gap: 5, alignItems: "center", color: opvolgingKleur }}>
          <Icon name="calendar" size={11} />
          {klant.volgendActie ? formatDatum(klant.volgendActie) : "Geen actie"}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }} onClick={e => e.stopPropagation()}>
        <button onClick={() => onOpen(klant)} style={btnStyle("#6366f1")}>
          <Icon name="edit" size={13} /> Openen
        </button>
        <button onClick={() => onDelete(klant.id)} style={btnStyle("#ef4444")}>
          <Icon name="trash" size={13} />
        </button>
      </div>
    </div>
  );
}

function btnStyle(color) {
  return {
    background: `${color}12`, color, border: `1px solid ${color}30`,
    borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer",
    display: "flex", gap: 4, alignItems: "center", fontWeight: 600,
  };
}

// ─── KLANT MODAL (detail + edit) ─────────────────────────────────────────────
function KlantModal({ klant, onClose, onSave, isNieuw }) {
  const [form, setForm] = useState(klant);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inputStyle = {
    width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px",
    fontSize: 14, color: "#0f172a", background: "#f8fafc", outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block" };

  const Field = ({ label, k, type = "text", as }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      {as === "textarea"
        ? <textarea value={form[k] || ""} onChange={e => set(k, e.target.value)}
            rows={10} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, fontFamily: "inherit" }} />
        : as === "select"
          ? <select value={form[k] || ""} onChange={e => set(k, e.target.value)} style={inputStyle}>
              {STATUSSEN.map(s => <option key={s}>{s}</option>)}
            </select>
          : <input type={type} value={form[k] || ""} onChange={e => set(k, e.target.value)} style={inputStyle} />
      }
    </div>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", zIndex: 1000,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "24px 16px", overflowY: "auto",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "#fff", borderRadius: 18, width: "100%", maxWidth: 720,
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)", padding: "28px 32px",
        display: "flex", flexDirection: "column", gap: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
            {isNieuw ? "Nieuwe klant / lead toevoegen" : `${form.naam}`}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
            <Icon name="x" size={22} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Naam klant / lead" k="naam" />
          <Field label="Telefoon" k="telefoon" />
          <Field label="E-mailadres" k="email" type="email" />
          <Field label="Regio / Locatie Spanje" k="regio" />
          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)} style={inputStyle}>
              {STATUSSEN.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <Field label="Type klant / interesse" k="typeKlant" />
          <Field label="Startdatum" k="startdatum" type="date" />
          <Field label="Laatste contact" k="laatsteContact" type="date" />
          <Field label="Volgende actie / follow-up" k="volgendActie" type="date" />
          <Field label="Budget / waarde indicatie" k="budget" />
          <Field label="Verantwoordelijke" k="verantwoordelijke" />
        </div>

        <div>
          <label style={{ ...labelStyle, marginBottom: 6 }}>
            📝 Notities &amp; gespreksaantekeningen
          </label>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
            Wat zoekt de klant? Welke wensen, bezwaren, afspraken en persoonlijke opmerkingen zijn er?
          </div>
          <textarea value={form.notities || ""} onChange={e => set("notities", e.target.value)}
            rows={10} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7, fontFamily: "inherit" }}
            placeholder="Bijv: Familie Van den Berg zoekt een vrijstaande villa in Altea met privézwembad. Zorgen over de NIE-procedure. Volgende stap: 3 objecten sturen en terugbellen op donderdag." />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 4 }}>
          <button onClick={onClose} style={{ ...btnStyle("#64748b"), padding: "8px 18px", fontSize: 13 }}>
            Annuleren
          </button>
          <button onClick={() => onSave(form)} style={{
            background: "#6366f1", color: "#fff", border: "none", borderRadius: 9,
            padding: "9px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            display: "flex", gap: 6, alignItems: "center",
          }}>
            <Icon name="save" size={14} /> Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [leads, setLeads] = useState(loadData);
  const [zoek, setZoek] = useState("");
  const [filterStatus, setFilterStatus] = useState("Alle");
  const [filterRegio, setFilterRegio] = useState("Alle");
  const [sorteer, setSorteer] = useState("startdatum");
  const [modal, setModal] = useState(null); // null | { klant, isNieuw }

  useEffect(() => { saveData(leads); }, [leads]);

  const regioos = useMemo(() => ["Alle", ...Array.from(new Set(leads.map(l => l.regio).filter(Boolean)))], [leads]);

  const gefilterd = useMemo(() => {
    let res = leads;
    if (zoek) res = res.filter(l => l.naam.toLowerCase().includes(zoek.toLowerCase()));
    if (filterStatus !== "Alle") res = res.filter(l => l.status === filterStatus);
    if (filterRegio !== "Alle") res = res.filter(l => l.regio === filterRegio);
    res = [...res].sort((a, b) => {
      if (sorteer === "startdatum") return new Date(b.startdatum) - new Date(a.startdatum);
      if (sorteer === "looptijd") return looptijdDagen(b.startdatum) - looptijdDagen(a.startdatum);
      if (sorteer === "volgendActie") return (a.volgendActie || "9") < (b.volgendActie || "9") ? -1 : 1;
      return 0;
    });
    return res;
  }, [leads, zoek, filterStatus, filterRegio, sorteer]);

  const stats = useMemo(() => ({
    totaal: leads.length,
    actief: leads.filter(l => l.status === "Actieve klant").length,
    warm: leads.filter(l => l.status === "In gesprek").length,
    afgerond: leads.filter(l => l.status === "Afgerond").length,
    gemLooptijd: leads.length ? Math.round(leads.reduce((a, l) => a + looptijdDagen(l.startdatum), 0) / leads.length) : 0,
  }), [leads]);

  function opslaanKlant(form) {
    if (form.id) {
      setLeads(ls => ls.map(l => l.id === form.id ? form : l));
    } else {
      setLeads(ls => [...ls, { ...form, id: Date.now().toString() }]);
    }
    setModal(null);
  }

  function verwijderKlant(id) {
if (window.confirm("Weet je zeker dat je deze lead wilt verwijderen?")) {
      setLeads(ls => ls.filter(l => l.id !== id));
    }
  }

  const selectStyle = {
    border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px",
    fontSize: 13, color: "#0f172a", background: "#fff", cursor: "pointer", outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* HEADER */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #f1f5f9",
        padding: "0 32px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22 }}>🇪🇸</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>Mijn Spanje Kompas</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>CRM — Klantbeheer</div>
          </div>
        </div>
        <button onClick={() => setModal({ klant: { ...LEEG_KLANT }, isNieuw: true })} style={{
          background: "#6366f1", color: "#fff", border: "none", borderRadius: 9,
          padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
          display: "flex", gap: 6, alignItems: "center",
        }}>
          <Icon name="plus" size={14} /> Nieuwe lead
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        {/* STATS */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 28 }}>
          <StatCard label="Totaal leads" value={stats.totaal} accent="#6366f1" icon="user" />
          <StatCard label="Actieve klanten" value={stats.actief} accent="#10b981" icon="flag" />
          <StatCard label="In gesprek" value={stats.warm} accent="#f59e0b" icon="phone" />
          <StatCard label="Afgerond" value={stats.afgerond} accent="#64748b" icon="save" />
          <StatCard label="Gem. looptijd" value={`${stats.gemLooptijd}d`} accent="#8b5cf6" icon="calendar" />
        </div>

        {/* CHART + OPVOLGING */}
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, marginBottom: 28 }}>
          <StatusChart leads={leads} />
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <OpvolgingPanel leads={leads} onOpen={k => setModal({ klant: k, isNieuw: false })} />
            <div style={{
              background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 14,
              padding: "16px 20px", fontSize: 13, color: "#15803d", lineHeight: 1.6,
            }}>
              <strong>💡 Tip:</strong> Klik op een klantkaart hieronder om alle details te zien en te bewerken. Gebruik de filters om snel te zoeken. Notities worden automatisch opgeslagen in je browser.
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20,
          background: "#fff", borderRadius: 12, padding: "14px 16px",
          border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", padding: "7px 12px" }}>
            <Icon name="search" size={14} />
            <input value={zoek} onChange={e => setZoek(e.target.value)} placeholder="Zoeken op naam…"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, flex: 1, color: "#0f172a" }} />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
            <option>Alle</option>
            {STATUSSEN.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterRegio} onChange={e => setFilterRegio(e.target.value)} style={selectStyle}>
            {regioos.map(r => <option key={r}>{r}</option>)}
          </select>
          <select value={sorteer} onChange={e => setSorteer(e.target.value)} style={selectStyle}>
            <option value="startdatum">Sorteren: startdatum</option>
            <option value="looptijd">Sorteren: looptijd</option>
            <option value="volgendActie">Sorteren: follow-up</option>
          </select>
          <div style={{ fontSize: 12, color: "#94a3b8", alignSelf: "center" }}>{gefilterd.length} resultaten</div>
        </div>

        {/* KLANTEN GRID */}
        {gefilterd.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Geen leads gevonden</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Pas je filters aan of voeg een nieuwe lead toe.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
            {gefilterd.map(k => (
              <KlantKaart key={k.id} klant={k}
                onOpen={k => setModal({ klant: k, isNieuw: false })}
                onDelete={verwijderKlant}
              />
            ))}
          </div>
        )}
      </div>

      {/* MODAL */}
      {modal && (
        <KlantModal
          klant={modal.klant}
          isNieuw={modal.isNieuw}
          onClose={() => setModal(null)}
          onSave={opslaanKlant}
        />
      )}
    </div>
  );
}
