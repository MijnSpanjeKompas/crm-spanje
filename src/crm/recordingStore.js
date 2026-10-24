// ─── LOKALE BACKUP VAN OPNAMES (IndexedDB op dit toestel) ───────────────────
// Tijdens het opnemen wordt elke paar seconden een stukje audio op het toestel
// zelf opgeslagen. Valt de wifi weg, crasht de browser of is de batterij leeg,
// dan staat alles tot dat moment nog hier. Pas als de server bevestigt dat de
// upload gelukt is, wordt de lokale kopie verwijderd.
// Werkt niet in privé-vensters of als IndexedDB ontbreekt; dan geeft available()
// false terug en loopt de opname gewoon door (zonder lokale backup).

const DB_NAME = "msk-opnames";
const DB_VERSION = 1;
let dbPromise = null;

export function available() {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function openDb() {
  if (!available()) return Promise.reject(new Error("IndexedDB niet beschikbaar"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("recs")) db.createObjectStore("recs", { keyPath: "id" });
        if (!db.objectStoreNames.contains("chunks")) db.createObjectStore("chunks", { keyPath: ["recId", "idx"] });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("IndexedDB geblokkeerd"));
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

function tx(storeNames, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeNames, mode);
        let result;
        Promise.resolve(fn(t, (r) => (result = r))).catch(reject);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error("Transactie afgebroken"));
      })
  );
}

/** Vraagt de browser de opslag niet automatisch op te ruimen (best effort). */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
  } catch (e) {
    /* geen probleem */
  }
}

export function putMeta(meta) {
  return tx(["recs"], "readwrite", (t) => {
    t.objectStore("recs").put({ ...meta, updatedAt: Date.now() });
  });
}

export function patchMeta(id, patch) {
  return tx(["recs"], "readwrite", (t) => {
    const store = t.objectStore("recs");
    const req = store.get(id);
    req.onsuccess = () => {
      if (req.result) store.put({ ...req.result, ...patch, updatedAt: Date.now() });
    };
  });
}

export function addChunk(recId, idx, blob) {
  return tx(["chunks", "recs"], "readwrite", (t) => {
    t.objectStore("chunks").put({ recId, idx, blob });
    const recs = t.objectStore("recs");
    const req = recs.get(recId);
    req.onsuccess = () => {
      if (req.result) recs.put({ ...req.result, chunkCount: Math.max(req.result.chunkCount || 0, idx + 1), updatedAt: Date.now() });
    };
  });
}

export function listRecs(leadId) {
  return tx(["recs"], "readonly", (t, done) => {
    const req = t.objectStore("recs").getAll();
    req.onsuccess = () => done((req.result || []).filter((r) => !leadId || r.leadId === leadId).sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0)));
  }).catch(() => []);
}

/** Plakt alle opgeslagen stukjes weer aan elkaar tot één audiobestand. */
export function getBlob(rec) {
  return tx(["chunks"], "readonly", (t, done) => {
    const range = IDBKeyRange.bound([rec.id, 0], [rec.id, Number.MAX_SAFE_INTEGER]);
    const req = t.objectStore("chunks").getAll(range);
    req.onsuccess = () => {
      const parts = (req.result || []).sort((a, b) => a.idx - b.idx).map((c) => c.blob);
      done(parts.length ? new Blob(parts, { type: rec.mimeType || parts[0].type || "audio/mp4" }) : null);
    };
  });
}

export function deleteRec(id) {
  return tx(["chunks", "recs"], "readwrite", (t) => {
    t.objectStore("recs").delete(id);
    t.objectStore("chunks").delete(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
  });
}
