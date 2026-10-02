import { todayISO, addDaysISO, addMonthsISO, monthStartISO, formatMonth } from "../../crm/dates";
import { FieldWrap, inputStyle, btnStyle, C } from "../ui";

/** Maanden om uit te kiezen: 3 terug t/m 18 vooruit, plus de huidige waarde. */
function monthOptions(today, value) {
  const list = [];
  for (let i = -3; i <= 18; i += 1) list.push(addMonthsISO(today, i));
  const cur = monthStartISO(value);
  if (cur && !list.includes(cur)) list.push(cur);
  return list.sort();
}

const QUICK_DAYS = [
  { label: "Vandaag", days: 0 },
  { label: "Morgen", days: 1 },
  { label: "Over 3 dagen", days: 3 },
  { label: "Over 1 week", days: 7 },
  { label: "Over 2 weken", days: 14 },
];

const QUICK_MONTHS = [
  { label: "Deze maand", months: 0 },
  { label: "Volgende maand", months: 1 },
  { label: "Over 2 maanden", months: 2 },
  { label: "Over 3 maanden", months: 3 },
];

const chip = { ...btnStyle("neutral"), minHeight: 30, padding: "5px 11px", borderRadius: 999, fontSize: 12 };

/**
 * Datum van de volgende actie: een exacte dag óf alleen een maand
 * (als je nog niet precies weet wanneer).
 * onChange krijgt een patch: { nextActionDate, nextActionMonthOnly }.
 */
export function NextActionDateField({ value, monthOnly, onChange, error, label = "Wanneer *" }) {
  const today = todayISO();

  function setMode(toMonth) {
    if (toMonth === Boolean(monthOnly)) return;
    if (toMonth) onChange({ nextActionMonthOnly: true, nextActionDate: monthStartISO(value || today) });
    else {
      // Van maand naar dag: binnen de huidige maand → vandaag, anders de 1e van die maand.
      const start = monthStartISO(value || today);
      onChange({ nextActionMonthOnly: false, nextActionDate: start === monthStartISO(today) ? today : start });
    }
  }

  const segBtn = (on) => ({
    border: "none",
    padding: "4px 10px",
    borderRadius: 7,
    fontSize: 12,
    fontWeight: on ? 600 : 500,
    cursor: "pointer",
    fontFamily: "inherit",
    background: on ? C.surface : "transparent",
    color: on ? C.navy : C.textMuted,
    boxShadow: on ? "0 1px 2px rgba(16,42,67,0.08)" : "none",
  });

  return (
    <FieldWrap error={error}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.textBody }}>{label}</span>
        <div role="group" aria-label="Soort datum" style={{ display: "flex", gap: 2, padding: 2, background: C.surfaceSunken, borderRadius: 9, border: `1px solid ${C.borderSoft}` }}>
          <button type="button" aria-pressed={!monthOnly} onClick={() => setMode(false)} style={segBtn(!monthOnly)}>
            Exacte dag
          </button>
          <button type="button" aria-pressed={Boolean(monthOnly)} onClick={() => setMode(true)} style={segBtn(Boolean(monthOnly))}>
            Alleen maand
          </button>
        </div>
      </div>

      {monthOnly ? (
        // Een lijst met maanden werkt in elke browser (type="month" niet in Safari/Firefox).
        <select
          aria-label="Maand"
          value={monthStartISO(value)}
          onChange={(e) => onChange({ nextActionDate: e.target.value, nextActionMonthOnly: true })}
          aria-invalid={error ? true : undefined}
          style={{ ...inputStyle, cursor: "pointer", ...(error ? { border: `1px solid ${C.danger}` } : null) }}
        >
          {!value && <option value="">Kies een maand...</option>}
          {monthOptions(today, value).map((m) => (
            <option key={m} value={m}>
              {formatMonth(m)}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="date"
          aria-label="Datum"
          value={value || ""}
          onChange={(e) => onChange({ nextActionDate: e.target.value, nextActionMonthOnly: false })}
          aria-invalid={error ? true : undefined}
          style={{ ...inputStyle, ...(error ? { border: `1px solid ${C.danger}` } : null) }}
        />
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {monthOnly
          ? QUICK_MONTHS.map((q) => (
              <button key={q.label} type="button" onClick={() => onChange({ nextActionDate: addMonthsISO(today, q.months), nextActionMonthOnly: true })} style={chip}>
                {q.label}
              </button>
            ))
          : QUICK_DAYS.map((q) => (
              <button key={q.label} type="button" onClick={() => onChange({ nextActionDate: addDaysISO(today, q.days), nextActionMonthOnly: false })} style={chip}>
                {q.label}
              </button>
            ))}
      </div>
      {monthOnly && <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 6 }}>De actie telt pas als te laat wanneer de maand voorbij is.</div>}
    </FieldWrap>
  );
}
