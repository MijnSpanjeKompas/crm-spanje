import { useState } from "react";
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
