/**
 * A minimal .xlsx writer — no dependency.
 *
 * WHY NOT A LIBRARY. `xlsx`/SheetJS and `exceljs` both pull a large transitive tree into a codebase
 * that has deliberately stayed dependency-light, and a spreadsheet writer is the kind of thing this
 * platform needs 5% of. What follows is that 5%: a workbook of typed cells and nothing else — no
 * formulas, no styling beyond a bold header, no images, no charts.
 *
 * WHY .xlsx AND NOT ONLY CSV. Two reasons, neither cosmetic:
 *
 *  - **Numbers arrive as numbers.** A CSV of money opened on a machine whose locale uses a comma
 *    decimal separator turns 1.234,56 into something else, or into text. A typed cell cannot be
 *    reinterpreted by a locale.
 *  - **ЕСТИ publishes an Excel образец.** The register is filed against that template, so handing
 *    the hotel a real workbook is closer to what the Ministry asks for than a CSV to convert first.
 *
 * CSV stays alongside it: it opens anywhere, and some people genuinely want it.
 *
 * The ZIP uses the STORED method — no compression. A month of a hotel's register is tens of
 * kilobytes, so deflate would buy nothing and cost a zlib round trip and a class of bug.
 */

export type XlsxCell = string | number | null;

export interface XlsxSheet {
  /** Excel forbids : \\ / ? * [ ] in a sheet name and caps it at 31 chars. Sanitised on write. */
  name: string;
  /** Row 0 is treated as the header and rendered bold. */
  rows: readonly (readonly XlsxCell[])[];
}

// --- XML ---------------------------------------------------------------------

/**
 * Characters XML 1.0 cannot carry under ANY escaping — not even as a numeric reference.
 *
 * The control-character class is the point of the expression, so the rule is disabled here rather
 * than the expression weakened: a stray byte in a guest's name has to cost the byte, not the
 * workbook.
 */
// eslint-disable-next-line no-control-regex
const ILLEGAL_XML = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;")
    // A stray control byte in a guest's name would make the whole workbook unopenable, which is a
    // worse outcome than losing the byte.
    .replace(ILLEGAL_XML, "");
}

/** `A1`, `Z1`, `AA1` — the column letter for a zero-based index, plus the 1-based row. */
export function cellRef(col: number, row: number): string {
  let s = "";
  for (let n = col; n >= 0; n = Math.floor(n / 26) - 1) {
    s = String.fromCharCode(65 + (n % 26)) + s;
  }
  return `${s}${row + 1}`;
}

export function sanitiseSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned === "" ? "Sheet" : cleaned).slice(0, 31);
}

function sheetXml(sheet: XlsxSheet): string {
  const rows = sheet.rows.map((cells, r) => {
    const body = cells.map((v, c) => {
      const ref = cellRef(c, r);
      // The header row carries style 1 (bold); everything else style 0.
      const style = r === 0 ? ' s="1"' : "";
      if (v === null || v === "") return `<c r="${ref}"${style}/>`;
      if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
      // Inline strings rather than a shared-string table: one fewer part, one fewer index to keep
      // consistent, and the saving only matters for files far larger than these.
      return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
    }).join("");
    return `<row r="${r + 1}">${body}</row>`;
  }).join("");

  const widest = sheet.rows.reduce((n, r) => Math.max(n, r.length), 0);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    // Excel's default 8.43 leaves every column of a register clipped.
    (widest > 0 ? `<cols><col min="1" max="${widest}" width="18" customWidth="1"/></cols>` : "") +
    `<sheetData>${rows}</sheetData></worksheet>`;
}

// --- ZIP (STORED) -------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u8(...parts: (Uint8Array | number[])[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p instanceof Uint8Array ? p : new Uint8Array(p), o); o += p.length; }
  return out;
}

const le16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
const le32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

function zip(files: { name: string; text: string }[]): Uint8Array {
  const enc = new TextEncoder();
  const entries: { name: string; size: number; crc: number; offset: number }[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = enc.encode(f.text);
    const crc = crc32(data);
    const header = u8(
      le32(0x04034b50), le16(20), le16(0), le16(0),
      // A FIXED DOS timestamp (1 Jan 1980). A real clock makes the bytes of two identical exports
      // differ, which makes them impossible to compare in a test or a diff.
      le16(0), le16(0x21),
      le32(crc), le32(data.length), le32(data.length),
      le16(nameBytes.length), le16(0),
      nameBytes,
    );
    entries.push({ name: f.name, size: data.length, crc, offset });
    chunks.push(header, data);
    offset += header.length + data.length;
  }

  const central: Uint8Array[] = [];
  let centralSize = 0;
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const rec = u8(
      le32(0x02014b50), le16(20), le16(20), le16(0), le16(0),
      le16(0), le16(0x21),
      le32(e.crc), le32(e.size), le32(e.size),
      le16(nameBytes.length), le16(0), le16(0), le16(0), le16(0),
      le32(0), le32(e.offset),
      nameBytes,
    );
    central.push(rec);
    centralSize += rec.length;
  }

  const end = u8(
    le32(0x06054b50), le16(0), le16(0),
    le16(entries.length), le16(entries.length),
    le32(centralSize), le32(offset), le16(0),
  );
  return u8(...chunks, ...central, end);
}

// --- workbook -----------------------------------------------------------------

/** Bold header, everything else plain. The whole styling budget, and enough. */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="1"><fill><patternFill patternType="none"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
</styleSheet>`;

/** Build a workbook. Returns the raw bytes of a .xlsx file. */
export function buildXlsx(sheets: readonly XlsxSheet[]): Uint8Array {
  // A workbook with no sheets cannot be opened at all, so an empty export gets an empty sheet
  // rather than a corrupt file — "no rows" is a real answer and has to survive the round trip.
  const list = sheets.length > 0 ? sheets : [{ name: "Sheet1", rows: [] as XlsxCell[][] }];
  const names = list.map((s, i) => sanitiseSheetName(s.name || `Sheet${i + 1}`));

  const files = [
    {
      name: "[Content_Types].xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
        `</Types>`,
    },
    {
      name: "_rels/.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>` + names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") + `</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
        `<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { name: "xl/styles.xml", text: STYLES },
    ...list.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, text: sheetXml(s) })),
  ];

  return zip(files);
}

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
