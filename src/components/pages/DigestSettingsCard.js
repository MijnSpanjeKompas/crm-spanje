import { useEffect, useMemo, useState } from "react";
import { subscribeDigestSettings, saveDigestSettings, sendDigestTest, withDefaults } from "../../crm/dagoverzichtSettings";
import { buildDigest } from "../../crm/digest";
import { PROFILES } from "../../crm/profiles";
import { Card, Notice, Icon, btnStyle, inputStyle, labelStyle, linkBtnStyle, C } from "../ui";

/** Instellingen → Dagelijks overzicht (mail om 08:00). */
export function DigestSettingsCard({ user, leads, tasks, links }) {
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => subscribeDigestSettings((s) => setSaved(s), () => setSaved(withDefaults({}))), []);
  const s = draft || saved || withDefaults({});
  const dirty = Boolean(draft);
  const set = (patch) => setDraft({ ...s, ...patch });
  const setRcpt = (id, patch) => set({ recipients: { ...s.recipients, [id]: { ...s.recipients[id], ...patch } } });

  const example = useMemo(() => (preview ? buildDigest({ leads, tasks, links, now: new Date(), profile: user, crmUrl: s.crmUrl || window.location.origin }) : null), [preview, leads, tasks, links, user, s.crmUrl]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await saveDigestSettings({ ...s, crmUrl: s.crmUrl || window.location.origin });
      setDraft(null);
      setMsg({ tone: "ok", text: "Opgeslagen." });
    } catch (e) {
      setMsg({ tone: "error", text: `Opslaan mislukt: ${e.message || "onbekende fout"}` });
    } finally {
      setBusy(false);
    }
  }

  async function test(profileId) {
    setBusy(true);
    setMsg(null);
    try {
      if (dirty) await saveDigestSettings({ ...s, crmUrl: s.crmUrl || window.location.origin });
      setDraft(null);
      await sendDigestTest(profileId);
      setMsg({ tone: "ok", text: `Testmail verstuurd naar ${s.recipients[profileId]?.email}. Check ook je spam.` });
    } catch (e) {
      const notDeployed = /not-found|internal/i.test(e?.code || "") && !/Versturen/.test(e?.message || "");
      setMsg({ tone: "error", text: notDeployed ? "De mailfunctie staat nog niet online. Volg de stappen in de README (Gmail-app-wachtwoord + firebase deploy)." : e.message || "Versturen mislukt." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card icon="mail" title="Dagelijks overzicht (08:00)">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, color: C.textBody, lineHeight: 1.55 }}>
          Elke ochtend om 08:00 een mail met wat er vandaag gepland staat, wat te laat is en welke leads nieuw zijn. Op je telefoon komt die binnen als melding van je mail-app.
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, fontWeight: 600, color: C.text, cursor: "pointer" }}>
          <input type="checkbox" checked={Boolean(s.enabled)} onChange={(e) => set({ enabled: e.target.checked })} /> Dagelijks overzicht versturen
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: C.textBody, cursor: "pointer" }}>
          <input type="checkbox" checked={Boolean(s.weekend)} onChange={(e) => set({ weekend: e.target.checked })} /> Ook op zaterdag en zondag
        </label>
        {PROFILES.map((p) => (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "end" }}>
            <div>
              <label style={labelStyle} htmlFor={`digest-${p.id}`}>
                E-mail {p.displayName}
              </label>
              <input id={`digest-${p.id}`} type="email" inputMode="email" autoComplete="off" value={s.recipients[p.id]?.email || ""} onChange={(e) => setRcpt(p.id, { email: e.target.value.trim() })} placeholder={`${p.displayName.toLowerCase()}@…`} style={inputStyle} />
            </div>
            <button type="button" disabled={busy || !s.recipients[p.id]?.email} onClick={() => test(p.id)} style={{ ...btnStyle("neutral"), minHeight: 40 }} title="Nu een testmail sturen">
              <Icon name="mail" size={14} /> Test
            </button>
          </div>
        ))}
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={() => setPreview((v) => !v)} className="msk-link" style={linkBtnStyle}>
            {preview ? "Voorbeeld verbergen" : "Voorbeeld bekijken"}
          </button>
          <button type="button" disabled={busy || !dirty} onClick={save} style={btnStyle("primary", true)}>
            {busy ? "Bezig…" : "Opslaan"}
          </button>
        </div>
        {example && (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ fontSize: 12, color: C.textMuted, padding: "8px 12px", background: C.surfaceSoft, borderBottom: `1px solid ${C.border}` }}>Onderwerp: {example.subject}</div>
            <iframe title="Voorbeeld dagelijks overzicht" srcDoc={example.html} style={{ width: "100%", height: 420, border: "none", background: "#f7f4ee" }} />
          </div>
        )}
      </div>
    </Card>
  );
}
