import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime, toMillis } from "../../crm/dates";
import { useCallFlow } from "../../crm/useCallFlow";
import {
  startRecording,
  stopRecording,
  updateRecordingNotes,
  addAudioFile,
  retryLocalRec,
  discardLocalRec,
  downloadLocalRec,
  startProcessing,
  recordingSupported,
  clearJob,
} from "../../crm/callFlow";
import {
  approveCall,
  reopenCall,
  deleteCall,
  saveCallResult,
  getCallAudioUrl,
  creditStatus,
  formatUsd,
  toWhatsApp,
  markdownToHtml,
  openSummaryPdf,
  copyText,
  STALE_PROCESSING_MS,
  AUDIO_DELETE_DAYS,
} from "../../crm/calls";
import { Card, Notice, Icon, Badge, MoreMenu, btnStyle, inputStyle, labelStyle, formatBytes, C } from "../ui";

const STATUS = {
  uploading: { label: "Uploaden", color: C.info, bg: C.infoBg },
  uploaded: { label: "Wacht op verwerking", color: C.info, bg: C.infoBg },
  processing: { label: "Bezig", color: C.info, bg: C.infoBg },
  done: { label: "Klaar om te checken", color: C.goldText, bg: C.goldSoft },
  error: { label: "Fout", color: C.danger, bg: C.dangerBg },
  approved: { label: "Goedgekeurd", color: C.success, bg: C.successBg },
};

function fmtDuration(ms) {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function isStale(call) {
  if (call.status !== "processing" && call.status !== "uploaded") return false;
  const since = toMillis(call.processingStartedAt) || toMillis(call.uploadedAt) || 0;
  return since > 0 && Date.now() - since > STALE_PROCESSING_MS;
}

function CopyButton({ text, label = "Kopiëren", tone = "neutral", solid = false }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      style={btnStyle(tone, solid)}
      onClick={async () => {
        const ok = await copyText(text);
        setDone(ok);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      <Icon name={done ? "check" : "copy"} size={14} /> {done ? "Gekopieerd" : label}
    </button>
  );
}

/** Tekstblok met bewerken (opslaan bij verlaten van het veld). */
function TextBlock({ title, hint, value, onSave, readOnly, rows = 6, markdown, actions }) {
  const [draft, setDraft] = useState(value || "");
  const [editing, setEditing] = useState(!markdown);
  const [saving, setSaving] = useState(false);
  const lastSaved = useRef(value || "");
  useEffect(() => {
    // Nieuwe waarde van de server (bijv. na opnieuw verwerken) overnemen als je niet aan het typen bent.
    if (value !== lastSaved.current) {
      lastSaved.current = value || "";
      setDraft(value || "");
    }
  }, [value]);
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  async function save() {
    if (readOnly || draft === lastSaved.current) return;
    setSaving(true);
    try {
      await onSave(draft);
      lastSaved.current = draft;
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title={title}
      right={
        <span style={{ fontSize: 11.5, color: C.textSubtle }}>
          {saving ? "Opslaan…" : `${words} woorden`}
        </span>
      }
    >
      {hint && <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>{hint}</div>}
      {markdown && !editing ? (
        <div
          className="msk-md"
          style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6, background: C.surfaceSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: "12px 16px", maxHeight: 520, overflowY: "auto" }}
          // markdownToHtml escapet alle tekst; alleen eigen tags worden toegevoegd.
          dangerouslySetInnerHTML={{ __html: markdownToHtml(draft) }}
        />
      ) : (
        <textarea
          value={draft}
          readOnly={readOnly}
          rows={rows}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55, fontSize: 13.5 }}
        />
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {markdown && !readOnly && (
          <button
            type="button"
            style={btnStyle("neutral")}
            onClick={async () => {
              if (editing) await save();
              setEditing(!editing);
            }}
          >
            <Icon name={editing ? "eye" : "edit"} size={14} /> {editing ? "Voorbeeld" : "Bewerken"}
          </button>
        )}
        {actions && actions(draft)}
      </div>
    </Card>
  );
}

function ZekerWetenFields({ value, onChange, disabled }) {
  const field = (key, label, props = {}) => (
    <div style={{ flex: "1 1 200px" }}>
      <label style={labelStyle}>{label}</label>
      <input
        value={value[key] || ""}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        style={inputStyle}
        {...props}
      />
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {field("naam", "Naam (exact)", { autoComplete: "off" })}
        {field("telefoon", "Telefoon", { inputMode: "tel", autoComplete: "off" })}
      </div>
      <div>
        <label style={labelStyle}>Zeker weten (optioneel)</label>
        <textarea
          value={value.notitie || ""}
          onChange={(e) => onChange({ ...value, notitie: e.target.value })}
          rows={2}
          placeholder="Bijv. budget max €350.000 incl. kosten · partner heet Marieke · in maart in Spanje"
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />
        <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 4 }}>Wat hier staat, neemt de AI letterlijk over. Je kunt dit ook tijdens het gesprek invullen.</div>
      </div>
    </div>
  );
}

