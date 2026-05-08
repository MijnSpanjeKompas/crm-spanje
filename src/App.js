import { useState, useEffect, useMemo } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = "crm_spanje_kompas_v2";

const STATUS_CONFIG = {
  "Nieuwe lead": { color: "#6366f1", bg: "#eef2ff" },
  "Intake gepland": { color: "#0ea5e9", bg: "#e0f2fe" },
  Doorgegeven: { color: "#10b981", bg: "#ecfdf5" },
  Afgerond: { color: "#64748b", bg: "#f1f5f9" },
  "Niet doorgegaan": { color: "#94a3b8", bg: "#f8fafc" },
};

const STATUSSEN = Object.keys(STATUS_CONFIG);

const LEADTYPE_CONFIG = {
  "Hot lead": { color: "#ef4444", bg: "#fef2f2" },
  "Warm lead": { color: "#f59e0b", bg: "#fffbeb" },
  "Lauwe lead": { color: "#0ea5e9", bg: "#e0f2fe" },
  "Koude lead": { color: "#64748b", bg: "#f8fafc" },
};

const LEADTYPES = Object.keys(LEADTYPE_CONFIG);

const LEADBRONNEN = [
  "Website",
  "Meta Ads",
  "Google Ads",
  "Organisch",
  "Via-via",
  "Partner",
  "Anders",
];

const VOLGENDE_ACTIES = [
  "Intake plannen",
  "Intake uitvoeren",
  "Wensen controleren",
  "Woningvoorstellen sturen",
  "Doorgeven",
  "Wachten op reactie",
  "Later opnieuw benaderen",
  "Geen directe actie",
];

const CONTACTMETHODES = [
  "Telefoon",
  "WhatsApp",
  "E-mail",
  "Intakeformulier",
  "Videocall",
  "Nog geen contact",
];

const TAGS = [
  "Investering",
  "Emigratie",
  "Tweede woning",
  "Vakantiehuis",
  "Nieuwbouw",
  "Bestaande bouw",
  "Verhuurinteresse",
  "Oriënterend",
  "Urgent",
];

const WENS_OPTIES = {
  budget: [
    "Tot € 200.000",
    "€ 200.000 – € 300.000",
    "€ 300.000 – € 400.000",
    "€ 400.000 – € 500.000",
    "€ 500.000 – € 600.000",
    "€ 600.000+",
  ],
  gewensteRegio: [
    "Costa Blanca Noord",
    "Costa Blanca Zuid",
    "Costa Cálida",
    "Costa del Sol",
    "Costa Brava",
    "Alicante",
    "Murcia",
    "Nog niet zeker",
  ],
  woningtype: [
    "Appartement",
    "Penthouse",
    "Villa",
    "Townhouse",
    "Finca",
    "Geschakelde woning",
    "Nog niet zeker",
  ],
  bouwtype: [
    "Nieuwbouw",
    "Resale / bestaande bouw",
    "Nieuwbouw of resale",
    "Nog niet zeker",
  ],
  slaapkamers: ["1", "2", "3", "4", "5+", "Nog niet zeker"],
  verhuurinteresse: [
    "Ja, belangrijk",
    "Misschien",
    "Nee",
    "Alleen als het goed uitkomt",
    "Nog niet zeker",
  ],
  doelAankoop: [
    "Tweede woning",
    "Vakantiehuis",
    "Investering",
    "Emigratie",
    "Pensioen / langere verblijven",
    "Combinatie eigen gebruik en verhuur",
    "Nog niet zeker",
  ],
  gewenstePlaats: [
    "Alicante",
    "Torrevieja",
    "Guardamar del Segura",
    "Jávea",
    "Altea",
    "Moraira",
    "San Pedro del Pinatar",
    "Los Alcázares",
    "Málaga omgeving",
    "Nog niet zeker",
  ],
  tijdshorizon: [
    "Zo snel mogelijk",
    "Binnen 3 maanden",
    "Binnen 6 maanden",
    "6 tot 12 maanden",
    "Meer dan 12 maanden",
    "Oriënterend",
  ],
};

const LEEG_LEAD = {
  naam: "",
  telefoon: "",
  email: "",
  regio: "",
  status: "Nieuwe lead",
  startdatum: new Date().toISOString().split("T")[0],

  leadbron: "Website",
  leadscore: "Warm lead",
  volgendeActie: "Intake plannen",

  pinned: false,

  opvolgdatum: "",
  geenStrengeDatum: true,

  laatsteContactdatum: "",
  contactmethode: "Nog geen contact",

  tags: [],

  gewensteRegio: "",
  gewensteRegioAnders: "",
  gewenstePlaats: "",
  gewenstePlaatsAnders: "",
  woningtype: "",
  woningtypeAnders: "",
  bouwtype: "",
  bouwtypeAnders: "",
  slaapkamers: "",
  slaapkamersAnders: "",
  budget: "",
  budgetAnders: "",
  doelAankoop: "",
  doelAankoopAnders: "",
  verhuurinteresse: "",
  verhuurinteresseAnders: "",
  tijdshorizon: "",
  tijdshorizonAnders: "",
  extraWensen: "",

  notities: "",
  voortgangsnotitie: "",
};

