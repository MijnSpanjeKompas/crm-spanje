import { useCallFlow } from "../crm/useCallFlow";
import { stopRecording, resumeRecording } from "../crm/callFlow";
import { creditStatus, formatUsd } from "../crm/calls";
import { formatDateTime } from "../crm/dates";
import { Notice, Icon, btnStyle, linkBtnStyle, C } from "./ui";

function fmt(ms) {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(s % 60).padStart(2, "0")}`;
}

/** Zwevende balk zolang er een opname loopt, op elke pagina van het CRM. */
export function RecordingBar({ user, onOpenLead }) {
  const { recording: rec, jobs } = useCallFlow();
  const uploading = Object.values(jobs).filter((j) => j.phase === "uploading");
  if (!rec && !uploading.length) return null;
  return (
    <div className="msk-recbar" role="status" aria-live="polite">
      <div style={{ background: C.navyDark, color: "#fff", borderRadius: 14, boxShadow: C.shadowLg, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {rec ? (
          <>
            <span className={rec.status === "interrupted" ? "" : "msk-rec-dot"} style={{ width: 11, height: 11, borderRadius: 99, background: rec.status === "interrupted" ? "#e5b13a" : "#ef4444", display: "inline-block", flexShrink: 0 }} aria-hidden="true" />
            <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt(rec.elapsedMs)}</span>
            <span style={{ fontSize: 13, opacity: 0.85, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.status === "interrupted" ? "Onderbroken" : "Opname"} · {rec.leadName || "lead"}</span>
            <button type="button" onClick={() => onOpenLead(rec.leadId)} style={{ ...linkBtnStyle, color: "#fff", textDecoration: "underline" }}>
              Open lead
            </button>
            {rec.status === "interrupted" && (
              <button type="button" onClick={() => resumeRecording().catch(() => {})} style={btnStyle("gold", true)}>
                <Icon name="mic" size={14} /> Hervatten
              </button>
            )}
            <button type="button" disabled={rec.status !== "recording" && rec.status !== "interrupted"} onClick={() => stopRecording({ user })} style={btnStyle("danger", true)}>
              <Icon name="stop" size={14} /> {rec.status === "stopping" ? "Stoppen…" : "Stop & verwerken"}
            </button>
          </>
        ) : (
          <span style={{ fontSize: 13 }}>
            Opname uploaden… {Math.round((uploading[0].progress || 0) * 100)}% ({uploading[0].leadName || "lead"}). Laat deze pagina even open.
          </span>
        )}
      </div>
    </div>
  );
}

/** Meldingen bovenaan het CRM: niet-geüploade opnames en een bijna leeg tegoed. */
export function CallFlowNotices({ settings, leads, onOpenLead }) {
  const { localRecs, jobs, recording } = useCallFlow();
  const jobCallIds = new Set(Object.keys(jobs));
  const pending = localRecs.filter((r) => !jobCallIds.has(r.callId) && r.id !== recording?.recId);
  const credit = creditStatus(settings);
  if (!pending.length && !credit.low) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
      {pending.map((r) => {
        const exists = leads.some((l) => l.id === r.leadId);
        return (
          <Notice key={r.id} tone="warn">
            Er staat een opname op dit toestel die nog niet is geüpload: <strong>{r.leadName || "onbekende lead"}</strong> ({formatDateTime(new Date(r.startedAt))}).{" "}
            {exists ? (
              <button type="button" className="msk-link" style={{ ...linkBtnStyle, color: "#7d5710" }} onClick={() => onOpenLead(r.leadId)}>
                Open de lead om hem te uploaden
              </button>
            ) : (
              "De lead bestaat niet meer; open Instellingen om de opname te downloaden of weg te gooien."
            )}
          </Notice>
        );
      })}
      {credit.low && (
        <Notice tone={credit.empty ? "error" : "warn"}>
          Claude-tegoed {credit.empty ? "is op" : "bijna op"}: nog ongeveer {formatUsd(credit.remainingUsd)}
          {credit.callsLeft !== null ? ` (± ${credit.callsLeft} gesprekken)` : ""}. Waardeer op via console.anthropic.com en werk daarna het tegoed bij onder Instellingen → Gesprekken & AI.
        </Notice>
      )}
    </div>
  );
}