// ─── HOOFDCOMPONENT ──────────────────────────────────────────────────────────
export function CallsTab({ lead, form, set, user, calls, settings }) {
  const flow = useCallFlow();
  const [zeker, setZeker] = useState(() => ({ naam: form.name || "", telefoon: form.phone || "", notitie: "" }));
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [showNew, setShowNew] = useState(false);
  const fileRef = useRef(null);

  const rec = flow.recording;
  const recordingHere = rec && rec.leadId === lead.id;
  const recordingElsewhere = rec && rec.leadId !== lead.id;
  const jobs = Object.entries(flow.jobs)
    .map(([callId, j]) => ({ callId, ...j }))
    .filter((j) => j.leadId === lead.id);
  const jobIds = new Set(jobs.map((j) => j.callId));
  const localRecs = flow.localRecs.filter((r) => r.leadId === lead.id && !jobIds.has(r.callId));
  const credit = creditStatus(settings);

  const sorted = useMemo(() => [...(calls.items || [])].sort((a, b) => (toMillis(b.createdAt) || 0) - (toMillis(a.createdAt) || 0)), [calls.items]);
  const selected = sorted.find((c) => c.id === selectedId) || sorted[0] || null;
  const latestId = sorted[0]?.id;

  // Na een nieuwe upload automatisch het nieuwste gesprek tonen.
  useEffect(() => {
    if (latestId) setSelectedId(latestId);
  }, [latestId]);

  // Tijdens opnemen: notitie live meesturen.
  useEffect(() => {
    if (recordingHere) updateRecordingNotes(zeker);
  }, [zeker, recordingHere]);

  // Lopende opname: notitie uit de opname tonen (bijv. na wisselen van tabblad).
  const recNotes = recordingHere ? rec.zekerWeten : null;
  const restoredRef = useRef(false);
  useEffect(() => {
    if (recNotes && !restoredRef.current) {
      restoredRef.current = true;
      setZeker(recNotes);
    }
  }, [recNotes]);

  async function run(label, fn) {
    setError("");
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      setError(e?.message || "Er ging iets mis.");
    } finally {
      setBusy("");
    }
  }

  const start = () => run("start", () => startRecording({ lead: { ...lead, name: zeker.naam || lead.name }, zekerWeten: zeker, user }));
  const stop = () =>
    run("stop", async () => {
      await stopRecording({ user });
      setShowNew(false);
    });
  const pickFile = (file) =>
    run("file", async () => {
      if (!file) return;
      await addAudioFile({ lead, file, zekerWeten: zeker, user });
      setShowNew(false);
    });

  const hasResult = sorted.length > 0;
  const showStart = !recordingHere && (!hasResult || showNew);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {credit.low && (
        <Notice tone={credit.empty ? "error" : "warn"}>
          Claude-tegoed {credit.empty ? "is op" : "bijna op"}: nog ongeveer {formatUsd(credit.remainingUsd)}
          {credit.callsLeft !== null ? ` (± ${credit.callsLeft} gesprekken)` : ""}. Waardeer op via console.anthropic.com en werk het tegoed bij onder Instellingen.
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {/* LOKAAL BEWAARDE OPNAMES (na crash / mislukte upload) */}
      {localRecs.map((r) => (
        <Notice key={r.id} tone="warn">
          <div style={{ fontWeight: 600 }}>
            Opname op dit toestel nog niet geüpload ({formatDateTime(new Date(r.startedAt))}
            {r.durationMs ? ` · ${fmtDuration(r.durationMs)}` : ""})
          </div>
          <div style={{ marginTop: 2 }}>{r.state === "recording" ? "Deze opname is onderbroken (app gesloten of crash). Alles tot dat moment is bewaard." : "De upload is niet afgerond."}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" style={btnStyle("primary", true)} disabled={Boolean(busy)} onClick={() => run("retry", () => retryLocalRec(r, user))}>
              <Icon name="upload" size={14} /> Uploaden en verwerken
            </button>
            <button type="button" style={btnStyle("neutral")} onClick={() => run("dl", () => downloadLocalRec(r))}>
              <Icon name="download" size={14} /> Downloaden
            </button>
            <button
              type="button"
              style={btnStyle("danger")}
              onClick={() => window.confirm("Deze opname definitief van dit toestel verwijderen? Dit kan niet ongedaan worden gemaakt.") && run("discard", () => discardLocalRec(r))}
            >
              Weggooien
            </button>
          </div>
        </Notice>
      ))}

      {/* UPLOADS VAN DIT TOESTEL */}
      {jobs.map((j) =>
        j.phase === "uploading" ? (
          <Notice key={j.callId} tone="info">
            Uploaden… {Math.round((j.progress || 0) * 100)}%. Laat deze pagina even open.
            <div style={{ height: 6, background: C.borderSoft, borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
              <div style={{ width: `${Math.round((j.progress || 0) * 100)}%`, height: "100%", background: C.navy, transition: "width .3s" }} />
            </div>
          </Notice>
        ) : (
          <Notice key={j.callId} tone="error">
            {j.error}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {j.retry && (
                <button type="button" style={btnStyle("primary", true)} onClick={() => j.retry()}>
                  <Icon name="refresh" size={14} /> Opnieuw uploaden
                </button>
              )}
              {!j.retry && (
                <button type="button" style={btnStyle("neutral")} onClick={() => clearJob(j.callId)}>
                  Sluiten
                </button>
              )}
            </div>
          </Notice>
        )
      )}

      {/* OPNAME LOOPT */}
      {recordingHere && (
        <Card icon="mic" title="Opname loopt">
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span className="msk-rec-dot" style={{ width: 14, height: 14, borderRadius: 99, background: C.danger, display: "inline-block" }} aria-hidden="true" />
            <span style={{ fontSize: 30, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: C.navy }}>{fmtDuration(rec.elapsedMs)}</span>
            <button type="button" onClick={stop} disabled={rec.status !== "recording" || Boolean(busy)} style={{ ...btnStyle("danger", true), padding: "12px 22px", fontSize: 14, minHeight: 46, marginLeft: "auto" }}>
              <Icon name="stop" size={16} /> {rec.status === "stopping" ? "Stoppen…" : "Stop & verwerken"}
            </button>
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 10, lineHeight: 1.5 }}>
            Laat het scherm aan en deze pagina open. Je kunt wel van tabblad wisselen in het CRM (bijv. naar Zoekprofiel).{" "}
            {rec.backup ? "Elke paar seconden wordt een backup op dit toestel gemaakt." : "Let op: lokale backup werkt niet in deze browser."}
          </div>
          {rec.warning && (
            <div style={{ marginTop: 10 }}>
              <Notice tone="warn">{rec.warning}</Notice>
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <ZekerWetenFields value={zeker} onChange={setZeker} />
          </div>
        </Card>
      )}

      {/* NIEUW GESPREK */}
      {showStart && (
        <Card icon="mic" title={hasResult ? "Nieuw gesprek verwerken" : "Gesprek verwerken"} right={hasResult && <button type="button" className="msk-link" style={{ ...btnStyle("neutral"), minHeight: 28 }} onClick={() => setShowNew(false)}>Annuleren</button>}>
          <div style={{ fontSize: 13, color: C.textBody, marginBottom: 12, lineHeight: 1.55 }}>
            Neem het gesprek hier op, of upload de opname uit Dictafoon. Daarna maakt de AI de uitgebreide samenvatting, de korte samenvatting en het appje. De lead sheet vul je zelf in.
          </div>
          <ZekerWetenFields value={zeker} onChange={setZeker} />
          {recordingElsewhere && (
            <div style={{ marginTop: 12 }}>
              <Notice tone="warn">Er loopt al een opname voor {rec.leadName || "een andere lead"}. Stop die eerst.</Notice>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button type="button" onClick={start} disabled={Boolean(rec) || Boolean(busy) || !recordingSupported()} style={{ ...btnStyle("primary", true), padding: "11px 20px", minHeight: 44, fontSize: 13.5 }}>
              <Icon name="mic" size={16} /> {busy === "start" ? "Microfoon starten…" : "Opname starten"}
            </button>
            <button type="button" onClick={() => fileRef.current && fileRef.current.click()} disabled={Boolean(busy)} style={{ ...btnStyle("neutral"), padding: "11px 18px", minHeight: 44, fontSize: 13.5 }}>
              <Icon name="upload" size={16} /> {busy === "file" ? "Bezig…" : "Audiobestand uploaden"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*,video/mp4,.m4a,.mp3,.wav,.aac,.caf,.ogg,.opus,.webm,.mp4,.amr,.3gp"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files && e.target.files[0];
                e.target.value = "";
                pickFile(f);
              }}
            />
          </div>
          {!recordingSupported() && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>Opnemen werkt niet in deze browser; uploaden wel.</div>}
        </Card>
      )}

      {!showStart && !recordingHere && hasResult && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" style={btnStyle("primary", true)} onClick={() => setShowNew(true)} disabled={Boolean(rec)}>
            <Icon name="plus" size={14} /> Nieuw gesprek
          </button>
        </div>
      )}

      {selected && <CallView key={selected.id} call={selected} lead={lead} form={form} set={set} user={user} />}

      {sorted.length > 1 && (
        <Card icon="clock" title="Eerdere gesprekken">
          {sorted.map((c) => {
            const st = STATUS[c.status] || STATUS.uploaded;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                style={{ display: "flex", width: "100%", gap: 10, alignItems: "center", padding: "10px 8px", border: "none", borderBottom: `1px solid ${C.borderSoft}`, background: c.id === selected?.id ? C.surfaceSoft : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit", borderRadius: 8 }}
              >
                <span style={{ fontSize: 13, color: C.text, flex: 1 }}>
                  {formatDateTime(c.createdAt)} · {c.source === "bestand" ? "geüpload bestand" : "opname"}
                  {c.durationSec ? ` · ${fmtDuration(c.durationSec * 1000)}` : ""}
                </span>
                <Badge color={st.color} bg={st.bg}>{st.label}</Badge>
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ─── ÉÉN GESPREK ─────────────────────────────────────────────────────────────
function CallView({ call, lead, form, set, user }) {
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const st = STATUS[call.status] || STATUS.uploaded;
  const r = call.result || {};
  const approved = call.status === "approved";
  const stale = isStale(call);
  const leadName = form.name || lead.name || "";

  async function run(label, fn, okText) {
    setMsg(null);
    setBusy(label);
    try {
      await fn();
      if (okText) setMsg({ tone: "ok", text: okText });
    } catch (e) {
      console.error(e);
      setMsg({ tone: "error", text: e?.message || "Er ging iets mis." });
    } finally {
      setBusy("");
    }
  }

  const reprocess = () => run("process", () => startProcessing(lead.id, call.id));
  const download = () =>
    run("audio", async () => {
      const url = await getCallAudioUrl(call);
      window.open(url, "_blank", "noopener");
    });
  const saveField = (key) => (value) => saveCallResult(lead.id, call.id, { [key]: value });

  const menu = (
    <MoreMenu
      items={[
        call.audioPath && { label: "Audio downloaden", icon: "download", onClick: download },
        call.audioPath && call.status !== "processing" && call.status !== "uploading" && { label: "Opnieuw verwerken", icon: "refresh", onClick: () => window.confirm("Opnieuw laten samenvatten? Je eigen aanpassingen in de teksten worden dan overschreven.") && reprocess() },
        approved && { label: "Goedkeuring intrekken", icon: "edit", onClick: () => run("reopen", () => reopenCall(lead.id, call.id)) },
        {
          label: "Gesprek verwijderen",
          icon: "trash",
          danger: true,
          onClick: () => window.confirm("Dit gesprek inclusief audio en teksten definitief verwijderen?") && run("delete", () => deleteCall(lead.id, call)),
        },
      ]}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Badge color={st.color} bg={st.bg}>{st.label}</Badge>
        <span style={{ fontSize: 12.5, color: C.textMuted }}>
          {formatDateTime(call.createdAt)}
          {call.durationSec ? ` · ${fmtDuration(call.durationSec * 1000)}` : ""}
          {call.size ? ` · ${formatBytes(call.size)}` : ""}
          {call.costUsd ? ` · kosten ${formatUsd(call.costUsd)}` : ""}
          {call.createdByName ? ` · ${call.createdByName}` : ""}
        </span>
        <span style={{ marginLeft: "auto" }}>{menu}</span>
      </div>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {(call.status === "uploading" || call.status === "uploaded" || call.status === "processing") && !stale && (
        <Notice tone="info">
          <strong style={{ fontWeight: 600 }}>{call.status === "uploading" ? "Audio wordt geüpload…" : call.status === "uploaded" ? "Audio staat veilig online, verwerking start…" : `Bezig: ${call.step || "verwerken"}…`}</strong>
          <div style={{ marginTop: 2 }}>Meestal binnen 1 à 2 minuten klaar. Je mag dit scherm sluiten; het resultaat verschijnt vanzelf hier.</div>
        </Notice>
      )}

      {stale && (
        <Notice tone="warn">
          De verwerking lijkt vast te zitten. De audio is veilig.
          <div style={{ marginTop: 8 }}>
            <button type="button" style={btnStyle("primary", true)} disabled={Boolean(busy)} onClick={reprocess}>
              <Icon name="refresh" size={14} /> Opnieuw verwerken
            </button>
          </div>
        </Notice>
      )}

      {call.status === "error" && (
        <Notice tone="error">
          <strong style={{ fontWeight: 600 }}>{call.errorMessage || "Verwerken mislukt."}</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {call.audioPath && (
              <button type="button" style={btnStyle("primary", true)} disabled={Boolean(busy)} onClick={reprocess}>
                <Icon name="refresh" size={14} /> {busy === "process" ? "Bezig…" : "Opnieuw verwerken"}
              </button>
            )}
            {call.audioPath && (
              <button type="button" style={btnStyle("neutral")} onClick={download}>
                <Icon name="download" size={14} /> Audio downloaden
              </button>
            )}
          </div>
        </Notice>
      )}

      {r.uitgebreid && (
        <>
          {Array.isArray(r.checks) && r.checks.length > 0 && !approved && (
            <Notice tone="warn">
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Even checken ({r.checks.length})</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {r.checks.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </Notice>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {r.leadtype && <Badge icon="tag">Type: {r.leadtype}</Badge>}
            {r.leadtemperatuur && <Badge icon="flag" color={r.leadtemperatuur === "heet" ? "#b42318" : r.leadtemperatuur === "warm" ? "#9a6700" : "#334a5e"}>Temperatuur: {r.leadtemperatuur}</Badge>}
          </div>

          <TextBlock
            title="1 · Appje naar het makelaarskantoor"
            hint="Komt bovenaan je bericht aan het kantoor."
            value={r.appje}
            rows={5}
            readOnly={approved}
            onSave={saveField("appje")}
            actions={(text) => <CopyButton text={text} label="Appje kopiëren" tone="primary" solid />}
          />

          <TextBlock
            title="2 · Uitgebreide samenvatting (voor de makelaar)"
            value={r.uitgebreid}
            rows={18}
            markdown
            readOnly={approved}
            onSave={saveField("uitgebreid")}
            actions={(text) => (
              <>
                <button type="button" style={btnStyle("primary", true)} onClick={() => run("pdf", async () => openSummaryPdf(text, leadName))}>
                  <Icon name="file" size={14} /> PDF maken
                </button>
                <CopyButton text={toWhatsApp(text)} label="Kopiëren voor WhatsApp" />
              </>
            )}
          />

          <TextBlock
            title="3 · Korte samenvatting (lead sheet)"
            value={r.kort}
            rows={4}
            readOnly={approved}
            onSave={saveField("kort")}
            actions={(text) => (
              <>
                <CopyButton text={text} />
                <button
                  type="button"
                  style={btnStyle("neutral")}
                  onClick={() => {
                    if (form.leadSummary && form.leadSummary.trim() && form.leadSummary.trim() !== text.trim() && !window.confirm("De interne samenvatting van deze lead vervangen door deze tekst?")) return;
                    set("leadSummary", text);
                    setMsg({ tone: "ok", text: "Gezet in de interne samenvatting van de lead." });
                  }}
                >
                  <Icon name="save" size={14} /> Zet in interne samenvatting
                </button>
              </>
            )}
          />

          {!approved ? (
            <Card>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 12.5, color: C.textMuted, flex: "1 1 260px", lineHeight: 1.5 }}>
                  Alles nagelezen? Na goedkeuren wordt het transcript direct verwijderd en de audio na {AUDIO_DELETE_DAYS} dagen. Er komt een regel in de tijdlijn.
                </div>
                <button
                  type="button"
                  style={{ ...btnStyle("success", true), padding: "11px 20px", minHeight: 44, fontSize: 13.5 }}
                  disabled={Boolean(busy)}
                  onClick={() => run("approve", () => approveCall({ ...lead, ...form }, call, user), "Goedgekeurd.")}
                >
                  <Icon name="checkCircle" size={16} /> {busy === "approve" ? "Bezig…" : "Goedkeuren"}
                </button>
              </div>
            </Card>
          ) : (
            <Notice tone="ok">
              Goedgekeurd{call.approvedByName ? ` door ${call.approvedByName}` : ""}{call.approvedAt ? ` op ${formatDateTime(call.approvedAt)}` : ""}.{" "}
              {call.audioPath ? `De audio wordt na ${AUDIO_DELETE_DAYS} dagen automatisch verwijderd.` : "De audio is verwijderd."}
            </Notice>
          )}
        </>
      )}
    </div>
  );
}
