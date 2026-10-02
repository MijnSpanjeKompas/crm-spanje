import { useState } from "react";
import { isSold } from "../crm/constants";
import { markLeadSold } from "../crm/services";
import { todayISO } from "../crm/dates";
import { Modal, ModalTitle, CloseButton, TextField, NumberField, TextAreaField, Notice, Icon, btnStyle, formatEuro, C } from "./ui";

/**
 * Verkoop vastleggen: aankoopprijs, woning en onze commissie.
 * Wordt ook gebruikt om de verkoopgegevens later aan te passen.
 */
export function SaleDialog({ lead, user, onClose, onSaved }) {
  const editing = isSold(lead);
  const [form, setForm] = useState(() => ({
    saleDate: lead.saleDate || todayISO(),
    salePrice: lead.salePrice ?? null,
    saleProperty: lead.saleProperty || "",
    saleCommission: lead.saleCommission ?? null,
    saleNotes: lead.saleNotes || "",
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const pct = form.salePrice > 0 && form.saleCommission > 0 ? (form.saleCommission / form.salePrice) * 100 : null;

  async function save() {
    const errs = {};
    if (!(form.salePrice > 0)) errs.salePrice = "Vul de aankoopprijs in.";
    if (!form.saleProperty.trim()) errs.saleProperty = "Vul in welke woning het is (adres of omschrijving).";
    if (!form.saleDate) errs.saleDate = "Kies de datum waarop de aankoop rond was.";
    if (form.saleCommission !== null && form.saleCommission < 0) errs.saleCommission = "Commissie kan niet negatief zijn.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setError("");
    try {
      await markLeadSold(lead, { ...form, saleProperty: form.saleProperty.trim(), saleNotes: form.saleNotes.trim() }, user);
      onSaved?.(lead, editing);
      onClose();
    } catch (e) {
      console.error(e);
      setError(e?.code === "permission-denied" ? "Opslaan mislukt: geen rechten." : `Opslaan mislukt: ${e.message || "onbekende fout"}`);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={560} zIndex={1200}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <ModalTitle sub={lead.name || "Lead"}>{editing ? "Aankoopgegevens aanpassen" : "Aankoop afgerond"}</ModalTitle>
        <CloseButton onClick={onClose} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <TextField
            label="Woning *"
            value={form.saleProperty}
            onChange={set("saleProperty")}
            error={errors.saleProperty}
            placeholder="Bijv. Calle del Mar 12, Torrevieja"
            autoFocus
          />
        </div>
        <NumberField label="Aankoopprijs (€) *" value={form.salePrice} onChange={set("salePrice")} error={errors.salePrice} step={1000} placeholder="Bijv. 245000" />
        <NumberField
          label="Onze commissie (€)"
          value={form.saleCommission}
          onChange={set("saleCommission")}
          error={errors.saleCommission}
          step={100}
          hint={pct !== null ? `≈ ${pct.toLocaleString("nl-NL", { maximumFractionDigits: 2 })}% van de aankoopprijs` : "Mag je ook later invullen."}
        />
        <TextField label="Datum aankoop *" type="date" value={form.saleDate} onChange={set("saleDate")} error={errors.saleDate} />
        <div style={{ gridColumn: "1 / -1" }}>
          <TextAreaField label="Notitie (optioneel)" value={form.saleNotes} onChange={set("saleNotes")} rows={2} placeholder="Bijv. commissie via Costa Homes, uitbetaling na notaris" />
        </div>
      </div>

      {!editing && (
        <div style={{ fontSize: 12.5, color: C.textMuted, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ display: "flex", marginTop: 1 }}>
            <Icon name="info" size={14} />
          </span>
          De lead krijgt de fase Aankoop afgerond en de volgende actie vervalt. De commissie verschijnt direct onder Commissies.
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", paddingTop: 4 }}>
        <div style={{ fontSize: 13, color: C.textMuted }}>
          {form.saleCommission > 0 && (
            <>
              Commissie: <strong style={{ color: C.text }}>{formatEuro(form.saleCommission)}</strong>
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
          <button type="button" onClick={onClose} style={{ ...btnStyle("neutral"), minHeight: 40, padding: "9px 16px", fontSize: 13 }}>
            Annuleren
          </button>
          <button type="button" onClick={save} disabled={busy} style={{ ...btnStyle("primary", true), minHeight: 40, padding: "9px 18px", fontSize: 13 }}>
            <Icon name="check" size={15} /> {busy ? "Opslaan..." : editing ? "Wijzigingen opslaan" : "Aankoop opslaan"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Grote gouden knop. */
export function SoldButton({ onClick, block = false, size = "md" }) {
  const big = size === "lg";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        ...btnStyle("gold", true),
        width: block ? "100%" : undefined,
        minHeight: big ? 44 : 38,
        padding: big ? "10px 22px" : "8px 16px",
        fontSize: big ? 14.5 : 13.5,
        fontWeight: 700,
        letterSpacing: ".01em",
      }}
    >
      <Icon name="checkCircle" size={big ? 18 : 16} /> Aankoop afgerond
    </button>
  );
}
