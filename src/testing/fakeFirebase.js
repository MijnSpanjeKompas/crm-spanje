// ─── IN-MEMORY FAKE VAN FIRESTORE + STORAGE (alleen voor tests) ─────────────
// Implementeert precies het deel van de Firebase SDK dat src/crm/services.js
// gebruikt. Is bewust streng: `undefined` in data en updates op niet-bestaande
// documenten geven een fout, net als de echte Firestore.

let docs = new Map(); // path -> data
let files = new Map(); // storage path -> {file, metadata}
let listeners = new Set();
let idCounter = 0;

class ServerTimestamp {}
class Increment {
  constructor(n) {
    this.n = n;
  }
}

export function __reset() {
  docs = new Map();
  files = new Map();
  listeners = new Set();
  idCounter = 0;
}
export function __dump() {
  return { docs: new Map(docs), files: new Map(files) };
}
export function __getDoc(path) {
  return docs.has(path) ? deepCopy(docs.get(path)) : undefined;
}
export function __setDoc(path, data) {
  docs.set(path, deepCopy(data));
  notify();
}
export function __files() {
  return files;
}

function deepCopy(v) {
  if (v instanceof Date) return new Date(v.getTime());
  if (Array.isArray(v)) return v.map(deepCopy);
  if (v && typeof v === "object") {
    const out = {};
    Object.entries(v).forEach(([k, x]) => (out[k] = deepCopy(x)));
    return out;
  }
  return v;
}

function assertNoUndefined(v, path = "") {
  if (v === undefined) throw new Error(`Function called with invalid data. Unsupported field value: undefined (found in field ${path})`);
  if (v instanceof Date || v instanceof ServerTimestamp || v instanceof Increment) return;
  if (Array.isArray(v)) {
    v.forEach((x, i) => {
      if (Array.isArray(x)) throw new Error(`Nested arrays are not supported (${path})`);
      assertNoUndefined(x, `${path}[${i}]`);
    });
    return;
  }
  if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => assertNoUndefined(x, path ? `${path}.${k}` : k));
}

function resolve(value, previous) {
  if (value instanceof ServerTimestamp) return new Date();
  if (value instanceof Increment) return (Number(previous) || 0) + value.n;
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map((x) => resolve(x));
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([k, x]) => (out[k] = resolve(x, previous ? previous[k] : undefined)));
    return out;
  }
  return value;
}

function newId() {
  idCounter += 1;
  return `id${String(idCounter).padStart(4, "0")}`;
}

// ─── REFS ────────────────────────────────────────────────────────────────────
export function getFirestore() {
  return { __fake: "firestore" };
}

export function collection(parent, ...segments) {
  const base = parent && parent.type === "doc" ? [parent.path] : [];
  const path = [...base, ...segments].join("/");
  return { type: "collection", path, id: segments[segments.length - 1] };
}

export function doc(parent, ...segments) {
  if (parent && parent.type === "collection") {
    const id = segments.length ? segments.join("/") : newId();
    return { type: "doc", path: `${parent.path}/${id}`, id };
  }
  const path = segments.join("/");
  return { type: "doc", path, id: segments[segments.length - 1] };
}

function childrenOf(colPath) {
  const depth = colPath.split("/").length + 1;
  return Array.from(docs.keys())
    .filter((p) => p.startsWith(`${colPath}/`) && p.split("/").length === depth)
    .sort();
}

function docSnap(path) {
  const exists = docs.has(path);
  return {
    id: path.split("/").pop(),
    ref: { type: "doc", path, id: path.split("/").pop() },
    exists: () => exists,
    data: () => (exists ? deepCopy(docs.get(path)) : undefined),
  };
}

function colSnap(path) {
  const d = childrenOf(path).map(docSnap);
  return { docs: d, size: d.length, empty: d.length === 0 };
}

// ─── READS ───────────────────────────────────────────────────────────────────
export async function getDocs(colRef) {
  return colSnap(colRef.path);
}