// ─── DEMO DATA ───────────────────────────────────────────────────────────────
const DEMO_LEADS = [
  {
    id: "1",
    naam: "Familie Van den Berg",
    telefoon: "+31 6 12 34 56 78",
    email: "vandenberg@gmail.com",
    regio: "Costa Blanca Noord",
    status: "Doorgegeven",
    startdatum: "2026-04-18",
    leadbron: "Website",
    leadscore: "Hot lead",
    volgendeActie: "Woningvoorstellen sturen",
    pinned: true,
    opvolgdatum: "2026-05-12",
    geenStrengeDatum: false,
    laatsteContactdatum: "2026-05-04",
    contactmethode: "Telefoon",
    tags: ["Emigratie", "Tweede woning", "Urgent"],
    gewensteRegio: "Costa Blanca Noord",
    gewenstePlaats: "Altea / Jávea",
    woningtype: "Villa",
    bouwtype: "Resale / bestaande bouw",
    slaapkamers: "3",
    budget: "€ 300.000 – € 400.000",
    doelAankoop: "Pensioen / langere verblijven",
    verhuurinteresse: "Nee",
    tijdshorizon: "Binnen 6 maanden",
    extraWensen: "Rustige omgeving, zee in de buurt en duidelijke begeleiding.",
    notities:
      "Vriendelijk stel dat zich serieus oriënteert op een woning voor hun pensioen.",
    voortgangsnotitie: "Zoekprofiel is duidelijk. Volgende stap: passende woningen sturen.",
  },
  {
    id: "2",
    naam: "Marieke Janssen",
    telefoon: "+31 6 98 76 54 32",
    email: "marieke.janssen@outlook.com",
    regio: "Costa del Sol",
    status: "Intake gepland",
    startdatum: "2026-04-25",
    leadbron: "Meta Ads",
    leadscore: "Warm lead",
    volgendeActie: "Wensen controleren",
    pinned: false,
    opvolgdatum: "2026-05-10",
    geenStrengeDatum: false,
    laatsteContactdatum: "2026-05-02",
    contactmethode: "Videocall",
    tags: ["Vakantiehuis", "Verhuurinteresse", "Oriënterend"],
    gewensteRegio: "Costa del Sol",
    gewenstePlaats: "Málaga omgeving",
    woningtype: "Appartement",
    bouwtype: "Nieuwbouw of resale",
    slaapkamers: "2",
    budget: "€ 200.000 – € 300.000",
    doelAankoop: "Combinatie eigen gebruik en verhuur",
    verhuurinteresse: "Ja, belangrijk",
    tijdshorizon: "6 tot 12 maanden",
    extraWensen: "Wil graag realistische verhuurverwachtingen begrijpen.",
    notities:
      "Marieke zoekt een appartement dat ze zelf kan gebruiken en deels wil verhuren.",
    voortgangsnotitie: "Nog controleren of Costa del Sol binnen budget realistisch genoeg is.",
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function dateOnly(dateString) {
  if (!dateString) return null;
  return new Date(`${dateString}T00:00:00`);
}

function diffInDays(dateString) {
  const target = dateOnly(dateString);
  const today = dateOnly(todayISO());
  if (!target || !today) return null;
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function formatDatum(d) {
  if (!d) return "–";
  return new Date(`${d}T00:00:00`).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getOpvolgingInfo(lead) {
  if (lead.geenStrengeDatum || !lead.opvolgdatum) {
    return {
      type: "geen",
      label: "Geen strenge datum",
      sort: 99999,
      color: "#64748b",
      bg: "#f8fafc",
    };
  }

  const diff = diffInDays(lead.opvolgdatum);

  if (diff === 0) {
    return {
      type: "vandaag",
      label: "Vandaag opvolgen",
      sort: 0,
      color: "#f59e0b",
      bg: "#fffbeb",
    };
  }

  if (diff === 1) {
    return {
      type: "binnenkort",
      label: "Morgen opvolgen",
      sort: 1,
      color: "#0ea5e9",
      bg: "#e0f2fe",
    };
  }

  if (diff > 1) {
    return {
      type: diff <= 7 ? "binnenkort" : "later",
      label: `Over ${diff} dagen opvolgen`,
      sort: diff,
      color: diff <= 7 ? "#0ea5e9" : "#64748b",
      bg: diff <= 7 ? "#e0f2fe" : "#f8fafc",
    };
  }

  const teLaat = Math.abs(diff);
  return {
    type: "telaat",
    label: `${teLaat} ${teLaat === 1 ? "dag" : "dagen"} te laat`,
    sort: diff,
    color: "#ef4444",
    bg: "#fef2f2",
  };
}

function isOpenLead(lead) {
  return lead.status !== "Afgerond" && lead.status !== "Niet doorgegaan";
}

function mapOldStatus(status) {
  const mapping = {
    "In gesprek": "Intake gepland",
    "Intake gehad": "Intake gepland",
    "Zoekprofiel duidelijk": "Intake gepland",
    "Woningvoorstellen gestuurd": "Doorgegeven",
    "Wacht op reactie": "Doorgegeven",
    "Actieve klant": "Intake gepland",
    "Doorgestuurd naar makelaar": "Doorgegeven",
  };

  return mapping[status] || status || "Nieuwe lead";
}

function mapOldLeadscore(score) {
  const mapping = {
    "A-lead": "Hot lead",
    "B-lead": "Warm lead",
    "C-lead": "Koude lead",
  };

  return mapping[score] || score || "Warm lead";
}

function normalizeLead(lead) {
  const mappedStatus = mapOldStatus(lead.status);
  const normalizedStatus = STATUSSEN.includes(mappedStatus)
    ? mappedStatus
    : "Nieuwe lead";

  const mappedScore = mapOldLeadscore(lead.leadscore);
  const normalizedScore = LEADTYPES.includes(mappedScore)
    ? mappedScore
    : "Warm lead";

  return {
    ...LEEG_LEAD,
    ...lead,
    status: normalizedStatus,
    leadscore: normalizedScore,
    pinned: Boolean(lead.pinned),
    leadbron: lead.leadbron || "Website",
    volgendeActie: lead.volgendeActie || "Geen directe actie",
    opvolgdatum: lead.opvolgdatum || lead.volgendActie || "",
    geenStrengeDatum:
      typeof lead.geenStrengeDatum === "boolean"
        ? lead.geenStrengeDatum
        : !(lead.opvolgdatum || lead.volgendActie),
    laatsteContactdatum: lead.laatsteContactdatum || lead.laatsteContact || "",
    contactmethode: lead.contactmethode || "Nog geen contact",
    doelAankoop: lead.doelAankoop || lead.typeKlant || "",
    gewensteRegio: lead.gewensteRegio || lead.regio || "",
    tags: Array.isArray(lead.tags) ? lead.tags : [],
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : DEMO_LEADS;

    const normalizedData = data.map(normalizeLead);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedData));

    return normalizedData;
  } catch {
    const normalizedDemoData = DEMO_LEADS.map(normalizeLead);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedDemoData));
    return normalizedDemoData;
  }
}
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 16 }) => {
  const icons = {
    search: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
    plus: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
    edit: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    trash: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3,6 5,6 21,6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    ),
    x: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    ),
    user: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    map: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    calendar: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    bell: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    chart: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    save: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
    ),
    table: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
      </svg>
    ),
    grid: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    star: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2.8l2.8 5.67 6.25.91-4.52 4.41 1.07 6.23L12 17.08l-5.6 2.94 1.07-6.23-4.52-4.41 6.25-.91L12 2.8z" />
      </svg>
    ),
    chevron: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m6 9 6 6 6-6" />
      </svg>
    ),
  };

  return icons[name] || null;
};

