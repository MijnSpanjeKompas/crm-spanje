// ─── UITGEBREIDE SAMENVATTING ALS ECHTE PDF ─────────────────────────────────
// Maakt het PDF-bestand zelf (pdfmake), dus zonder het printvenster van de
// browser. Daardoor staat er geen link, datum of "about:blank" onderaan.
// Opmaak: logo + gouden lijn bovenaan, navy koppen, voettekst met paginanummer.

const NAVY = "#0d2b4a";
const TEXT = "#1d2a38";
const MUTED = "#6b7785";
const GOLD = "#e5b13a";
const FOOTER_TEXT = "Mijn Spanje Kompas – leadsamenvatting";
const MARGIN = 51; // ± 18 mm

/** Tekens die niet in het standaardlettertype zitten vervangen. */
function safe(text) {
  // Unicode-escapes: werkt ook als het script zonder utf-8 wordt geladen.
  return String(text).replace(/[\u2192\u2794\u27f6]/g, "\u203a").replace(/\u2190/g, "\u2039").replace(/[\u2713\u2714]/g, "\u00b7");
}

/** **vet** → pdfmake-tekstdelen. */
function inline(text) {
  const parts = safe(text).split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== "");
  return parts.map((p) => (/^\*\*[^*]+\*\*$/.test(p) ? { text: p.slice(2, -2), bold: true } : { text: p }));
}

/** Markdown (koppen, alinea's, bullets, genummerd) → pdfmake-content. */
export function markdownToPdfContent(md) {
  const lines = String(md || "").replace(/\r/g, "").split("\n");
  const content = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) {
      const runs = [];
      para.forEach((line, i) => {
        if (i) runs.push({ text: "\n" });
        runs.push(...inline(line));
      });
      content.push({ text: runs, style: "body" });
    }
    para = [];
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((t) => ({ text: inline(t), style: "listItem" }));
      content.push(list.type === "ol" ? { ol: items, style: "list" } : { ul: items, style: "list" });
    }
    list = null;
  };
  lines.forEach((raw) => {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
      flushPara();
      flushList();
      content.push({ text: inline(m[2]), style: m[1].length === 1 ? "h1" : m[1].length === 2 ? "h2" : "h3", headlineLevel: m[1].length });
    } else if ((m = /^\s*[-*•]\s+(.*)$/.exec(line))) {
      flushPara();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(m[1]);
    } else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      flushPara();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(m[1]);
    } else {
      flushList();
      para.push(line.replace(/^>\s?/, ""));
    }
  });
  flushPara();
  flushList();
  return content;
}

export function buildDocDefinition(markdown, { logo, title } = {}) {
  const header = {
    columns: [
      logo ? { image: logo, fit: [90, 34], width: "auto" } : { text: "Mijn Spanje Kompas", bold: true, color: NAVY, fontSize: 12, width: "auto" },
      { text: FOOTER_TEXT, alignment: "right", fontSize: 8.5, color: MUTED, margin: [0, 12, 0, 0] },
    ],
    margin: [0, 0, 0, 8],
  };
  const line = { canvas: [{ type: "line", x1: 0, y1: 0, x2: 595.28 - 2 * MARGIN, y2: 0, lineWidth: 2.5, lineColor: GOLD }], margin: [0, 0, 0, 16] };
  return {
    pageSize: "A4",
    pageMargins: [MARGIN, MARGIN, MARGIN, MARGIN + 6],
    info: { title: title || "Leadsamenvatting", author: "Mijn Spanje Kompas", creator: "Mijn Spanje Kompas" },
    content: [header, line, ...markdownToPdfContent(markdown)],
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: FOOTER_TEXT, fontSize: 8, color: MUTED },
        { text: `Pagina ${currentPage} van ${pageCount}`, alignment: "right", fontSize: 8, color: MUTED },
      ],
      margin: [MARGIN, 18, MARGIN, 0],
    }),
    // Kop nooit alleen onderaan een pagina.
    pageBreakBefore: (node, following) => Boolean(node.headlineLevel === 2 && following.length === 0),
    defaultStyle: { font: "Roboto", fontSize: 10.5, color: TEXT, lineHeight: 1.3 },
    styles: {
      h1: { fontSize: 18, bold: true, color: NAVY, margin: [0, 0, 0, 10], lineHeight: 1.15 },
      h2: { fontSize: 12.5, bold: true, color: NAVY, margin: [0, 12, 0, 4] },
      h3: { fontSize: 11, bold: true, color: NAVY, margin: [0, 8, 0, 3] },
      body: { margin: [0, 0, 0, 6] },
      list: { margin: [4, 0, 0, 6] },
      listItem: { margin: [0, 1, 0, 1] },
    },
  };
}

