import { useRef, useState } from "react";
import { FILE_CATEGORIES, FILE_ACCEPT_ATTR, MAX_FILE_SIZE_MB, ALLOWED_FILE_TYPES, labelOf } from "../../crm/constants";
import { uploadLeadFile, updateLeadFile, deleteLeadFile, openLeadFile, downloadLeadFile, validateFile, getFileExtension } from "../../crm/services";
import { formatDateTime, toMillis } from "../../crm/dates";
import { Panel, SelectField, Notice, Empty, Icon, btnStyle, inputStyle, formatBytes, C } from "../ui";

const FILE_TONES = {
  PDF: { color: C.danger, bg: C.dangerBg },
  DOC: { color: C.info, bg: C.infoBg },
  DOCX: { color: C.info, bg: C.infoBg },
  JPG: { color: C.goldText, bg: C.goldSoft },
  JPEG: { color: C.goldText, bg: C.goldSoft },
  PNG: { color: C.goldText, bg: C.goldSoft },
};

function FileRow({ file, lead, user, onError }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(file.fileName);
  const [busy, setBusy] = useState(false);
  const ext = getFileExtension(file.fileName || file.originalFileName).toUpperCase();
  const tone = FILE_TONES[ext] || { color: C.textMuted, bg: C.surfaceSoft };

  async function run(fn) {
    setBusy(true);
    onError("");
    try {
      await fn();
    } catch (e) {
      console.error(e);
      onError(e.code === "storage/unauthorized" ? "Geen toegang tot dit bestand (controleer de Storage rules)." : e.message || "Actie mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="msk-row"
      style={{ display: "flex", gap: 14, alignItems: "center", padding: "12px 10px", margin: "0 -10px", borderRadius: 12, borderBottom: `1px solid ${C.borderSoft}`, opacity: busy ? 0.6 : 1, flexWrap: "wrap" }}
    >
      <div
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
      <div style={{ flex: 1, minWidth: 180 }}>
        {renaming ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus />
            <button
              type="button"
              onClick={() =>
                run(async () => {
                  await updateLeadFile(lead, file, { fileName: name });
                  setRenaming(false);
                })
              }
              style={btnStyle("success", true)}
            >
              Opslaan
            </button>
            <button type="button" onClick={() => { setRenaming(false); setName(file.fileName); }} style={btnStyle("neutral")}>
              Annuleren
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, wordBreak: "break-word" }}>{file.fileName}</div>
        )}
        <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 3 }}>
          {formatBytes(file.size)} · {formatDateTime(file.uploadedAt)}
          {file.uploadedByName && ` · ${file.uploadedByName}`}
          {file.originalFileName && file.originalFileName !== file.fileName && ` · origineel: ${file.originalFileName}`}
        </div>
      </div>
      <select
        value={file.category || "other"}
        onChange={(e) => run(() => updateLeadFile(lead, file, { category: e.target.value }))}
        style={{ ...inputStyle, width: "auto", fontSize: 12.5, minHeight: 34, padding: "6px 10px", background: C.surface }}
        aria-label="Categorie"
      >
        {FILE_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" title="Bekijken" onClick={() => run(() => openLeadFile(file))} style={btnStyle("primary")}>
          <Icon name="eye" size={13} /> Bekijken
        </button>
        <button type="button" title="Downloaden" aria-label="Downloaden" onClick={() => run(() => downloadLeadFile(file))} style={{ ...btnStyle("neutral"), width: 34, padding: 0 }}>
          <Icon name="download" size={13} />
        </button>
        {!renaming && (
          <button type="button" title="Hernoemen" aria-label="Hernoemen" onClick={() => setRenaming(true)} style={{ ...btnStyle("neutral"), width: 34, padding: 0 }}>
            <Icon name="edit" size={13} />
          </button>
        )}
        <button
          type="button"
          title="Verwijderen"
          onClick={() => {
            if (window.confirm(`'${file.fileName}' definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`)) run(() => deleteLeadFile(lead, file, user));
          }}
          aria-label="Verwijderen"
          style={{ ...btnStyle("danger"), width: 34, padding: 0 }}
        >
          <Icon name="trash" size={13} />
        </button>
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
  }

  const items = [...files.items]
    .filter((f) => !filter || f.category === filter)
    .sort((a, b) => (toMillis(b.uploadedAt) || 0) - (toMillis(a.uploadedAt) || 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Panel title="Bestand uploaden">
        <div
          style={{
            border: `1.5px dashed ${C.borderStrong}`,
            background: C.surfaceSoft,
            borderRadius: 14,
            padding: "16px 18px",
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            alignItems: "flex-end",
          }}
        >
          <span
            aria-hidden="true"
            style={{ width: 40, height: 40, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, color: C.navy, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "center" }}
          >
            <Icon name="upload" size={18} />
          </span>
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <SelectField label="Categorie" value={category} onChange={setCategory} options={FILE_CATEGORIES} allowEmpty={false} />
          </div>
          <div>
            <input ref={inputRef} type="file" multiple accept={FILE_ACCEPT_ATTR} onChange={(e) => handleFiles(e.target.files)} style={{ display: "none" }} />
            <button type="button" disabled={Boolean(progress)} onClick={() => inputRef.current?.click()} style={{ ...btnStyle("primary", true), padding: "9px 16px", minHeight: 38, fontSize: 13 }}>
              <Icon name="upload" size={14} /> {progress ? "Uploaden..." : "Bestand kiezen"}
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 10 }}>
          Toegestaan: {Object.keys(ALLOWED_FILE_TYPES).map((e) => e.toUpperCase()).join(", ")} · maximaal {MAX_FILE_SIZE_MB} MB per bestand.
        </div>
        {progress && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12.5, color: C.textBody, marginBottom: 6, display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{progress.name}</span>
              <span style={{ fontWeight: 600 }}>{progress.pct}%</span>
            </div>
            <div style={{ height: 6, background: C.surfaceSunken, borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${progress.pct}%`, height: 6, background: C.gold, borderRadius: 99, transition: "width .2s" }} />
            </div>
          </div>
        )}
      </Panel>

      {error && <Notice tone="error">{error}</Notice>}
      {files.error && <Notice tone="error">Bestanden konden niet worden geladen.</Notice>}

      <Panel
        title={`Bestanden (${files.items.length})`}
        right={
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: 12.5, minHeight: 34, padding: "6px 10px", background: C.surface }} aria-label="Filter categorie">
            <option value="">Alle categorieën</option>
            {FILE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        }
      >
        {files.loading ? (
          <Empty>Laden...</Empty>
        ) : items.length ? (
          <div>{items.map((f) => <FileRow key={f.id} file={f} lead={lead} user={user} onError={setError} />)}</div>
        ) : (
          <Empty>{filter ? `Geen bestanden in categorie ${labelOf(FILE_CATEGORIES, filter)}.` : "Nog geen bestanden."}</Empty>
        )}
        {files.items.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 11.5, color: C.textSubtle, display: "flex", gap: 6, alignItems: "center" }}>
            <Icon name="info" size={13} /> PDF's en afbeeldingen openen in een nieuw tabblad.
          </div>
        )}
      </Panel>
    </div>
  );
}
