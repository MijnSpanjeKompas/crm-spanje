import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  setDoc,
  doc,
  deleteDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";

// ─── VASTE OPTIES ────────────────────────────────────────────────────────────

const STATUSSEN = [
  "Nieuwe lead",
  "Intake gepland",
  "Intake gehad",
  "Zoekprofiel duidelijk",
  "Woningvoorstellen gestuurd",
  "Doorgegeven",
  "Afgerond",
  "Niet doorgegaan",
];

const STATUS_CONFIG = {
  "Nieuwe lead": { color: "#6366f1", bg: "#eef2ff" },
  "Intake gepland": { color: "#0ea5e9", bg: "#e0f2fe" },
  "Intake gehad": { color: "#8b5cf6", bg: "#f3e8ff" },
  "Zoekprofiel duidelijk": { color: "#14b8a6", bg: "#ccfbf1" },
  "Woningvoorstellen gestuurd": { color: "#f59e0b", bg: "#fffbeb" },
  Doorgegeven: { color: "#10b981", bg: "#ecfdf5" },
  Afgerond: { color: "#64748b", bg: "#f1f5f9" },
  "Niet doorgegaan": { color: "#94a3b8", bg: "#f8fafc" },
};

const LEADBRONNEN = [
  "Website",
  "Meta Ads",
  "Google Ads",
  "Organisch",
  "Via-via",
  "Partner",
  "Anders",
];

const LEADSCORES = ["A-lead", "B-lead", "C-lead"];

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