export async function getDoc(docRef) {
  return docSnap(docRef.path);
}

export function onSnapshot(ref, next) {
  const l = () => next(ref.type === "collection" ? colSnap(ref.path) : docSnap(ref.path));
  listeners.add(l);
  l();
  return () => listeners.delete(l);
}

function notify() {
  Array.from(listeners).forEach((l) => l());
}

// ─── WRITES ──────────────────────────────────────────────────────────────────
function applySet(ref, data, opts) {
  assertNoUndefined(data);
  const prev = docs.get(ref.path);
  const resolved = resolve(data, prev);
  docs.set(ref.path, opts && opts.merge && prev ? { ...prev, ...resolved } : resolved);
}

function applyUpdate(ref, data) {
  assertNoUndefined(data);
  if (!docs.has(ref.path)) {
    const e = new Error(`No document to update: ${ref.path}`);
    e.code = "not-found";
    throw e;
  }
  const prev = docs.get(ref.path);
  const next = { ...prev };
  Object.entries(data).forEach(([k, v]) => {
    if (k.includes(".")) throw new Error("Dotted field paths not supported in fake");
    next[k] = resolve(v, prev[k]);
  });
  docs.set(ref.path, next);
}

export async function setDoc(ref, data, opts) {
  applySet(ref, data, opts);
  notify();
}

export async function updateDoc(ref, data) {
  applyUpdate(ref, data);
  notify();
}

export async function deleteDoc(ref) {
  docs.delete(ref.path);
  notify();
}

export async function addDoc(colRef, data) {
  const ref = doc(colRef);
  applySet(ref, data);
  notify();
  return ref;
}

export function writeBatch() {
  const ops = [];
  return {
    set: (ref, data, opts) => ops.push(() => applySet(ref, data, opts)),
    update: (ref, data) => ops.push(() => applyUpdate(ref, data)),
    delete: (ref) => ops.push(() => docs.delete(ref.path)),
    commit: async () => {
      const snapshot = new Map(docs);
      try {
        ops.forEach((op) => op());
      } catch (e) {
        docs = snapshot; // atomisch: alles of niets
        throw e;
      }
      notify();
    },
  };
}

export function serverTimestamp() {
  return new ServerTimestamp();
}

export function increment(n) {
  return new Increment(n);
}

export class Timestamp {
  constructor(seconds, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  toDate() {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1e6);
  }
  toMillis() {
    return this.seconds * 1000 + this.nanoseconds / 1e6;
  }
  static fromDate(d) {
    return new Timestamp(Math.floor(d.getTime() / 1000), (d.getTime() % 1000) * 1e6);
  }
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────
export function getStorage() {
  return { __fake: "storage" };
}

export function ref(_storage, path) {
  return { fullPath: path };
}

export function uploadBytesResumable(storageRef, file, metadata) {
  return {
    on(_event, progress, error, complete) {
      Promise.resolve().then(() => {
        const size = file.size || 0;
        if (progress) progress({ bytesTransferred: size, totalBytes: size || 1 });
        files.set(storageRef.fullPath, { file, metadata });
        if (complete) complete();
      });
    },
  };
}

export async function getDownloadURL(storageRef) {
  if (!files.has(storageRef.fullPath)) {
    const e = new Error("not found");
    e.code = "storage/object-not-found";
    throw e;
  }
  return `https://fake-storage.local/${encodeURIComponent(storageRef.fullPath)}?token=x`;
}

export async function getBlob(storageRef) {
  if (!files.has(storageRef.fullPath)) {
    const e = new Error("not found");
    e.code = "storage/object-not-found";
    throw e;
  }
  return files.get(storageRef.fullPath).file;
}

export async function deleteObject(storageRef) {
  if (!files.has(storageRef.fullPath)) {
    const e = new Error("not found");
    e.code = "storage/object-not-found";
    throw e;
  }
  files.delete(storageRef.fullPath);
}