// ─── STYLES ──────────────────────────────────────────────────────────────────
const baseTextSelection = {
  WebkitUserSelect: "text",
  userSelect: "text",
};

const inputStyle = {
  width: "100%",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
  color: "#0f172a",
  background: "#f8fafc",
  outline: "none",
  boxSizing: "border-box",
  WebkitUserSelect: "text",
  userSelect: "text",
};

const selectStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: "#0f172a",
  background: "#fff",
  cursor: "pointer",
  outline: "none",
};

const labelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: "#64748b",
  marginBottom: 5,
  display: "block",
};

function btnStyle(color, solid = false) {
  return {
    background: solid ? color : `${color}12`,
    color: solid ? "#fff" : color,
    border: solid ? "none" : `1px solid ${color}30`,
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    gap: 5,
    alignItems: "center",
    fontWeight: 700,
  };
}

// ─── UI COMPONENTS ───────────────────────────────────────────────────────────
function StatCard({ label, value, accent, icon }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "14px 16px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        border: "1px solid #f1f5f9",
        flex: 1,
        minWidth: 150,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          color: accent,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: ".04em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        <Icon name={icon} size={13} />
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function Badge({ children, color = "#64748b", bg = "#f8fafc" }) {
  return (
    <span
      style={{
        background: bg,
        color,
        border: `1px solid ${color}22`,
        borderRadius: 999,
        padding: "3px 9px",
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: "#64748b", bg: "#f1f5f9" };
  return <Badge color={cfg.color} bg={cfg.bg}>{status}</Badge>;
}

function LeadTypeBadge({ type }) {
  const cfg = LEADTYPE_CONFIG[type] || { color: "#64748b", bg: "#f8fafc" };
  return <Badge color={cfg.color} bg={cfg.bg}>{type}</Badge>;
}

function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontSize: 14,
        fontWeight: 900,
        color: "#0f172a",
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, fieldKey, value, onChange, type = "text", as, options = [], rows = 4 }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {as === "textarea" ? (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          rows={rows}
          style={{
            ...inputStyle,
            resize: "vertical",
            lineHeight: 1.6,
            fontFamily: "inherit",
          }}
        />
      ) : as === "select" ? (
        <select
          value={value || ""}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          style={inputStyle}
        >
          <option value="">Selecteer...</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          style={inputStyle}
        />
      )}
    </div>
  );
}