const LEEG_LEAD = {
  naam: "",
  telefoon: "",
  email: "",
  regio: "",
  status: "Nieuwe lead",
  startdatum: new Date().toISOString().split("T")[0],
  leadbron: "Website",
  leadscore: "B-lead",
  volgendeActie: "Intake plannen",
  opvolgdatum: "",
  geenStrengeDatum: true,
  laatsteContactdatum: "",
  contactmethode: "Nog geen contact",
  tags: [],
  gewensteRegio: "",
  gewenstePlaats: "",
  woningtype: "",
  bouwtype: "",
  slaapkamers: "",
  budget: "",
  doelAankoop: "",
  verhuurinteresse: "",
  tijdshorizon: "",
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
    status: "Zoekprofiel duidelijk",
    startdatum: "2026-04-18",
    leadbron: "Website",
    leadscore: "A-lead",
    volgendeActie: "Woningvoorstellen sturen",
    opvolgdatum: "2026-05-12",
    geenStrengeDatum: false,
    laatsteContactdatum: "2026-05-04",
    contactmethode: "Telefoon",
    tags: ["Emigratie", "Tweede woning", "Urgent"],
    gewensteRegio: "Costa Blanca Noord",
    gewenstePlaats: "Altea / Jávea",
    woningtype: "Villa",
    bouwtype: "Bestaande bouw",
    slaapkamers: "3+",
    budget: "€ 300.000 – € 400.000",
    doelAankoop: "Pensioen / langere verblijven",
    verhuurinteresse: "Nee",
    tijdshorizon: "Binnen 6 maanden",
    notities:
      "Vriendelijk stel dat zich serieus oriënteert op een woning voor hun pensioen. Ze zoeken rust, zee in de buurt en willen zekerheid over het aankoopproces.",
    voortgangsnotitie: "Zoekprofiel is duidelijk. Volgende stap: passende woningen sturen.",
  },
  {
    id: "2",
    naam: "Marieke Janssen",
    telefoon: "+31 6 98 76 54 32",
    email: "marieke.janssen@outlook.com",
    regio: "Costa del Sol",
    status: "Intake gehad",
    startdatum: "2026-04-25",
    leadbron: "Meta Ads",
    leadscore: "B-lead",
    volgendeActie: "Wensen controleren",
    opvolgdatum: "2026-05-10",
    geenStrengeDatum: false,
    laatsteContactdatum: "2026-05-02",
    contactmethode: "Videocall",
    tags: ["Vakantiehuis", "Verhuurinteresse", "Oriënterend"],
    gewensteRegio: "Costa del Sol",
    gewenstePlaats: "Málaga omgeving",
    woningtype: "Appartement",
    bouwtype: "Nieuwbouw of bestaande bouw",
    slaapkamers: "2",
    budget: "€ 200.000 – € 300.000",
    doelAankoop: "Vakantiehuis met verhuurmogelijkheid",
    verhuurinteresse: "Ja",
    tijdshorizon: "6 tot 12 maanden",
    notities:
      "Marieke zoekt een appartement dat ze zelf kan gebruiken en deels wil verhuren. Ze wil vooral beter begrijpen wat realistische verhuuropbrengsten zijn.",
    voortgangsnotitie: "Nog controleren of Costa del Sol binnen budget realistisch genoeg is.",
  },
  {
    id: "3",
    naam: "Peter & Inge Smits",
    telefoon: "+32 476 11 22 33",
    email: "smitsfamilie@telenet.be",
    regio: "Costa Cálida",
    status: "Woningvoorstellen gestuurd",
    startdatum: "2026-03-30",
    leadbron: "Organisch",
    leadscore: "A-lead",
    volgendeActie: "Wachten op reactie",
    opvolgdatum: "2026-05-06",
    geenStrengeDatum: false,
    laatsteContactdatum: "2026-04-29",
    contactmethode: "WhatsApp",
    tags: ["Emigratie", "Bestaande bouw"],
    gewensteRegio: "Costa Cálida",
    gewenstePlaats: "Los Alcázares / San Pedro del Pinatar",
    woningtype: "Townhouse",
    bouwtype: "Bestaande bouw",
    slaapkamers: "3",
    budget: "€ 250.000 – € 325.000",
    doelAankoop: "Permanente bewoning",
    verhuurinteresse: "Nee",
    tijdshorizon: "Binnen 3 maanden",
    notities:
      "Belgisch koppel. Ze twijfelen vooral over zorg, taal en papierwerk. Woningwensen zijn concreet.",
    voortgangsnotitie: "Voorstellen verstuurd. Reactie afwachten en daarna eventueel doorgeven.",
  },
  {
    id: "4",
    naam: "Thomas Groen",
    telefoon: "+31 6 55 44 33 22",
    email: "t.groen@icloud.com",
    regio: "Alicante",
    status: "Nieuwe lead",
    startdatum: "2026-05-03",
    leadbron: "Google Ads",
    leadscore: "B-lead",
    volgendeActie: "Intake plannen",
    opvolgdatum: "",
    geenStrengeDatum: true,
    laatsteContactdatum: "",
    contactmethode: "Intakeformulier",
    tags: ["Investering", "Nieuwbouw"],
    gewensteRegio: "Costa Blanca Zuid",
    gewenstePlaats: "Alicante / Torrevieja",
    woningtype: "Appartement",
    bouwtype: "Nieuwbouw",
    slaapkamers: "2",
    budget: "€ 200.000 – € 275.000",
    doelAankoop: "Investering",
    verhuurinteresse: "Ja",
    tijdshorizon: "Oriënterend",
    notities:
      "Lead via formulier. Wil vooral weten wat interessant is qua rendement en verhuurpotentie.",
    voortgangsnotitie: "Nog geen contact gehad. Intake plannen.",
  },
  {
    id: "5",
    naam: "Ans & Cor Visser",
    telefoon: "+31 6 22 33 44 55",
    email: "ansencor@kpnmail.nl",
    regio: "Costa Cálida",
    status: "Afgerond",
    startdatum: "2025-10-05",
    leadbron: "Via-via",
    leadscore: "A-lead",
    volgendeActie: "Geen directe actie",
    opvolgdatum: "",
    geenStrengeDatum: true,
    laatsteContactdatum: "2026-02-15",
    contactmethode: "E-mail",
    tags: ["Tweede woning", "Bestaande bouw"],
    gewensteRegio: "Costa Cálida",
    gewenstePlaats: "Lo Pagán",
    woningtype: "Villa",
    bouwtype: "Bestaande bouw",
    slaapkamers: "3",
    budget: "€ 310.000",
    doelAankoop: "Tweede woning",
    verhuurinteresse: "Nee",
    tijdshorizon: "Aangekocht",
    notities:
      "Traject afgerond. Ze hebben een woning gekocht in Lo Pagán en waren tevreden over de begeleiding.",
    voortgangsnotitie: "Afgerond. Mogelijk later testimonial vragen.",
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function vandaag() {
  return new Date().toISOString().split("T")[0];
}

function datumObject(datum) {
  if (!datum) return null;
  return new Date(`${datum}T00:00:00`);
}

function verschilInDagen(datum) {
  const doel = datumObject(datum);
  const nu = datumObject(vandaag());
  if (!doel || !nu) return null;
  return Math.round((doel - nu) / (1000 * 60 * 60 * 24));
}

function formatDatum(datum) {
  if (!datum) return "–";
  return new Date(`${datum}T00:00:00`).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isOpenLead(lead) {
  return lead.status !== "Afgerond" && lead.status !== "Niet doorgegaan";
}

function getOpvolgingInfo(lead) {
  if (lead.geenStrengeDatum || !lead.opvolgdatum) {
    return {
      type: "geen",
      label: "Geen strenge datum",
      color: "#64748b",
      bg: "#f8fafc",
    };
  }

  const diff = verschilInDagen(lead.opvolgdatum);

  if (diff === 0) {
    return {
      type: "vandaag",
      label: "Vandaag opvolgen",
      color: "#f59e0b",
      bg: "#fffbeb",
    };
  }

  if (diff === 1) {
    return {
      type: "binnenkort",
      label: "Morgen opvolgen",
      color: "#0ea5e9",
      bg: "#e0f2fe",
    };
  }

  if (diff > 1) {
    return {
      type: diff <= 7 ? "binnenkort" : "later",
      label: `Over ${diff} dagen opvolgen`,
      color: diff <= 7 ? "#0ea5e9" : "#64748b",
      bg: diff <= 7 ? "#e0f2fe" : "#f8fafc",
    };
  }

  const teLaat = Math.abs(diff);

  return {
    type: "telaat",
    label: `${teLaat} ${teLaat === 1 ? "dag" : "dagen"} te laat`,
    color: "#ef4444",
    bg: "#fef2f2",
  };
}

function normalizeLead(lead) {
  return {
    ...LEEG_LEAD,
    ...lead,
    status: STATUSSEN.includes(lead.status) ? lead.status : "Nieuwe lead",
    leadbron: lead.leadbron || "Website",
    leadscore: lead.leadscore || "B-lead",
    volgendeActie: lead.volgendeActie || "Geen directe actie",
    geenStrengeDatum:
      typeof lead.geenStrengeDatum === "boolean"
        ? lead.geenStrengeDatum
        : !lead.opvolgdatum,
    tags: Array.isArray(lead.tags) ? lead.tags : [],
  };
}

async function seedDemoLeadsIfEmpty() {
  const snapshot = await getDocs(collection(db, "leads"));

  if (!snapshot.empty) return;

  const batch = writeBatch(db);

  DEMO_LEADS.forEach((lead) => {
    const leadRef = doc(db, "leads", lead.id);
    batch.set(leadRef, normalizeLead(lead));
  });

  await batch.commit();
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

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

const cardStyle = {
  background: "#fff",
  borderRadius: 14,
  border: "1px solid #f1f5f9",
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
};

function btnStyle(color, solid = false) {
  return {
    background: solid ? color : `${color}12`,
    color: solid ? "#fff" : color,
    border: solid ? "none" : `1px solid ${color}30`,
    borderRadius: 8,
    padding: "7px 10px",
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
  };
}

// ─── KLEINE COMPONENTEN ──────────────────────────────────────────────────────

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
  return (
    <Badge color={cfg.color} bg={cfg.bg}>
      {status}
    </Badge>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div
      style={{
        ...cardStyle,
        padding: "14px 16px",
        flex: 1,
        minWidth: 145,
      }}
    >
      <div
        style={{
          color,
          fontSize: 11,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: ".04em",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 27, fontWeight: 900, color: "#0f172a" }}>
        {value}
      </div>
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
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
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

// ─── OPVOLGING BLOK ──────────────────────────────────────────────────────────

function OpvolgingPanel({ leads, onOpen }) {
  const openLeads = leads.filter(isOpenLead);

  const groepen = {
    "Te laat": openLeads.filter((l) => getOpvolgingInfo(l).type === "telaat"),
    Vandaag: openLeads.filter((l) => getOpvolgingInfo(l).type === "vandaag"),
    Binnenkort: openLeads.filter((l) => getOpvolgingInfo(l).type === "binnenkort"),
    "Geen strenge datum": openLeads.filter((l) => getOpvolgingInfo(l).type === "geen"),
  };

  return (
    <div style={{ ...cardStyle, padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", marginBottom: 12 }}>
        Rustige opvolging
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {Object.entries(groepen).map(([titel, items]) => (
          <div
            key={titel}
            style={{
              background: "#f8fafc",
              border: "1px solid #eef2f7",
              borderRadius: 12,
              padding: 10,
              minHeight: 90,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>
              {titel} ({items.length})
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.slice(0, 3).map((lead) => {
                const info = getOpvolgingInfo(lead);

                return (
                  <button
                    key={lead.id}
                    onClick={() => onOpen(lead)}
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
                      {lead.naam}
                    </div>
                    <div style={{ fontSize: 11, color: info.color, marginTop: 2 }}>
                      {info.label}
                    </div>
                  </button>
                );
              })}

              {!items.length && (
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Geen leads</div>
              )}

              {items.length > 3 && (
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  +{items.length - 3} meer
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── STATUS BLOK ─────────────────────────────────────────────────────────────

function StatusChart({ leads }) {
  const counts = {};

  STATUSSEN.forEach((status) => {
    counts[status] = leads.filter((l) => l.status === status).length;
  });

  const max = Math.max(...Object.values(counts), 1);

  return (
    <div style={{ ...cardStyle, padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", marginBottom: 12 }}>
        Leads per status
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {STATUSSEN.map((status) => (
          <div key={status} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 135, fontSize: 11, color: "#64748b" }}>{status}</div>

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
                  width: `${(counts[status] / max) * 100}%`,
                  height: "100%",
                  background: STATUS_CONFIG[status]?.color || "#94a3b8",
                  borderRadius: 6,
                }}
              />
            </div>

            <div style={{ width: 18, fontSize: 11, fontWeight: 800, textAlign: "right" }}>
              {counts[status]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LEAD KAART ──────────────────────────────────────────────────────────────

function LeadCard({ lead, onOpen, onDelete, onStatusChange }) {
  const opvolging = getOpvolgingInfo(lead);
  const scoreColor =
    lead.leadscore === "A-lead"
      ? "#10b981"
      : lead.leadscore === "B-lead"
      ? "#f59e0b"
      : "#64748b";

  return (
    <div
      style={{
        ...cardStyle,
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
          <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>
            {lead.naam}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
            📍 {lead.regio || "Regio onbekend"}
          </div>
        </div>

        <StatusBadge status={lead.status} />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Badge color={scoreColor} bg={`${scoreColor}12`}>
          {lead.leadscore}
        </Badge>
        <Badge color="#6366f1" bg="#eef2ff">
          {lead.leadbron}
        </Badge>
        {lead.tags?.slice(0, 3).map((tag) => (
          <Badge key={tag}>{tag}</Badge>
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
            maxWidth: 175,
          }}
        >
          {STATUSSEN.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 7 }}>
          <button onClick={() => onOpen(lead)} style={btnStyle("#6366f1")}>
            Openen
          </button>
          <button onClick={() => onDelete(lead.id)} style={btnStyle("#ef4444")}>
            Verwijderen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TABEL ───────────────────────────────────────────────────────────────────

function LeadTable({ leads, onOpen, onDelete }) {
  return (
    <div style={{ ...cardStyle, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {[
              "Naam",
              "Status",
              "Regio",
              "Budget",
              "Leadscore",
              "Leadbron",
              "Volgende actie",
              "Opvolging",
              "Laatste contact",
              "",
            ].map((heading) => (
              <th
                key={heading}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  fontSize: 11,
                  color: "#64748b",
                  textTransform: "uppercase",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                {heading}
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
                <td style={tdStyle}>{lead.leadscore || "–"}</td>
                <td style={tdStyle}>{lead.leadbron || "–"}</td>
                <td style={tdStyle}>{lead.volgendeActie || "–"}</td>
                <td style={{ ...tdStyle, color: opvolging.color, fontWeight: 700 }}>
                  {opvolging.label}
                </td>
                <td style={tdStyle}>{formatDatum(lead.laatsteContactdatum)}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => onOpen(lead)} style={btnStyle("#6366f1")}>
                      Open
                    </button>
                    <button onClick={() => onDelete(lead.id)} style={btnStyle("#ef4444")}>
                      Weg
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

// ─── MODAL ───────────────────────────────────────────────────────────────────

function LeadModal({ lead, onClose, onSave, isNieuw }) {
  const [form, setForm] = useState(lead);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleTag(tag) {
    setForm((f) => {
      const current = Array.isArray(f.tags) ? f.tags : [];

      return {
        ...f,
        tags: current.includes(tag)
          ? current.filter((t) => t !== tag)
          : [...current, tag],
      };
    });
  }

  function opslaan() {
    const cleanForm = {
      ...form,
      opvolgdatum: form.geenStrengeDatum ? "" : form.opvolgdatum,
    };

    onSave(cleanForm);
  }

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
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
              {isNieuw ? "Nieuwe lead toevoegen" : form.naam || "Lead bewerken"}
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
              fontSize: 24,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={{ ...cardStyle, padding: 16 }}>
            <SectionTitle>Contactgegevens</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Naam" fieldKey="naam" value={form.naam} onChange={set} />
              <Field label="Telefoon" fieldKey="telefoon" value={form.telefoon} onChange={set} />
              <Field label="E-mail" fieldKey="email" value={form.email} onChange={set} />
              <Field label="Regio hoofdkaart" fieldKey="regio" value={form.regio} onChange={set} />
              <Field label="Startdatum" fieldKey="startdatum" type="date" value={form.startdatum} onChange={set} />
              <Field label="Leadbron" fieldKey="leadbron" as="select" options={LEADBRONNEN} value={form.leadbron} onChange={set} />
            </div>
          </div>

          <div style={{ ...cardStyle, padding: 16 }}>
            <SectionTitle>Status en opvolging</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Status" fieldKey="status" as="select" options={STATUSSEN} value={form.status} onChange={set} />
              <Field label="Leadscore" fieldKey="leadscore" as="select" options={LEADSCORES} value={form.leadscore} onChange={set} />
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
                <Field label="Opvolgdatum" fieldKey="opvolgdatum" type="date" value={form.opvolgdatum} onChange={set} />
              )}

              <Field label="Laatste contactdatum" fieldKey="laatsteContactdatum" type="date" value={form.laatsteContactdatum} onChange={set} />
              <Field label="Contactmethode" fieldKey="contactmethode" as="select" options={CONTACTMETHODES} value={form.contactmethode} onChange={set} />
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 16 }}>
          <SectionTitle>Belangrijkste wensen</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            <Field label="Gewenste regio" fieldKey="gewensteRegio" value={form.gewensteRegio} onChange={set} />
            <Field label="Gewenste plaats" fieldKey="gewenstePlaats" value={form.gewenstePlaats} onChange={set} />
            <Field label="Woningtype" fieldKey="woningtype" value={form.woningtype} onChange={set} />
            <Field label="Nieuwbouw of bestaande bouw" fieldKey="bouwtype" value={form.bouwtype} onChange={set} />
            <Field label="Aantal slaapkamers" fieldKey="slaapkamers" value={form.slaapkamers} onChange={set} />
            <Field label="Budget" fieldKey="budget" value={form.budget} onChange={set} />
            <Field label="Doel aankoop" fieldKey="doelAankoop" value={form.doelAankoop} onChange={set} />
            <Field label="Verhuurinteresse" fieldKey="verhuurinteresse" value={form.verhuurinteresse} onChange={set} />
            <Field label="Tijdshorizon" fieldKey="tijdshorizon" value={form.tijdshorizon} onChange={set} />
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 16 }}>
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
          <Field label="Notities uit gesprek" fieldKey="notities" as="textarea" rows={8} value={form.notities} onChange={set} />
          <Field label="Korte voortgangsnotitie" fieldKey="voortgangsnotitie" as="textarea" rows={8} value={form.voortgangsnotitie} onChange={set} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button onClick={onClose} style={{ ...btnStyle("#64748b"), padding: "9px 18px" }}>
            Annuleren
          </button>
          <button onClick={opslaan} style={{ ...btnStyle("#6366f1", true), padding: "10px 22px" }}>
            Opslaan
          </button>
        </div>
      </div>
    </div>
  );
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

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function App() {
  const [leads, setLeads] = useState([]);
  const [laden, setLaden] = useState(true);
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
  const demoSeedGedaan = useRef(false);

  useEffect(() => {
    if (!demoSeedGedaan.current) {
      demoSeedGedaan.current = true;
      seedDemoLeadsIfEmpty();
    }

    const unsubscribe = onSnapshot(collection(db, "leads"), (snapshot) => {
      const firebaseLeads = snapshot.docs.map((document) =>
        normalizeLead({
          ...document.data(),
          id: document.id,
        })
      );

      setLeads(firebaseLeads);
      setLaden(false);
    });

    return () => unsubscribe();
  }, []);

  const regioOpties = useMemo(() => {
    return ["Alle", ...Array.from(new Set(leads.map((l) => l.regio).filter(Boolean)))];
  }, [leads]);

  const doelOpties = useMemo(() => {
    return ["Alle", ...Array.from(new Set(leads.map((l) => l.doelAankoop).filter(Boolean)))];
  }, [leads]);

  const gefilterd = useMemo(() => {
    let res = leads;

    if (zoek) {
      const q = zoek.toLowerCase();

      res = res.filter(
        (l) =>
          l.naam?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.regio?.toLowerCase().includes(q)
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
      if (sorteer === "startdatum") return new Date(b.startdatum) - new Date(a.startdatum);

      if (sorteer === "opvolging") {
        const aDate = a.geenStrengeDatum || !a.opvolgdatum ? "9999-12-31" : a.opvolgdatum;
        const bDate = b.geenStrengeDatum || !b.opvolgdatum ? "9999-12-31" : b.opvolgdatum;
        return aDate.localeCompare(bDate);
      }

      if (sorteer === "leadscore") {
        const order = { "A-lead": 1, "B-lead": 2, "C-lead": 3 };
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

  const stats = useMemo(() => {
    return {
      open: leads.filter(isOpenLead).length,
      nieuw: leads.filter((l) => l.status === "Nieuwe lead").length,
      aLeads: leads.filter((l) => isOpenLead(l) && l.leadscore === "A-lead").length,
      doorgegeven: leads.filter((l) => l.status === "Doorgegeven").length,
      afgerond: leads.filter((l) => l.status === "Afgerond").length,
    };
  }, [leads]);

  async function opslaanLead(form) {
    const leadData = normalizeLead({
      ...form,
      startdatum: form.startdatum || vandaag(),
    });

    if (leadData.id) {
      await setDoc(doc(db, "leads", leadData.id), leadData);
    } else {
      const { id, ...newLead } = leadData;
      await addDoc(collection(db, "leads"), newLead);
    }

    setModal(null);
  }

  async function verwijderLead(id) {
    if (window.confirm("Weet je zeker dat je deze lead wilt verwijderen?")) {
      await deleteDoc(doc(db, "leads", id));
    }
  }

  async function wijzigStatus(id, status) {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;

    await setDoc(doc(db, "leads", id), {
      ...lead,
      status,
    });
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

  if (laden) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#64748b",
          background: "#f8fafc",
        }}
      >
        CRM wordt geladen...
      </div>
    );
  }

  return (
    <div
      style={{
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
        <div>
          <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a" }}>
            🇪🇸 Mijn Spanje Kompas
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            Realtime lead- en klantvolgsysteem
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
          }}
        >
          + Nieuwe lead
        </button>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "26px 24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
          <StatCard label="Totaal open leads" value={stats.open} color="#6366f1" />
          <StatCard label="Nieuwe leads" value={stats.nieuw} color="#0ea5e9" />
          <StatCard label="A-leads" value={stats.aLeads} color="#10b981" />
          <StatCard label="Doorgegeven" value={stats.doorgegeven} color="#14b8a6" />
          <StatCard label="Afgerond" value={stats.afgerond} color="#64748b" />
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
          <OpvolgingPanel leads={leads} onOpen={(lead) => setModal({ lead, isNieuw: false })} />
        </div>

        <div
          style={{
            ...cardStyle,
            padding: "14px 16px",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoeken op naam, e-mail of regio..."
              style={{
                ...inputStyle,
                flex: 1,
                minWidth: 220,
                background: "#fff",
              }}
            />

            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
              <option>Alle</option>
              {STATUSSEN.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <select value={filterRegio} onChange={(e) => setFilterRegio(e.target.value)} style={selectStyle}>
              {regioOpties.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>

            <select value={filterLeadscore} onChange={(e) => setFilterLeadscore(e.target.value)} style={selectStyle}>
              <option>Alle</option>
              {LEADSCORES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <select value={filterLeadbron} onChange={(e) => setFilterLeadbron(e.target.value)} style={selectStyle}>
              <option>Alle</option>
              {LEADBRONNEN.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <select value={filterDoel} onChange={(e) => setFilterDoel(e.target.value)} style={selectStyle}>
              {doelOpties.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <select value={filterOpvolging} onChange={(e) => setFilterOpvolging(e.target.value)} style={selectStyle}>
              <option value="Alle">Alle opvolging</option>
              <option value="vandaag">Vandaag</option>
              <option value="binnenkort">Binnenkort</option>
              <option value="telaat">Te laat</option>
              <option value="geen">Geen strenge datum</option>
            </select>

            <select value={sorteer} onChange={(e) => setSorteer(e.target.value)} style={selectStyle}>
              <option value="startdatum">Sorteren: startdatum</option>
              <option value="opvolging">Sorteren: opvolging</option>
              <option value="leadscore">Sorteren: leadscore</option>
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
              {gefilterd.length} resultaten
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setWeergave("kaarten")}
                style={btnStyle(weergave === "kaarten" ? "#6366f1" : "#64748b")}
              >
                Kaarten
              </button>
              <button
                onClick={() => setWeergave("tabel")}
                style={btnStyle(weergave === "tabel" ? "#6366f1" : "#64748b")}
              >
                Tabel
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
              />
            ))}
          </div>
        ) : (
          <LeadTable
            leads={gefilterd}
            onOpen={(lead) => setModal({ lead, isNieuw: false })}
            onDelete={verwijderLead}
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
    </div>
  );
}