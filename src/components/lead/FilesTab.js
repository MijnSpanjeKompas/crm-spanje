import { useRef, useState } from "react";
import { FILE_CATEGORIES, FILE_ACCEPT_ATTR, MAX_FILE_SIZE_MB, ALLOWED_FILE_TYPES, labelOf } from "../../crm/constants";
import { uploadLeadFile, updateLeadFile, deleteLeadFile, openLeadFile, downloadLeadFile, validateFile, getFileExtension } from "../../crm/services";
import { formatDateTime, toMillis } from "../../crm/dates";
import { Panel, SelectField, Notice, Empty, Icon, Badge, btnStyle, inputStyle, formatBytes } from "../ui";

function FileRow({ file, lead, user, onError }) {
  const [renaming, setRenaming] = useState(false);
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
      onError(e.code === "storage/unauthorized" ? "Geen toegang tot dit bestand (controleer de Storage rules)." : e.message || "Actie mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9", opacity: busy ? 0.6 : 1, flexWrap: "wrap" }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: ext === "PDF" ? "#fef2f2" : "#eef2ff", color: ext === "PDF" ? "#ef4444" : "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, flexShrink: 0 }}>
        {ext || <Icon name="file" size={16} />}
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
              style={btnStyle("#10b981", true)}
            >
              Opslaan
            </button>
            <button type="button" onClick={() => { setRenaming(false); setName(file.fileName); }} style={btnStyle("#64748b")}>
              Annuleren
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", wordBreak: "break-word" }}>{file.fileName}</div>
        )}
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
          {formatBytes(file.size)} · {formatDateTime(file.uploadedAt)}
          {file.uploadedByName && ` · ${file.uploadedByName}`}
          {file.originalFileName && file.originalFileName !== file.fileName && ` · origineel: ${file.originalFileName}`}
        </div>
      </div>
      <select
        value={file.category || "other"}
        onChange={(e) => run(() => updateLeadFile(lead, file, { category: e.target.value }))}
        style={{ ...inputStyle, width: "auto", fontSize: 12 }}
        aria-label="Categorie"
      >
        {FILE_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" title="Bekijken" onClick={() => run(() => openLeadFile(file))} style={btnStyle("#6366f1")}>
          <Icon name="eye" size={13} /> Bekijken
        </button>
        <button type="button" title="Downloaden" onClick={() => run(() => downloadLeadFile(file))} style={btnStyle("#0ea5e9")}>
          <Icon name="download" size={13} />
        </button>
        {!renaming && (
          <button type="button" title="Hernoemen" onClick={() => setRenaming(true)} style={btnStyle("#64748b")}>
            <Icon name="edit" size={13} />
          </button>
        )}
        <button
          type="button"
          title="Verwijderen"
          onClick={() => {
            if (window.confirm(`'${file.fileName}' definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`)) run(() => deleteLeadFile(lead, file, user));
          }}
          style={btnStyle("#ef4444")}
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "end" }}>
          <SelectField label="Categorie" value={category} onChange={setCategory} options={FILE_CATEGORIES} allowEmpty={false} />
          <div>
            <input ref={inputRef} type="file" multiple accept={FILE_ACCEPT_ATTR} onChange={(e) => handleFiles(e.target.files)} style={{ display: "none" }} />
            <button type="button" disabled={Boolean(progress)} onClick={() => inputRef.current?.click()} style={{ ...btnStyle("#6366f1", true), padding: "9px 16px", fontSize: 13 }}>
              <Icon name="upload" size={14} /> {progress ? "Uploaden..." : "Bestand kiezen"}
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
          Toegestaan: {Object.keys(ALLOWED_FILE_TYPES).map((e) => e.toUpperCase()).join(", ")} · maximaal {MAX_FILE_SIZE_MB} MB per bestand.
        </div>
        {progress && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
              {progress.name} – {progress.pct}%
            </div>
            <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99 }}>
              <div style={{ width: `${progress.pct}%`, height: 6, background: "#6366f1", borderRadius: 99, transition: "width .2s" }} />
            </div>
          </div>
        )}
      </Panel>

      {error && <Notice tone="error">{error}</Notice>}
      {files.error && <Notice tone="error">Bestanden konden niet worden geladen.</Notice>}

      <Panel
        title={`Bestanden (${files.items.length})`}
        right={
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: 12 }} aria-label="Filter categorie">
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
          items.map((f) => <FileRow key={f.id} file={f} lead={lead} user={user} onError={setError} />)
        ) : (
          <Empty>{filter ? `Geen bestanden in categorie ${labelOf(FILE_CATEGORIES, filter)}.` : "Nog geen bestanden."}</Empty>
        )}
        {files.items.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <Badge>PDF's en afbeeldingen openen in een nieuw tabblad</Badge>
          </div>
        )}
      </Panel>
    </div>
  );
}