function WensAccordion({ title, fieldKey, andersKey, value, andersValue, options, onChange }) {
  const [open, setOpen] = useState(false);
  const isAnders = value === "Anders, namelijk...";

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          border: "none",
          background: "#f8fafc",
          padding: "11px 12px",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>{title}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {isAnders ? andersValue || "Anders, namelijk..." : value || "Nog niet ingevuld"}
          </div>
        </div>
        <span
          style={{
            color: "#94a3b8",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: ".15s ease",
          }}
        >
          <Icon name="chevron" size={16} />
        </span>
      </button>

      {open && (
        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          <select
            value={value || ""}
            onChange={(e) => onChange(fieldKey, e.target.value)}
            style={inputStyle}
          >
            <option value="">Selecteer...</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
            <option value="Anders, namelijk...">Anders, namelijk...</option>
          </select>

          {isAnders && (
            <input
              value={andersValue || ""}
              onChange={(e) => onChange(andersKey, e.target.value)}
              placeholder="Typ je eigen antwoord..."
              style={inputStyle}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── STATUS CHART ────────────────────────────────────────────────────────────
function StatusChart({ leads }) {
  const counts = {};
  STATUSSEN.forEach((s) => {
    counts[s] = leads.filter((l) => l.status === s).length;
  });

  const max = Math.max(...Object.values(counts), 1);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "16px 18px",
        border: "1px solid #f1f5f9",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: "#0f172a",
          marginBottom: 12,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <Icon name="chart" size={14} /> Leads per status
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {STATUSSEN.map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 110,
                fontSize: 11,
                color: "#64748b",
                flexShrink: 0,
              }}
            >
              {s}
            </div>
            <div
              style={{
                flex: 1,
                background: "#f1f5f9",
                borderRadius: 6,
                height: 10,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(counts[s] / max) * 100}%`,
                  height: "100%",
                  background: STATUS_CONFIG[s]?.color || "#94a3b8",
                  borderRadius: 6,
                }}
              />
            </div>
            <div
              style={{
                width: 18,
                fontSize: 11,
                fontWeight: 800,
                color: "#0f172a",
                textAlign: "right",
              }}
            >
              {counts[s]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── OPVOLGING PANEL ─────────────────────────────────────────────────────────
function OpvolgingPanel({ leads, onOpen, onOpenFollowUpList }) {
  const relevanteLeads = leads.filter(isOpenLead);

  const groepen = {
    "Te laat": relevanteLeads.filter((l) => getOpvolgingInfo(l).type === "telaat"),
    "Vandaag opvolgen": relevanteLeads.filter((l) => getOpvolgingInfo(l).type === "vandaag"),
    "Binnenkort opvolgen": relevanteLeads.filter((l) => getOpvolgingInfo(l).type === "binnenkort"),
    "Geen strenge datum": relevanteLeads.filter((l) => getOpvolgingInfo(l).type === "geen"),
  };

  const typeMapping = {
    "Te laat": "telaat",
    "Vandaag opvolgen": "vandaag",
    "Binnenkort opvolgen": "binnenkort",
    "Geen strenge datum": "geen",
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #f1f5f9",
        borderRadius: 14,
        padding: "16px 18px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: "#0f172a",
          marginBottom: 12,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <Icon name="bell" size={14} /> Rustige opvolging
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {Object.entries(groepen).map(([titel, items]) => (
          <div
            key={titel}
            onClick={() => onOpenFollowUpList(typeMapping[titel])}
            style={{
              background: "#f8fafc",
              border: "1px solid #eef2f7",
              borderRadius: 12,
              padding: 10,
              minHeight: 86,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#64748b",
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{titel} ({items.length})</span>
              {items.length > 3 && <span>Bekijk alles</span>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.slice(0, 3).map((lead) => {
                const info = getOpvolgingInfo(lead);
                return (
                  <button
                    key={lead.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(lead);
                    }}
                    style={{
                      textAlign: "left",
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: "7px 8px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                      {lead.pinned ? "★ " : ""}
                      {lead.naam}
                    </div>
                    <div style={{ fontSize: 11, color: info.color, marginTop: 2 }}>
                      {info.label}
                    </div>
                  </button>
                );
              })}

              {items.length > 3 && (
                <div style={{ fontSize: 11, color: "#94a3b8", paddingLeft: 2 }}>
                  +{items.length - 3} meer — klik om alles te bekijken
                </div>
              )}

              {!items.length && (
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Geen leads</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LEAD CARD ───────────────────────────────────────────────────────────────
function LeadCard({ lead, onOpen, onDelete, onStatusChange, onTogglePin }) {
  const opvolging = getOpvolgingInfo(lead);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        border: lead.pinned ? "1px solid #f59e0b" : "1px solid #f1f5f9",
        boxShadow: lead.pinned
          ? "0 2px 10px rgba(245,158,11,0.14)"
          : "0 1px 4px rgba(0,0,0,0.05)",
        padding: "17px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        cursor: "pointer",
      }}
      onClick={() => onOpen(lead)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(lead.id);
              }}
              title={lead.pinned ? "Lead losmaken" : "Lead vastpinnen"}
              style={{
                border: "none",
                background: "transparent",
                color: lead.pinned ? "#f59e0b" : "#cbd5e1",
                cursor: "pointer",
                padding: 0,
                display: "flex",
              }}
            >
              <Icon name="star" size={17} />
            </button>

            <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>
              {lead.naam}
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              marginTop: 3,
              display: "flex",
              gap: 5,
              alignItems: "center",
            }}
          >
            <Icon name="map" size={11} />
            {lead.regio || "Regio onbekend"}
          </div>
        </div>
        <StatusBadge status={lead.status} />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <LeadTypeBadge type={lead.leadscore} />
        <Badge color="#6366f1" bg="#eef2ff">
          {lead.leadbron || "Bron onbekend"}
        </Badge>
        {lead.tags?.slice(0, 3).map((tag) => (
          <Badge key={tag} color="#64748b" bg="#f8fafc">
            {tag}
          </Badge>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "7px 12px",
          fontSize: 12,
          color: "#475569",
        }}
      >
        <div>
          <strong>Doel:</strong> {lead.doelAankoop || "–"}
        </div>
        <div>
          <strong>Budget:</strong> {lead.budget || "–"}
        </div>
        <div>
          <strong>Actie:</strong> {lead.volgendeActie || "–"}
        </div>
        <div style={{ color: opvolging.color }}>
          <strong>Opvolging:</strong> {opvolging.label}
        </div>
      </div>

      <details
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#f8fafc",
          borderRadius: 10,
          padding: "9px 10px",
          border: "1px solid #eef2f7",
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          Belangrijkste wensen bekijken
        </summary>

        <div
          style={{
            marginTop: 8,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 7,
            fontSize: 12,
            color: "#475569",
          }}
        >
          <div><strong>Regio:</strong> {lead.gewensteRegio || "–"}</div>
          <div><strong>Plaats:</strong> {lead.gewenstePlaats || "–"}</div>
          <div><strong>Type:</strong> {lead.woningtype || "–"}</div>
          <div><strong>Bouw:</strong> {lead.bouwtype || "–"}</div>
          <div><strong>Slaapkamers:</strong> {lead.slaapkamers || "–"}</div>
          <div><strong>Verhuur:</strong> {lead.verhuurinteresse || "–"}</div>
        </div>
      </details>

      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          background: "#f8fafc",
          borderRadius: 10,
          padding: "9px 10px",
          minHeight: 36,
        }}
      >
        {lead.voortgangsnotitie || "Geen korte voortgangsnotitie."}
      </div>

      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
        onClick={(e) => e.stopPropagation()}
      >
        <select
          value={lead.status}
          onChange={(e) => onStatusChange(lead.id, e.target.value)}
          style={{
            ...selectStyle,
            padding: "6px 8px",
            fontSize: 12,
            maxWidth: 170,
          }}
        >
          {STATUSSEN.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 7 }}>
          <button onClick={() => onOpen(lead)} style={btnStyle("#6366f1")}>
            Openen
          </button>
          <button onClick={() => onOpen(lead)} style={btnStyle("#0ea5e9")}>
            <Icon name="edit" size={13} />
          </button>
          <button onClick={() => onDelete(lead.id)} style={btnStyle("#ef4444")}>
            <Icon name="trash" size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TABLE VIEW ──────────────────────────────────────────────────────────────
function LeadTable({ leads, onOpen, onDelete, onTogglePin }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #f1f5f9",
        borderRadius: 14,
        overflow: "auto",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {[
              "",
              "Naam",
              "Status",
              "Regio",
              "Budget",
              "Leadtype",
              "Leadbron",
              "Volgende actie",
              "Opvolging",
              "Laatste contact",
              "",
            ].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  fontSize: 11,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {leads.map((lead) => {
            const opvolging = getOpvolgingInfo(lead);
            return (
              <tr key={lead.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                <td style={tdStyle}>
                  <button
                    onClick={() => onTogglePin(lead.id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: lead.pinned ? "#f59e0b" : "#cbd5e1",
                      cursor: "pointer",
                      display: "flex",
                    }}
                  >
                    <Icon name="star" size={15} />
                  </button>
                </td>
                <td style={tdStyle}>
                  <button
                    onClick={() => onOpen(lead)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontWeight: 800,
                      color: "#0f172a",
                      cursor: "pointer",
                    }}
                  >
                    {lead.naam}
                  </button>
                </td>
                <td style={tdStyle}>
                  <StatusBadge status={lead.status} />
                </td>
                <td style={tdStyle}>{lead.regio || "–"}</td>
                <td style={tdStyle}>{lead.budget || "–"}</td>
                <td style={tdStyle}>
                  <LeadTypeBadge type={lead.leadscore} />
                </td>
                <td style={tdStyle}>{lead.leadbron || "–"}</td>
                <td style={tdStyle}>{lead.volgendeActie || "–"}</td>
                <td style={{ ...tdStyle, color: opvolging.color, fontWeight: 700 }}>
                  {opvolging.label}
                </td>
                <td style={tdStyle}>
                  {lead.laatsteContactdatum ? formatDatum(lead.laatsteContactdatum) : "–"}
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => onOpen(lead)} style={btnStyle("#6366f1")}>
                      Open
                    </button>
                    <button onClick={() => onDelete(lead.id)} style={btnStyle("#ef4444")}>
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const tdStyle = {
  padding: "12px 14px",
  fontSize: 12,
  color: "#475569",
  verticalAlign: "middle",
};

// ─── FOLLOW-UP MODAL ─────────────────────────────────────────────────────────
function FollowUpListModal({ type, leads, onClose, onOpenLead }) {
  const titles = {
    telaat: "Alle te late opvolgingen",
    vandaag: "Alle leads voor vandaag",
    binnenkort: "Alle leads die binnenkort opgevolgd moeten worden",
    geen: "Alle leads zonder strenge opvolgdatum",
  };

  const items = leads
    .filter(isOpenLead)
    .filter((lead) => getOpvolgingInfo(lead).type === type)
    .sort((a, b) => getOpvolgingInfo(a).sort - getOpvolgingInfo(b).sort);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,.45)",
        zIndex: 1200,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "24px 16px",
        overflowY: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 18,
          width: "100%",
          maxWidth: 720,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          padding: "24px 26px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 900, color: "#0f172a" }}>
              {titles[type] || "Opvolgingen"}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              {items.length} lead{items.length === 1 ? "" : "s"} gevonden.
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
            }}
          >
            <Icon name="x" size={22} />
          </button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {items.map((lead) => {
            const info = getOpvolgingInfo(lead);

            return (
              <button
                key={lead.id}
                onClick={() => onOpenLead(lead)}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "12px 14px",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
                    {lead.pinned ? "★ " : ""}
                    {lead.naam}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                    {lead.regio || "Regio onbekend"} · {lead.volgendeActie || "Geen actie"}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: info.color }}>
                    {info.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                    {lead.opvolgdatum ? formatDatum(lead.opvolgdatum) : "Geen datum"}
                  </div>
                </div>
              </button>
            );
          })}

          {!items.length && (
            <div style={{ padding: 26, textAlign: "center", color: "#94a3b8" }}>
              Geen leads gevonden binnen deze opvolgcategorie.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
function LeadModal({ lead, onClose, onSave, isNieuw }) {
  const [form, setForm] = useState(lead);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const toggleTag = (tag) => {
    setForm((f) => {
      const current = Array.isArray(f.tags) ? f.tags : [];
      return {
        ...f,
        tags: current.includes(tag)
          ? current.filter((t) => t !== tag)
          : [...current, tag],
      };
    });
  };

  const save = () => {
    const cleanForm = {
      ...form,
      opvolgdatum: form.geenStrengeDatum ? "" : form.opvolgdatum,
    };

    onSave(cleanForm);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "24px 16px",
        overflowY: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          ...baseTextSelection,
          background: "#fff",
          borderRadius: 18,
          width: "100%",
          maxWidth: 980,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          padding: "26px 30px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <button
                onClick={() => set("pinned", !form.pinned)}
                title={form.pinned ? "Lead losmaken" : "Lead vastpinnen"}
                style={{
                  border: "none",
                  background: "transparent",
                  color: form.pinned ? "#f59e0b" : "#cbd5e1",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                }}
              >
                <Icon name="star" size={20} />
              </button>

              <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
                {isNieuw ? "Nieuwe lead toevoegen" : form.naam || "Lead bewerken"}
              </div>
            </div>

            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              Bewerk contactgegevens, wensen, opvolging en notities.
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
            }}
          >
            <Icon name="x" size={22} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div
            style={{
              background: "#fff",
              border: "1px solid #f1f5f9",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <SectionTitle>Contactgegevens</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Naam" fieldKey="naam" value={form.naam} onChange={set} />
              <Field label="Telefoon" fieldKey="telefoon" value={form.telefoon} onChange={set} />
              <Field label="E-mail" fieldKey="email" type="email" value={form.email} onChange={set} />
              <Field label="Regio hoofdkaart" fieldKey="regio" value={form.regio} onChange={set} />
              <Field label="Startdatum" fieldKey="startdatum" type="date" value={form.startdatum} onChange={set} />
              <Field label="Leadbron" fieldKey="leadbron" as="select" options={LEADBRONNEN} value={form.leadbron} onChange={set} />
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid #f1f5f9",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <SectionTitle>Status en opvolging</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Status" fieldKey="status" as="select" options={STATUSSEN} value={form.status} onChange={set} />
              <Field label="Leadtype" fieldKey="leadscore" as="select" options={LEADTYPES} value={form.leadscore} onChange={set} />
              <Field label="Volgende actie" fieldKey="volgendeActie" as="select" options={VOLGENDE_ACTIES} value={form.volgendeActie} onChange={set} />

              <div>
                <label style={labelStyle}>Opvolging</label>
                <select
                  value={form.geenStrengeDatum ? "geen" : "datum"}
                  onChange={(e) => set("geenStrengeDatum", e.target.value === "geen")}
                  style={inputStyle}
                >
                  <option value="geen">Geen strenge datum</option>
                  <option value="datum">Concrete opvolgdatum</option>
                </select>
              </div>

              {!form.geenStrengeDatum && (
                <Field
                  label="Concrete opvolgdatum"
                  fieldKey="opvolgdatum"
                  type="date"
                  value={form.opvolgdatum}
                  onChange={set}
                />
              )}

              <Field
                label="Laatste contactdatum"
                fieldKey="laatsteContactdatum"
                type="date"
                value={form.laatsteContactdatum}
                onChange={set}
              />

              <Field
                label="Contactmethode"
                fieldKey="contactmethode"
                as="select"
                options={CONTACTMETHODES}
                value={form.contactmethode}
                onChange={set}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #f1f5f9",
            borderRadius: 14,
            padding: 16,
          }}
        >
          <SectionTitle>Belangrijkste wensen</SectionTitle>

          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
            Klik per onderdeel open wat je wilt aanpassen. Zo blijft de lead overzichtelijk.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <WensAccordion
              title="Budget"
              fieldKey="budget"
              andersKey="budgetAnders"
              value={form.budget}
              andersValue={form.budgetAnders}
              options={WENS_OPTIES.budget}
              onChange={set}
            />

            <WensAccordion
              title="Regio"
              fieldKey="gewensteRegio"
              andersKey="gewensteRegioAnders"
              value={form.gewensteRegio}
              andersValue={form.gewensteRegioAnders}
              options={WENS_OPTIES.gewensteRegio}
              onChange={set}
            />

            <WensAccordion
              title="Woningtype"
              fieldKey="woningtype"
              andersKey="woningtypeAnders"
              value={form.woningtype}
              andersValue={form.woningtypeAnders}
              options={WENS_OPTIES.woningtype}
              onChange={set}
            />

            <WensAccordion
              title="Nieuwbouw of resale"
              fieldKey="bouwtype"
              andersKey="bouwtypeAnders"
              value={form.bouwtype}
              andersValue={form.bouwtypeAnders}
              options={WENS_OPTIES.bouwtype}
              onChange={set}
            />

            <WensAccordion
              title="Aantal slaapkamers"
              fieldKey="slaapkamers"
              andersKey="slaapkamersAnders"
              value={form.slaapkamers}
              andersValue={form.slaapkamersAnders}
              options={WENS_OPTIES.slaapkamers}
              onChange={set}
            />

            <WensAccordion
              title="Verhuurpotentie / investering"
              fieldKey="verhuurinteresse"
              andersKey="verhuurinteresseAnders"
              value={form.verhuurinteresse}
              andersValue={form.verhuurinteresseAnders}
              options={WENS_OPTIES.verhuurinteresse}
              onChange={set}
            />

            <WensAccordion
              title="Doel van aankoop"
              fieldKey="doelAankoop"
              andersKey="doelAankoopAnders"
              value={form.doelAankoop}
              andersValue={form.doelAankoopAnders}
              options={WENS_OPTIES.doelAankoop}
              onChange={set}
            />

            <WensAccordion
              title="Gewenste plaats of omgeving"
              fieldKey="gewenstePlaats"
              andersKey="gewenstePlaatsAnders"
              value={form.gewenstePlaats}
              andersValue={form.gewenstePlaatsAnders}
              options={WENS_OPTIES.gewenstePlaats}
              onChange={set}
            />

            <WensAccordion
              title="Tijdlijn aankoop"
              fieldKey="tijdshorizon"
              andersKey="tijdshorizonAnders"
              value={form.tijdshorizon}
              andersValue={form.tijdshorizonAnders}
              options={WENS_OPTIES.tijdshorizon}
              onChange={set}
            />

            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 12,
                background: "#fff",
              }}
            >
              <Field
                label="Extra wensen"
                fieldKey="extraWensen"
                as="textarea"
                rows={5}
                value={form.extraWensen}
                onChange={set}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #f1f5f9",
            borderRadius: 14,
            padding: 16,
          }}
        >
          <SectionTitle>Tags</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TAGS.map((tag) => {
              const active = form.tags?.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  style={{
                    border: `1px solid ${active ? "#6366f1" : "#e2e8f0"}`,
                    background: active ? "#eef2ff" : "#fff",
                    color: active ? "#6366f1" : "#64748b",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <Field
            label="Notities uit gesprek"
            fieldKey="notities"
            as="textarea"
            rows={8}
            value={form.notities}
            onChange={set}
          />
          <Field
            label="Korte voortgangsnotitie"
            fieldKey="voortgangsnotitie"
            as="textarea"
            rows={8}
            value={form.voortgangsnotitie}
            onChange={set}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button onClick={onClose} style={{ ...btnStyle("#64748b"), padding: "9px 18px" }}>
            Annuleren
          </button>
          <button
            onClick={save}
            style={{
              ...btnStyle("#6366f1", true),
              padding: "10px 22px",
              fontSize: 13,
            }}
          >
            <Icon name="save" size={14} /> Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [leads, setLeads] = useState(loadData);
  const [zoek, setZoek] = useState("");
  const [filterStatus, setFilterStatus] = useState("Alle");
  const [filterRegio, setFilterRegio] = useState("Alle");
  const [filterLeadscore, setFilterLeadscore] = useState("Alle");
  const [filterLeadbron, setFilterLeadbron] = useState("Alle");
  const [filterDoel, setFilterDoel] = useState("Alle");
  const [filterOpvolging, setFilterOpvolging] = useState("Alle");
  const [sorteer, setSorteer] = useState("startdatum");
  const [weergave, setWeergave] = useState("kaarten");
  const [modal, setModal] = useState(null);
  const [followUpModal, setFollowUpModal] = useState(null);

  useEffect(() => {
    saveData(leads);
  }, [leads]);

  const regioOpties = useMemo(
    () => ["Alle", ...Array.from(new Set(leads.map((l) => l.regio).filter(Boolean)))],
    [leads]
  );

  const doelOpties = useMemo(
    () => ["Alle", ...Array.from(new Set(leads.map((l) => l.doelAankoop).filter(Boolean)))],
    [leads]
  );

  const gefilterd = useMemo(() => {
    let res = leads;

    if (zoek) {
      const q = zoek.toLowerCase();
      res = res.filter(
        (l) =>
          l.naam?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.telefoon?.toLowerCase().includes(q) ||
          l.regio?.toLowerCase().includes(q) ||
          l.gewenstePlaats?.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== "Alle") res = res.filter((l) => l.status === filterStatus);
    if (filterRegio !== "Alle") res = res.filter((l) => l.regio === filterRegio);
    if (filterLeadscore !== "Alle") res = res.filter((l) => l.leadscore === filterLeadscore);
    if (filterLeadbron !== "Alle") res = res.filter((l) => l.leadbron === filterLeadbron);
    if (filterDoel !== "Alle") res = res.filter((l) => l.doelAankoop === filterDoel);

    if (filterOpvolging !== "Alle") {
      res = res.filter((l) => getOpvolgingInfo(l).type === filterOpvolging);
    }

    res = [...res].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

      if (sorteer === "startdatum") return new Date(b.startdatum) - new Date(a.startdatum);

      if (sorteer === "opvolging") {
        return getOpvolgingInfo(a).sort - getOpvolgingInfo(b).sort;
      }

      if (sorteer === "leadscore") {
        const order = {
          "Hot lead": 1,
          "Warm lead": 2,
          "Lauwe lead": 3,
          "Koude lead": 4,
        };
        return (order[a.leadscore] || 9) - (order[b.leadscore] || 9);
      }

      return 0;
    });

    return res;
  }, [
    leads,
    zoek,
    filterStatus,
    filterRegio,
    filterLeadscore,
    filterLeadbron,
    filterDoel,
    filterOpvolging,
    sorteer,
  ]);

  const stats = useMemo(
    () => ({
      open: leads.filter(isOpenLead).length,
      nieuw: leads.filter((l) => l.status === "Nieuwe lead").length,
      hotLeads: leads.filter((l) => isOpenLead(l) && l.leadscore === "Hot lead").length,
      pinned: leads.filter((l) => l.pinned).length,
      doorgegeven: leads.filter((l) => l.status === "Doorgegeven").length,
      afgerond: leads.filter((l) => l.status === "Afgerond").length,
    }),
    [leads]
  );

  function opslaanLead(form) {
    if (form.id) {
      setLeads((ls) => ls.map((l) => (l.id === form.id ? normalizeLead(form) : l)));
    } else {
      setLeads((ls) => [
        ...ls,
        normalizeLead({
          ...form,
          id: Date.now().toString(),
          startdatum: form.startdatum || todayISO(),
        }),
      ]);
    }
    setModal(null);
  }

function verwijderLead(id) {
  if (window.confirm("Weet je zeker dat je deze lead wilt verwijderen?")) {
    setLeads((ls) => ls.filter((l) => l.id !== id));
  }
}

  function wijzigStatus(id, status) {
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
  }

  function togglePin(id) {
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, pinned: !l.pinned } : l)));
  }

  function resetFilters() {
    setZoek("");
    setFilterStatus("Alle");
    setFilterRegio("Alle");
    setFilterLeadscore("Alle");
    setFilterLeadbron("Alle");
    setFilterDoel("Alle");
    setFilterOpvolging("Alle");
    setSorteer("startdatum");
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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22 }}>🇪🇸</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a" }}>
              Mijn Spanje Kompas
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              Lead- en klantvolgsysteem
            </div>
          </div>
        </div>

        <button
          onClick={() => setModal({ lead: { ...LEEG_LEAD }, isNieuw: true })}
          style={{
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 9,
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            gap: 7,
            alignItems: "center",
          }}
        >
          <Icon name="plus" size={14} /> Nieuwe lead
        </button>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "26px 24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
          <StatCard label="Totaal open leads" value={stats.open} accent="#6366f1" icon="user" />
          <StatCard label="Nieuwe leads" value={stats.nieuw} accent="#0ea5e9" icon="plus" />
          <StatCard label="Hot leads" value={stats.hotLeads} accent="#ef4444" icon="chart" />
          <StatCard label="Gepind" value={stats.pinned} accent="#f59e0b" icon="star" />
          <StatCard label="Doorgegeven" value={stats.doorgegeven} accent="#14b8a6" icon="save" />
          <StatCard label="Afgerond" value={stats.afgerond} accent="#64748b" icon="calendar" />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 330px) 1fr",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <StatusChart leads={leads} />
          <OpvolgingPanel
            leads={leads}
            onOpen={(lead) => setModal({ lead, isNieuw: false })}
            onOpenFollowUpList={(type) => setFollowUpModal(type)}
          />
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "14px 16px",
            border: "1px solid #f1f5f9",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flex: 1,
                minWidth: 210,
                background: "#f8fafc",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                padding: "8px 12px",
              }}
            >
              <Icon name="search" size={14} />
              <input
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
                placeholder="Zoeken op naam, e-mail, telefoon, regio of plaats..."
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 13,
                  flex: 1,
                  color: "#0f172a",
                  WebkitUserSelect: "text",
                  userSelect: "text",
                }}
              />
            </div>

            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
              <option value="Alle">Alle leadstatussen</option>
              {STATUSSEN.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <select value={filterRegio} onChange={(e) => setFilterRegio(e.target.value)} style={selectStyle}>
              {regioOpties.map((r) => (
                <option key={r} value={r}>
                  {r === "Alle" ? "Alle regio’s" : r}
                </option>
              ))}
            </select>

            <select value={filterLeadscore} onChange={(e) => setFilterLeadscore(e.target.value)} style={selectStyle}>
              <option value="Alle">Alle leadtypes</option>
              {LEADTYPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <select value={filterLeadbron} onChange={(e) => setFilterLeadbron(e.target.value)} style={selectStyle}>
              <option value="Alle">Alle leadbronnen</option>
              {LEADBRONNEN.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <select value={filterDoel} onChange={(e) => setFilterDoel(e.target.value)} style={selectStyle}>
              {doelOpties.map((s) => (
                <option key={s} value={s}>
                  {s === "Alle" ? "Alle aankoopdoelen" : s}
                </option>
              ))}
            </select>

            <select value={filterOpvolging} onChange={(e) => setFilterOpvolging(e.target.value)} style={selectStyle}>
              <option value="Alle">Alle opvolgdata</option>
              <option value="vandaag">Vandaag opvolgen</option>
              <option value="binnenkort">Binnenkort opvolgen</option>
              <option value="telaat">Te laat opvolgen</option>
              <option value="geen">Geen strenge datum</option>
            </select>

            <select value={sorteer} onChange={(e) => setSorteer(e.target.value)} style={selectStyle}>
              <option value="startdatum">Sorteren: nieuwste startdatum</option>
              <option value="opvolging">Sorteren: eerst opvolgen</option>
              <option value="leadscore">Sorteren: leadtype</option>
            </select>

            <button onClick={resetFilters} style={btnStyle("#64748b")}>
              Reset
            </button>
          </div>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              {gefilterd.length} resultaten · Gepinde leads staan altijd bovenaan
            </div>

            <div
              style={{
                display: "flex",
                border: "1px solid #e2e8f0",
                borderRadius: 9,
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setWeergave("kaarten")}
                style={{
                  ...viewButtonStyle,
                  background: weergave === "kaarten" ? "#eef2ff" : "#fff",
                  color: weergave === "kaarten" ? "#6366f1" : "#64748b",
                }}
              >
                <Icon name="grid" size={13} /> Kaarten
              </button>
              <button
                onClick={() => setWeergave("tabel")}
                style={{
                  ...viewButtonStyle,
                  background: weergave === "tabel" ? "#eef2ff" : "#fff",
                  color: weergave === "tabel" ? "#6366f1" : "#64748b",
                }}
              >
                <Icon name="table" size={13} /> Tabel
              </button>
            </div>
          </div>
        </div>

        {gefilterd.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Geen leads gevonden</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              Pas je filters aan of voeg een nieuwe lead toe.
            </div>
          </div>
        ) : weergave === "kaarten" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
              gap: 14,
            }}
          >
            {gefilterd.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onOpen={(lead) => setModal({ lead, isNieuw: false })}
                onDelete={verwijderLead}
                onStatusChange={wijzigStatus}
                onTogglePin={togglePin}
              />
            ))}
          </div>
        ) : (
          <LeadTable
            leads={gefilterd}
            onOpen={(lead) => setModal({ lead, isNieuw: false })}
            onDelete={verwijderLead}
            onTogglePin={togglePin}
          />
        )}
      </div>

      {modal && (
        <LeadModal
          lead={modal.lead}
          isNieuw={modal.isNieuw}
          onClose={() => setModal(null)}
          onSave={opslaanLead}
        />
      )}

      {followUpModal && (
        <FollowUpListModal
          type={followUpModal}
          leads={leads}
          onClose={() => setFollowUpModal(null)}
          onOpenLead={(lead) => {
            setFollowUpModal(null);
            setModal({ lead, isNieuw: false });
          }}
        />
      )}
    </div>
  );
}

const viewButtonStyle = {
  border: "none",
  padding: "8px 11px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
};