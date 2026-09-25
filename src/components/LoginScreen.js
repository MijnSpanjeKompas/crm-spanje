import { useState } from "react";
import { authErrorMessage } from "../crm/useCrmAuth";
import { btnStyle, inputStyle, labelStyle, Notice } from "./ui";

const shell = {
  minHeight: "100vh",
  background: "#f8fafc",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  fontFamily: "'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

const box = {
  background: "#fff",
  borderRadius: 18,
  border: "1px solid #f1f5f9",
  boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
  padding: "28px 28px",
  width: "100%",
  maxWidth: 400,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 22 }}>🇪🇸</div>
      <div>
        <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a" }}>Mijn Spanje Kompas</div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>Lead- en klantvolgsysteem</div>
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
      <form style={box} onSubmit={submit}>
        <Brand />
        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 6 }}>Inloggen</div>
        <div>
          <label style={labelStyle} htmlFor="login-email">E-mailadres</label>
          <input id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle} htmlFor="login-password">Wachtwoord</label>
          <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} required />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {info && <Notice tone="ok">{info}</Notice>}
        <button type="submit" disabled={busy} style={{ ...btnStyle("#6366f1", true), justifyContent: "center", padding: "10px 16px", fontSize: 13 }}>
          {busy ? "Bezig met inloggen..." : "Inloggen"}
        </button>
        <button type="button" onClick={reset} style={{ border: "none", background: "none", color: "#6366f1", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Wachtwoord vergeten?
        </button>
      </form>
    </div>
  );
}

export function NoAccessScreen({ authUser, onSignOut }) {
  return (
    <div style={shell}>
      <div style={box}>
        <Brand />
        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 6 }}>Nog geen toegang</div>
        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
          Je bent ingelogd als <strong>{authUser?.email}</strong>, maar dit account is nog niet geactiveerd voor het CRM.
          Een beheerder moet in Firestore een document aanmaken in <code>users</code> met dit ID:
        </div>
        <code style={{ background: "#f1f5f9", borderRadius: 8, padding: "8px 10px", fontSize: 12, wordBreak: "break-all" }}>{authUser?.uid}</code>
        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
          Velden: <code>displayName</code> (tekst), <code>email</code> (tekst), <code>role</code> ("admin" of "member"), <code>active</code> (boolean: true).
        </div>
        <button onClick={onSignOut} style={{ ...btnStyle("#64748b"), justifyContent: "center", padding: "9px 16px" }}>
          Uitloggen
        </button>
      </div>
    </div>
  );
}

export function LoadingScreen({ text = "Laden..." }) {
  return (
    <div style={shell}>
      <div style={{ color: "#94a3b8", fontSize: 14 }}>{text}</div>
    </div>
  );
}
