import { useEffect, useRef, useState } from "react";
import { CODE_LENGTH, checkProfileCode } from "../crm/profiles";
import { authErrorMessage } from "../crm/useCrmAuth";
import { btnStyle, inputStyle, labelStyle, linkBtnStyle, Notice, BrandLogo, C } from "./ui";

const shell = {
  minHeight: "100vh",
  background: C.bg,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  fontFamily: C.fontUi,
  color: C.text,
};

const box = {
  background: C.surface,
  borderRadius: 22,
  border: `1px solid ${C.border}`,
  boxShadow: "0 2px 6px rgba(16,42,67,0.04), 0 24px 60px rgba(16,42,67,0.08)",
  width: "100%",
  maxWidth: 860,
  display: "flex",
  flexWrap: "wrap",
  overflow: "hidden",
};

/** Merkpaneel in de stijl van de aankoopkostencalculator: diep navy + goud. */
function BrandPanel() {
  return (
    <div
      style={{
        flex: "1 1 320px",
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(160deg, #123353 0%, #0e2438 55%, #0a1c2e 100%)",
        color: "#fff",
        padding: "36px 34px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 40,
        minHeight: 220,
      }}
    >
      <span aria-hidden="true" style={{ position: "absolute", width: 340, height: 340, borderRadius: "50%", border: "1px solid rgba(217,168,62,0.16)", top: -170, right: -150 }} />
      <div
        style={{
          background: "#fbf8f1",
          borderRadius: 16,
          padding: "10px 14px",
          alignSelf: "flex-start",
          boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
        }}
      >
        <BrandLogo height={56} />
      </div>
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: "#e0b25a", marginBottom: 10 }}>Mijn Spanje Kompas</div>
        <div style={{ fontFamily: C.fontDisplay, fontSize: 28, fontWeight: 600, lineHeight: 1.2, color: "#fff" }}>Lead- en klantvolgsysteem</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.72)", marginTop: 10, lineHeight: 1.6, maxWidth: 320 }}>
          Alle kopers, afspraken en partnerkoppelingen op één rustige plek.
        </div>
        <div
          style={{
            marginTop: 26,
            paddingTop: 16,
            borderTop: "1px solid rgba(217,168,62,0.28)",
            fontFamily: C.fontDisplay,
            fontStyle: "italic",
            fontSize: 17,
            color: "#e0b25a",
          }}
        >
          Samen richting jouw Spanje
        </div>
      </div>
    </div>
  );
}

export function LoginScreen({ onSignIn, onResetPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await onSignIn(email, password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Vul eerst je e-mailadres in.");
      return;
    }
    try {
      await onResetPassword(email);
      setInfo("Als dit adres bekend is, ontvang je een e-mail om je wachtwoord opnieuw in te stellen.");
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  return (
    <div style={shell}>
      <div style={box}>
        <BrandPanel />
        <form style={{ flex: "1 1 340px", padding: "40px 38px", display: "flex", flexDirection: "column", gap: 16, justifyContent: "center" }} onSubmit={submit}>
          <div style={{ marginBottom: 4 }}>
            <h1 style={{ fontFamily: C.fontDisplay, fontSize: 26, fontWeight: 600, color: C.navy, margin: 0, lineHeight: 1.2 }}>Inloggen</h1>
            <div style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6 }}>Log in met je account van Mijn Spanje Kompas.</div>
          </div>
          <div>
            <label style={labelStyle} htmlFor="login-email">
              E-mailadres
            </label>
            <input id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} required />
          </div>
          <div>
            <label style={labelStyle} htmlFor="login-password">
              Wachtwoord
            </label>
            <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} required />
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          {info && <Notice tone="ok">{info}</Notice>}
          <button type="submit" disabled={busy} style={{ ...btnStyle("primary", true), padding: "11px 16px", minHeight: 44, fontSize: 14, marginTop: 4 }}>
            {busy ? "Bezig met inloggen..." : "Inloggen"}
          </button>
          <button type="button" onClick={reset} className="msk-link" style={{ ...linkBtnStyle, fontSize: 12.5, alignSelf: "center", color: C.textMuted }}>
            Wachtwoord vergeten?
          </button>
        </form>
      </div>
    </div>
  );
}

const MAX_TRIES = 5;
const LOCK_SECONDS = 30;

