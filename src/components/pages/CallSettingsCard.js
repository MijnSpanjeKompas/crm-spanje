import { useEffect, useState } from "react";
import { useCallFlow } from "../../crm/useCallFlow";
import { discardLocalRec, downloadLocalRec } from "../../crm/callFlow";
import { saveCallSettings, setCredit, creditStatus, formatUsd, DEFAULT_WARN_USD } from "../../crm/calls";
import { BASE_VOCAB, DEFAULT_MODEL, DEFAULT_WHISPER_HINT, MODEL_PRICES, TRANSCRIPTION_FIXES } from "../../crm/gesprekPrompt";
import { formatDateTime } from "../../crm/dates";
import { Card, InfoRow, Notice, Disclosure, Icon, btnStyle, inputStyle, labelStyle, C } from "../ui";

/** Instellingen → Gesprekken & AI: tegoed, model en woordenlijst. */
export function CallSettingsCard({ settings }) {
  const s = settings || {};
  const credit = creditStatus(s);
  const { localRecs } = useCallFlow();
  const [creditInput, setCreditInput] = useState("");
  const [warn, setWarn] = useState(String(s.creditWarnUsd ?? DEFAULT_WARN_USD));
  const [model, setModel] = useState(s.model || DEFAULT_MODEL);
  const [vocab, setVocab] = useState(s.extraVocab || "");
  const [hint, setHint] = useState(s.whisperHint || DEFAULT_WHISPER_HINT);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  // Waarden van de server overnemen zodra ze binnenkomen.
  const loadedKey = `${s.creditWarnUsd}|${s.model}|${s.extraVocab}|${s.whisperHint}`;
  useEffect(() => {
    setWarn(String(s.creditWarnUsd ?? DEFAULT_WARN_USD));
    setModel(s.model || DEFAULT_MODEL);
    setVocab(s.extraVocab || "");
    setHint(s.whisperHint || DEFAULT_WHISPER_HINT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey]);

  async function run(fn, okText) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "ok", text: okText });
    } catch (e) {
      setMsg({ tone: "error", text: e?.message || "Opslaan mislukt." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card icon="mic" title="Gesprekken & AI" style={{ gridColumn: "1 / -1" }}>
      {msg && (
        <div style={{ marginBottom: 12 }}>
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 20 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8, color: C.text }}>Claude-tegoed</div>
          <InfoRow label="Geschat resterend">
            <span style={{ color: credit.low ? C.danger : C.text, fontWeight: 600 }}>{credit.configured ? formatUsd(credit.remainingUsd) : "nog niet ingesteld"}</span>
            {credit.callsLeft !== null ? ` · ± ${credit.callsLeft} gesprekken` : ""}
          </InfoRow>
          <InfoRow label="Verbruikt sinds opwaarderen">{formatUsd(credit.spentSince)}</InfoRow>
          <InfoRow label="Gemiddeld per gesprek">{s.processedCount ? formatUsd(credit.avgUsd) : "± $0.05 (schatting)"}</InfoRow>
          <InfoRow label="Gesprekken verwerkt">{s.processedCount || 0}</InfoRow>
          {s.creditSetAt && <InfoRow label="Tegoed bijgewerkt">{formatDateTime(s.creditSetAt)}</InfoRow>}

          <label style={{ ...labelStyle, marginTop: 12 }}>Huidig tegoed volgens console.anthropic.com (in dollars)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={creditInput} onChange={(e) => setCreditInput(e.target.value.replace(",", "."))} inputMode="decimal" placeholder="bijv. 10.00" style={{ ...inputStyle, maxWidth: 160 }} />
            <button
              type="button"
              disabled={busy || !(Number(creditInput) > 0)}
              style={btnStyle("primary", true)}
              onClick={() => run(async () => {
                await setCredit(s, Number(creditInput));
                setCreditInput("");
              }, "Tegoed bijgewerkt.")}
            >
              Opslaan
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 5, lineHeight: 1.5 }}>
            Vul dit in na elke keer opwaarderen. Het CRM telt daarna zelf de kosten van elk gesprek af en waarschuwt als het bijna op is. Zet bij Anthropic auto-reload uit, dan kan het nooit meer kosten dan je tegoed.
          </div>
          <label style={{ ...labelStyle, marginTop: 12 }}>Waarschuwen onder ($)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={warn} onChange={(e) => setWarn(e.target.value.replace(",", "."))} inputMode="decimal" style={{ ...inputStyle, maxWidth: 100 }} />
            <button type="button" disabled={busy} style={btnStyle("neutral")} onClick={() => run(() => saveCallSettings({ creditWarnUsd: Math.max(0, Number(warn) || 0) }), "Opgeslagen.")}>
              Opslaan
            </button>
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8, color: C.text }}>AI en woordenlijst</div>
          <label style={labelStyle}>AI-model voor de samenvattingen</label>
          <select value={model} onChange={(e) => setModel(e.target.value)} style={{ ...inputStyle, background: C.surface }}>
            {Object.entries(MODEL_PRICES).map(([id, p]) => (
              <option key={id} value={id}>
                {p.label}
              </option>
            ))}
          </select>

          <label style={{ ...labelStyle, marginTop: 12 }}>Eigen woordenlijst (één per regel)</label>
          <textarea value={vocab} onChange={(e) => setVocab(e.target.value)} rows={5} placeholder={"Hondón de las Nieves\nLa Romana\nnaam van een project of urbanisatie"} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
          <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 4 }}>Plaatsen, projecten of termen die vaak terugkomen en nog niet in de standaardlijst staan. De AI schrijft ze dan altijd goed.</div>

          <label style={{ ...labelStyle, marginTop: 12 }}>Hint voor de transcriptie (kort houden)</label>
          <textarea value={hint} onChange={(e) => setHint(e.target.value.slice(0, 800))} rows={4} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
          <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 4 }}>
            Zet hier de belangrijkste namen in die vaak verkeerd verstaan worden. Alleen het begin (± 200 woorden) wordt gebruikt.{" "}
            <button type="button" className="msk-link" style={{ border: "none", background: "none", padding: 0, color: C.navy, cursor: "pointer", fontSize: 11.5 }} onClick={() => setHint(DEFAULT_WHISPER_HINT)}>
              Standaard terugzetten
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            style={{ ...btnStyle("primary", true), marginTop: 12 }}
            onClick={() => run(() => saveCallSettings({ model, extraVocab: vocab.trim(), whisperHint: hint.trim() || DEFAULT_WHISPER_HINT }), "AI-instellingen opgeslagen.")}
          >
            <Icon name="save" size={14} /> Opslaan
          </button>

          <Disclosure summary="Standaard woordenlijst bekijken">
            <div style={{ fontSize: 12, color: C.textBody, lineHeight: 1.6 }}>
              {Object.entries(BASE_VOCAB).map(([group, words]) => (
                <p key={group} style={{ margin: "0 0 6px" }}>
                  <strong>{group}:</strong> {words.join(", ")}
                </p>
              ))}
              <p style={{ margin: 0 }}>
                <strong>Correcties:</strong> {TRANSCRIPTION_FIXES.join(" · ")}
              </p>
            </div>
          </Disclosure>
        </div>
      </div>

      {localRecs.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8, color: C.text }}>Opnames op dit toestel (nog niet geüpload)</div>
          {localRecs.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "8px 0", borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{ fontSize: 13, flex: 1 }}>
                {r.leadName || "Onbekende lead"} · {formatDateTime(new Date(r.startedAt))}
              </span>
              <button type="button" style={btnStyle("neutral")} onClick={() => downloadLocalRec(r).catch((e) => setMsg({ tone: "error", text: e.message }))}>
                <Icon name="download" size={14} /> Downloaden
              </button>
              <button
                type="button"
                style={btnStyle("danger")}
                onClick={() => window.confirm("Deze opname definitief van dit toestel verwijderen?") && discardLocalRec(r)}
              >
                Weggooien
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