export function pdfFileName(leadName) {
  const clean = String(leadName || "lead").replace(/[\\/:*?"<>|]+/g, "").trim() || "lead";
  return `Leadsamenvatting ${clean}.pdf`;
}

let pdfMakePromise = null;
/** Laadt pdfmake pas als het nodig is (houdt de app zelf klein). */
export function loadPdfMake() {
  if (!pdfMakePromise) {
    pdfMakePromise = Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")])
      .then(([pm, fonts]) => {
        const pdfMake = pm.default || pm;
        const f = fonts.default || fonts;
        pdfMake.vfs = (f.pdfMake && f.pdfMake.vfs) || f.vfs || f;
        return pdfMake;
      })
      .catch((e) => {
        pdfMakePromise = null;
        throw e;
      });
  }
  return pdfMakePromise;
}

let logoPromise = null;
function loadLogo() {
  if (!logoPromise) {
    logoPromise = fetch("/msk-logo.png")
      .then((r) => (r.ok ? r.blob() : null))
      .then(
        (blob) =>
          blob &&
          new Promise((resolve) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = () => resolve(null);
            fr.readAsDataURL(blob);
          })
      )
      .catch(() => null);
  }
  return logoPromise;
}

/** Vooraf laden zodat "PDF maken" direct reageert (belangrijk voor delen op iPhone). */
export function preloadPdf() {
  if (process.env.NODE_ENV === "test") return;
  loadPdfMake().catch(() => {});
  loadLogo();
}

export async function createSummaryPdf(markdown, leadName) {
  const [pdfMake, logo] = await Promise.all([loadPdfMake(), loadLogo()]);
  const name = pdfFileName(leadName);
  const doc = pdfMake.createPdf(buildDocDefinition(markdown, { logo, title: name.replace(/\.pdf$/, "") }));
  const blob = await new Promise((resolve, reject) => {
    try {
      doc.getBlob(resolve);
    } catch (e) {
      reject(e);
    }
  });
  return new File([blob], name, { type: "application/pdf" });
}

function isTouchDevice() {
  return typeof navigator !== "undefined" && (navigator.maxTouchPoints > 0 || /iPhone|iPad|Android/i.test(navigator.userAgent || ""));
}

/**
 * Geeft het bestand aan de gebruiker: op telefoon via het deelmenu (WhatsApp,
 * Mail, Bewaar in Bestanden), op de computer als download.
 * @returns {Promise<boolean>} false als de browser het blokkeerde (dan opnieuw klikken).
 */
export async function deliverFile(file) {
  if (isTouchDevice() && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return true;
    } catch (e) {
      if (e && e.name === "AbortError") return true; // zelf geannuleerd
      if (e && e.name !== "NotAllowedError") throw e;
      return false;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return true;
}

/** Maakt de PDF en biedt hem aan. Geeft het bestand terug als delen opnieuw moet. */
export async function shareSummaryPdf(markdown, leadName) {
  const file = await createSummaryPdf(markdown, leadName);
  const delivered = await deliverFile(file);
  return delivered ? null : file;
}