/** Code van 4 cijfers voor het gekozen profiel. Typen of plakken; controleert automatisch. */
function CodeEntry({ profile, onOk, onBack }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [tries, setTries] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [, tick] = useState(0);
  const inputRef = useRef(null);
  const locked = lockedUntil > Date.now();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!locked) return undefined;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [locked]);

  function check(value) {
    if (checkProfileCode(profile.id, value)) {
      onOk(profile.id);
      return;
    }
    const n = tries + 1;
    setTries(n);
    setCode("");
    if (n >= MAX_TRIES) {
      setLockedUntil(Date.now() + LOCK_SECONDS * 1000);
      setTries(0);
      setError(`Te vaak een verkeerde code. Wacht ${LOCK_SECONDS} seconden.`);
    } else {
      setError("Deze code klopt niet. Probeer het opnieuw.");
    }
    inputRef.current?.focus();
  }

  function onChange(e) {
    if (locked) return;
    const v = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(v);
    setError("");
    if (v.length === CODE_LENGTH) check(v);
  }

  const wait = locked ? Math.ceil((lockedUntil - Date.now()) / 1000) : 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === CODE_LENGTH && !locked) check(code);
      }}
      style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}
    >
      <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 99, background: C.gold, color: C.navyDark, fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {profile.displayName[0]}
      </span>
      <label htmlFor="profiel-code" style={{ fontSize: 15, fontWeight: 600, color: C.navy }}>
        Code voor {profile.displayName}
      </label>
      <div style={{ position: "relative", width: 232 }} onClick={() => inputRef.current?.focus()}>
        <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: `repeat(${CODE_LENGTH}, 1fr)`, gap: 10 }}>
          {Array.from({ length: CODE_LENGTH }).map((_, i) => (
            <span
              key={i}
              style={{
                height: 56,
                borderRadius: 14,
                border: `1.5px solid ${error ? C.danger : i === code.length ? C.navy : C.border}`,
                background: C.surface,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                color: C.navy,
              }}
            >
              {i < code.length ? "•" : ""}
            </span>
          ))}
        </div>
        <input
          id="profiel-code"
          ref={inputRef}
          className="msk-bare"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={CODE_LENGTH}
          value={code}
          onChange={onChange}
          disabled={locked}
          aria-invalid={Boolean(error)}
          aria-describedby="profiel-code-uitleg"
          style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", fontSize: 16, border: "none", background: "transparent", caretColor: "transparent" }}
        />
      </div>
      <div id="profiel-code-uitleg" role="status" aria-live="polite" style={{ minHeight: 20, fontSize: 13, color: error ? C.danger : C.textMuted, textAlign: "center" }}>
        {locked ? `Even wachten: nog ${wait} seconden.` : error || `Typ je code van ${CODE_LENGTH} cijfers.`}
      </div>
      <button type="button" onClick={onBack} className="msk-link" style={{ ...linkBtnStyle, fontSize: 13, color: C.textMuted }}>
        Ander profiel kiezen
      </button>
    </form>
  );
}

/** Na het inloggen: kies met welk profiel je werkt (Luke of Indy) en voer de code in. */
export function ProfilePicker({ profiles, onPick, onSignOut }) {
  const [chosen, setChosen] = useState(null);
  const profile = profiles.find((p) => p.id === chosen);
  return (
    <div style={shell}>
      <div style={box}>
        <div className="msk-hide-sm" style={{ display: "flex", flex: "1 1 320px" }}>
          <BrandPanel />
        </div>
        <div style={{ flex: "1 1 340px", padding: "36px 32px", display: "flex", flexDirection: "column", gap: 16, justifyContent: "center" }}>
          <div className="msk-show-sm" style={{ justifyContent: "center", marginBottom: 4 }}>
            <BrandLogo height={52} />
          </div>
          {profile ? (
            <CodeEntry profile={profile} onOk={onPick} onBack={() => setChosen(null)} />
          ) : (
            <>
              <div style={{ marginBottom: 4 }}>
                <h1 style={{ fontFamily: C.fontDisplay, fontSize: 26, fontWeight: 600, color: C.navy, margin: 0, lineHeight: 1.2 }}>Wie werkt er?</h1>
                <div style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6, lineHeight: 1.5 }}>
                  Kies je profiel en voer je code in. Alles wat je doet komt op jouw naam in de tijdlijn.
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setChosen(p.id)}
                    className="msk-kpi"
                    style={{ border: `1px solid ${C.border}`, background: C.surface, borderRadius: 16, padding: "20px 12px", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
                  >
                    <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 99, background: C.gold, color: C.navyDark, fontSize: 21, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {p.displayName[0]}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: C.navy }}>{p.displayName}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <button type="button" onClick={onSignOut} className="msk-link" style={{ ...linkBtnStyle, fontSize: 12.5, alignSelf: "center", color: C.textMuted }}>
            Uitloggen
          </button>
        </div>
      </div>
    </div>
  );
}

export function LoadingScreen({ text = "Laden..." }) {
  return (
    <div style={shell}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <BrandLogo height={64} style={{ opacity: 0.9 }} />
        <div style={{ color: C.textMuted, fontSize: 13.5 }}>{text}</div>
      </div>
    </div>
  );
}
