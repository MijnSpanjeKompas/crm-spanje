import { useRef, useState } from "react";
import { FILE_CATEGORIES, FILE_ACCEPT_ATTR, MAX_FILE_SIZE_MB, ALLOWED_FILE_TYPES, labelOf } from "../../crm/constants";
import { uploadLeadFile, updateLeadFile, deleteLeadFile, openLeadFile, downloadLeadFile, validateFile, getFileExtension } from "../../crm/services";
import { formatDate, formatDateTime, toMillis } from "../../crm/dates";
import { Card, EmptyState, MoreMenu, SelectField, Notice, Empty, Icon, btnStyle, inputStyle, formatBytes, C } from "../ui";

const FILE_TONES = {
  PDF: { color: C.danger, bg: C.dangerBg },
  DOC: { color: C.info, bg: C.infoBg },
  DOCX: { color: C.info, bg: C.infoBg },
  JPG: { color: C.goldText, bg: C.goldSoft },
  JPEG: { color: C.goldText, bg: C.goldSoft },
  PNG: { color: C.goldText, bg: C.goldSoft },
};

function FileIcon({ ext }) {
  const tone = FILE_TONES[ext] || { color: C.textMuted, bg: C.surfaceSoft };
  return (
    <div
      aria-hidden="true"
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: tone.bg,
        color: tone.color,
        border: `1px solid ${C.borderSoft}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: ".03em",
        flexShrink: 0,
      }}
    >
      <Icon name="file" size={14} />
      {ext && <span>{ext}</span>}
    </div>
  );
}

const rowStyle = (busy) => ({
  display: "flex",
  gap: 14,
  alignItems: "center",
  padding: "12px 10px",
  margin: "0 -10px",
  borderRadius: 12,
  borderBottom: `1px solid ${C.borderSoft}`,
  opacity: busy ? 0.6 : 1,
  flexWrap: "wrap",
});

/**
 * Zoekprofiel-PDF uit de Google Sheet: staat extern (bijv. Google Drive) en
 * wordt niet opnieuw geüpload. Wordt naast de geüploade bestanden getoond.
 */
function ExternalPdfRow({ pdf, leadName }) {
  const [error, setError] = useState("");
  const valid = /^https?:\/\//i.test(pdf?.url || "");
  return (
    <div style={rowStyle(false)}>
      <FileIcon ext="PDF" />
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>Zoekprofiel{leadName ? ` ${leadName}` : ""}.pdf</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
          Zoekprofiel · Automatisch toegevoegd
          {pdf.createdAt ? ` · aangemaakt ${formatDate(pdf.createdAt)}` : ""}
          {pdf.sent === true ? " · Verzonden: ja" : pdf.sent === false ? " · Verzonden: nee" : ""}
        </div>
        {error && <div style={{ fontSize: 12, color: C.danger, marginTop: 3 }}>{error}</div>}
      </div>
      <button
        type="button"
        onClick={() => {
          if (!valid) {
            setError("Bestand niet beschikbaar: de link ontbreekt of is ongeldig.");
            return;
          }
          const win = window.open(pdf.url, "_blank", "noopener,noreferrer");
          if (!win) setError("Je browser blokkeert pop-ups. Sta pop-ups toe voor deze site.");
        }}
        style={btnStyle("primary")}
      >
        <Icon name="eye" size={13} /> Bekijken
      </button>
    </div>
  );
}

function FileRow({ file, lead, user, onError }) {
  const [renaming, setRenaming] = useState(false);
  const [recategorize, setRecategorize] = useState(false);
  const [name, setName] = useState(file.fileName);
  const [busy, setBusy] = useState(false);
  const ext = getFileExtension(file.fileName || file.originalFileName).toUpperCase();

  async function run(fn) {
    setBusy(true);
    onError("");
    try {
      await fn();
    } catch (e) {
      console.error(e);
      onError(e.code === "storage/unauthorized" ? "Geen toegang tot dit bestand (controleer de Storage rules)." : e.code === "storage/object-not-found" ? "Bestand niet beschikbaar." : e.message || "Actie mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="msk-row" style={rowStyle(busy)}>
      <FileIcon ext={ext} />
      <div style={{ flex: 1, minWidth: 180 }}>
        {renaming ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus aria-label="Nieuwe bestandsnaam" />
            <button
              type="button"
              onClick={() =>
                run(async () => {
                  await updateLeadFile(lead, file, { fileName: name });
                  setRenaming(false);
                })
              }
              style={btnStyle("primary", true)}
            >
              Opslaan
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setName(file.fileName);
              }}
              style={btnStyle("neutral")}
            >
              Annuleren
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, wordBreak: "break-word" }}>{file.fileName}</div>
        )}
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
          {labelOf(FILE_CATEGORIES, file.category || "other")} · {formatBytes(file.size)} · {formatDateTime(file.uploadedAt)}
          {file.uploadedByName && ` · ${file.uploadedByName}`}
        </div>
        {recategorize && (
          <select
            autoFocus
            value={file.category || "other"}
            onChange={(e) => {
              setRecategorize(false);
              run(() => updateLeadFile(lead, file, { category: e.target.value }));
            }}
            onBlur={() => setRecategorize(false)}
            style={{ ...inputStyle, width: "auto", fontSize: 12.5, minHeight: 32, padding: "5px 10px", marginTop: 6 }}
            aria-label="Categorie"
          >
            {FILE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" onClick={() => run(() => openLeadFile(file))} style={btnStyle("primary")}>
          <Icon name="eye" size={13} /> Bekijken
        </button>
        <button type="button" title="Downloaden" aria-label="Downloaden" onClick={() => run(() => downloadLeadFile(file))} style={{ ...btnStyle("neutral"), width: 34, padding: 0 }}>
          <Icon name="download" size={13} />
        </button>
        <MoreMenu
          label={`Meer acties voor ${file.fileName}`}
          items={[
            { label: "Hernoemen", icon: "edit", onClick: () => setRenaming(true) },
            { label: "Categorie wijzigen", icon: "tag", onClick: () => setRecategorize(true) },
            {
              label: "Verwijderen",
              icon: "trash",
              danger: true,
              onClick: () => {
                if (window.confirm(`'${file.fileName}' definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`)) run(() => deleteLeadFile(lead, file, user));
              },
            },
          ]}
        />
      </div>
    </div>
  );
}

export function FilesTab({ lead, user, files }) {
  const inputRef = useRef(null);
  const [category, setCategory] = useState("other");
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleFiles(list) {
    setError("");
    const arr = Array.from(list || []);
    for (const f of arr) {
      const problem = validateFile(f);
      if (problem) {
        setError(`${f.name}: ${problem}`);
        continue;
      }
      try {
        setProgress({ name: f.name, pct: 0 });
        await uploadLeadFile(lead, f, category, user, (p) => setProgress({ name: f.name, pct: Math.round(p * 100) }));
      } catch (e) {
        console.error(e);
        setError(`${f.name}: ${e.code === "storage/unauthorized" ? "uploaden niet toegestaan (controleer de Storage rules)." : e.message || "uploaden mislukt."}`);
      }
    }
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
    setUploading(false);
  }

  const pdf = lead.searchProfilePdf && lead.searchProfilePdf.url ? lead.searchProfilePdf : null;
  const items = [...files.items].filter((f) => !filter || f.category === filter).sort((a, b) => (toMillis(b.uploadedAt) || 0) - (toMillis(a.uploadedAt) || 0));
  const showPdf = pdf && (!filter || filter === "search_profile");
  const total = files.items.length + (pdf ? 1 : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && <Notice tone="error">{error}</Notice>}
      {files.error && <Notice tone="error">Bestanden konden niet worden geladen.</Notice>}

      <Card
        icon="file"
        title={`Bestanden${total ? ` (${total})` : ""}`}
        right={
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {total > 1 && (
              <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: 12.5, minHeight: 32, padding: "5px 10px", background: C.surface }} aria-label="Filter categorie">
                <option value="">Alle categorieën</option>
                {FILE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
            {!uploading && total > 0 && (
              <button type="button" onClick={() => setUploading(true)} style={{ ...btnStyle("primary"), minHeight: 32, padding: "4px 12px", fontSize: 12 }}>
                <Icon name="upload" size={13} /> Bestand uploaden
              </button>
            )}
          </span>
        }
      >
        {uploading && (
          <div style={{ border: `1.5px dashed ${C.borderStrong}`, background: C.surfaceSoft, borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <SelectField label="Categorie" value={category} onChange={setCategory} options={FILE_CATEGORIES} allowEmpty={false} />
              </div>
              <input ref={inputRef} type="file" multiple accept={FILE_ACCEPT_ATTR} onChange={(e) => handleFiles(e.target.files)} style={{ display: "none" }} />
              <button type="button" onClick={() => setUploading(false)} disabled={Boolean(progress)} style={{ ...btnStyle("neutral"), minHeight: 38 }}>
                Annuleren
              </button>
              <button type="button" disabled={Boolean(progress)} onClick={() => inputRef.current?.click()} style={{ ...btnStyle("primary", true), minHeight: 38 }}>
                <Icon name="upload" size={14} /> {progress ? "Uploaden..." : "Bestand kiezen"}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 8 }}>
              Toegestaan: {Object.keys(ALLOWED_FILE_TYPES).map((e) => e.toUpperCase()).join(", ")} · maximaal {MAX_FILE_SIZE_MB} MB per bestand.
            </div>
            {progress && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12.5, color: C.textBody, marginBottom: 6, display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{progress.name}</span>
                  <span style={{ fontWeight: 600 }}>{progress.pct}%</span>
                </div>
                <div style={{ height: 6, background: C.surfaceSunken, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${progress.pct}%`, height: 6, background: C.gold, borderRadius: 99, transition: "width .2s" }} />
                </div>
              </div>
            )}
          </div>
        )}

        {files.loading ? (
          <Empty>Laden...</Empty>
        ) : items.length || showPdf ? (
          <div>
            {showPdf && <ExternalPdfRow pdf={pdf} leadName={lead.name} />}
            {items.map((f) => (
              <FileRow key={f.id} file={f} lead={lead} user={user} onError={setError} />
            ))}
          </div>
        ) : filter ? (
          <Empty>Geen bestanden in categorie {labelOf(FILE_CATEGORIES, filter)}.</Empty>
        ) : (
          !uploading && <EmptyState text="Nog geen bestanden" actionLabel="Bestand uploaden" icon="upload" onAction={() => setUploading(true)} />
        )}
      </Card>
    </div>
  );
}
