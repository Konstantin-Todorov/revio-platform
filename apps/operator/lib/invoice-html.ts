/**
 * The invoice document, as markup — ONE definition, used for both the screen and the download.
 *
 * The obvious build is a React page for viewing plus an HTML string for the file. That is two
 * definitions of the same legal document, and they drift: someone fixes the VAT line on the screen,
 * the file keeps the old one, and the copy that is WRONG is the copy the customer receives. So the
 * markup is generated once here; the page embeds the body, the download wraps it in a full document.
 *
 * ## Why HTML and not PDF
 *
 * A server-rendered PDF means headless Chromium in the container — a large binary and a hungry
 * process — on a platform already taken down once by a compute limit. This is ~12KB, generated on
 * demand, **stored nowhere**, opens in any browser on any device, and prints to PDF from there.
 * Storage cost zero, hosting cost zero, dependency count zero.
 *
 * ## Escaping
 *
 * Every value below is typed by a person — a company name, an address, a footer note — so all of it
 * is escaped. Interpolating a legal name into markup is exactly where an apostrophe in "O'Brien Ltd"
 * breaks a document, quite apart from anyone doing it on purpose.
 */

export function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface InvoiceDocLine {
  description: string;
  netMinor: number;
}

export interface InvoiceDocData {
  number: string | null;
  period: string;
  issuedAt: Date | null;
  dueDate: Date | null;
  currency: string;
  issuerName: string | null;
  issuerVatId: string | null;
  issuerCompanyId: string | null;
  issuerAddress: string | null;
  issuerIban: string | null;
  issuerBic: string | null;
  issuerBankName: string | null;
  issuerEmail: string | null;
  buyerName: string | null;
  buyerVatId: string | null;
  buyerCompanyId: string | null;
  buyerAddress: string | null;
  buyerAttention: string | null;
  lines: InvoiceDocLine[];
  netMinor: number;
  taxMinor: number;
  grossMinor: number;
  vatRatePct: number;
  vatTreatment: string | null;
  vatNote: string | null;
  footerNote: string | null;
}

export function money(minor: number, currency: string): string {
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : `${currency} `;
  const neg = minor < 0;
  const n = (Math.abs(minor) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${neg ? "−" : ""}${sym}${n}`;
}

export function day(d: Date | null): string {
  return d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

/** The VAT line's label. A zero with no stated reason is not a valid invoice. */
export function vatLineLabel(treatment: string | null, ratePct: number): string {
  if (treatment === "eu_reverse_charge") return "VAT — reverse charge (0%)";
  if (treatment === "outside_eu") return "VAT — outside scope (0%)";
  if (treatment === "not_registered") return "VAT — not registered (0%)";
  return `VAT ${ratePct}%`;
}

/**
 * The document body. Plain semantic HTML with its own class names, deliberately independent of
 * Tailwind — the downloaded file has no stylesheet to load and must look identical offline, on a
 * phone, and in a printer, a year from now.
 */
export function invoiceBodyHtml(d: InvoiceDocData): string {
  const cur = d.currency;
  const lines = d.lines.length
    ? d.lines
    : [{ description: "Monthly subscription", netMinor: d.netMinor }];

  const row = (l: InvoiceDocLine) =>
    `<tr><td>${esc(l.description)}</td><td class="num">${esc(money(l.netMinor, cur))}</td></tr>`;

  const payment =
    d.issuerIban || d.issuerBankName
      ? `<section class="pay">
      <h3>Payment</h3>
      <dl>
        ${d.issuerBankName ? `<dt>Bank</dt><dd>${esc(d.issuerBankName)}</dd>` : ""}
        ${d.issuerIban ? `<dt>IBAN</dt><dd class="mono">${esc(d.issuerIban)}</dd>` : ""}
        ${d.issuerBic ? `<dt>BIC</dt><dd class="mono">${esc(d.issuerBic)}</dd>` : ""}
        ${d.number ? `<dt>Reference</dt><dd class="mono">${esc(d.number)}</dd>` : ""}
      </dl>
    </section>`
      : "";

  return `<article class="doc">
  <header>
    <div class="issuer">
      <div class="name">${esc(d.issuerName ?? "—")}</div>
      ${d.issuerAddress ? `<div>${esc(d.issuerAddress)}</div>` : ""}
      ${d.issuerVatId ? `<div>VAT ${esc(d.issuerVatId)}</div>` : ""}
      ${d.issuerCompanyId ? `<div>Company no. ${esc(d.issuerCompanyId)}</div>` : ""}
      ${d.issuerEmail ? `<div>${esc(d.issuerEmail)}</div>` : ""}
    </div>
    <div class="meta">
      <div class="title">Invoice</div>
      <div class="number mono">${esc(d.number ?? "— not issued —")}</div>
      <dl>
        <dt>Issued</dt><dd class="mono">${esc(day(d.issuedAt))}</dd>
        <dt>Due</dt><dd class="mono">${esc(day(d.dueDate))}</dd>
        <dt>Period</dt><dd class="mono">${esc(d.period)}</dd>
      </dl>
    </div>
  </header>

  <section class="billto">
    <h3>Bill to</h3>
    <div class="name">${esc(d.buyerName ?? "—")}</div>
    ${d.buyerAttention ? `<div>FAO ${esc(d.buyerAttention)}</div>` : ""}
    ${d.buyerAddress ? `<div>${esc(d.buyerAddress)}</div>` : ""}
    ${d.buyerVatId ? `<div>VAT ${esc(d.buyerVatId)}</div>` : ""}
    ${d.buyerCompanyId ? `<div>Company no. ${esc(d.buyerCompanyId)}</div>` : ""}
  </section>

  <table class="lines">
    <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
    <tbody>${lines.map(row).join("")}</tbody>
  </table>

  <div class="totals">
    <dl>
      <dt>Subtotal (excl. VAT)</dt><dd class="num">${esc(money(d.netMinor, cur))}</dd>
      <dt>${esc(vatLineLabel(d.vatTreatment, d.vatRatePct))}</dt><dd class="num">${esc(money(d.taxMinor, cur))}</dd>
      <dt class="grand">Total due</dt><dd class="num grand">${esc(money(d.grossMinor, cur))}</dd>
    </dl>
  </div>

  ${d.vatNote ? `<p class="note">${esc(d.vatNote)}</p>` : ""}
  ${payment}

  <footer>
    ${d.footerNote ? `<div>${esc(d.footerNote)}</div>` : ""}
    <div>All amounts are exclusive of VAT unless stated otherwise.</div>
  </footer>
</article>`;
}

/**
 * The document's own styles, used by BOTH the screen and the downloaded file.
 *
 * Split from the page chrome below on purpose: embedded in the console the surrounding page already
 * has a background and a font, and a `body` rule from here would fight the app shell. The standalone
 * file has no shell, so it needs both halves.
 */
export const INVOICE_DOC_CSS = `
.doc { box-sizing: border-box; font: 14px/1.5 ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1c2434; max-width: 780px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 10px; border: 1px solid #e4e7ec; }
.doc .mono, .doc .num { font-variant-numeric: tabular-nums; }
.doc h3 { margin: 0 0 6px; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #8a94a6; }
.doc header { display: flex; justify-content: space-between; gap: 40px; border-bottom: 1px solid #e4e7ec; padding-bottom: 24px; }
.doc header .issuer .name { font-size: 15px; font-weight: 700; }
.doc header .issuer div + div, .doc .billto div + div { font-size: 11.5px; color: #6b7486; margin-top: 2px; }
.doc header .meta { text-align: right; }
.doc header .meta .title { font-size: 21px; font-weight: 700; text-transform: uppercase; letter-spacing: -.02em; }
.doc header .meta .number { margin-top: 3px; font-size: 13px; font-weight: 600; color: #414c60; }
.doc header .meta dl { display: grid; grid-template-columns: auto auto; gap: 1px 12px; justify-content: end; margin: 12px 0 0; font-size: 11.5px; color: #6b7486; }
.doc header .meta dd { margin: 0; font-weight: 500; color: #414c60; }
.doc .billto { padding: 24px 0; }
.doc .billto .name { font-size: 14px; font-weight: 600; }
.doc table.lines { width: 100%; border-collapse: collapse; font-size: 13px; }
.doc table.lines th { text-align: left; font-size: 10.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: #8a94a6; padding: 8px 0; border-top: 1px solid #e4e7ec; border-bottom: 1px solid #e4e7ec; }
.doc table.lines td { padding: 10px 0; border-bottom: 1px solid #eef0f3; color: #414c60; }
.doc .num { text-align: right; }
.doc .totals { display: flex; justify-content: flex-end; margin-top: 20px; }
.doc .totals dl { width: 290px; display: grid; grid-template-columns: 1fr auto; gap: 6px 16px; margin: 0; font-size: 13px; }
.doc .totals dt { color: #6b7486; }
.doc .totals dd { margin: 0; font-weight: 500; }
.doc .totals .grand { border-top: 1.5px solid #1c2434; padding-top: 8px; font-weight: 700; font-size: 15px; color: #1c2434; }
.doc .note { margin-top: 18px; padding-left: 12px; border-left: 2px solid #e4e7ec; font-size: 11.5px; color: #6b7486; }
.doc .pay { margin-top: 24px; background: #f7f8fa; border-radius: 6px; padding: 14px 16px; }
.doc .pay dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 16px; margin: 0; font-size: 12px; }
.doc .pay dt { color: #6b7486; }
.doc .pay dd { margin: 0; font-weight: 500; }
.doc footer { margin-top: 26px; border-top: 1px solid #e4e7ec; padding-top: 16px; font-size: 11px; color: #8a94a6; }
@media print {
  .doc { border: 0; border-radius: 0; padding: 0; max-width: none; }
  .doc tr, .doc .pay, .doc .totals { break-inside: avoid; }
}
`;

/** The page around the document — only the standalone file needs this. */
export const INVOICE_PAGE_CSS = `
:root { color-scheme: light; }
body { margin: 0; padding: 28px 20px; background: #f4f5f7; }
@media print {
  body { background: #fff; padding: 0; }
  @page { margin: 16mm; }
}
`;

/**
 * The complete standalone file.
 *
 * Self-contained on purpose: no external stylesheet, no font request, no script. It has to render
 * identically when it is opened from a download folder with no network, because that is where an
 * accountant will open it.
 */
export function invoiceFileHtml(d: InvoiceDocData): string {
  const title = d.number ? `Invoice ${d.number}` : `Invoice draft — ${d.period}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${INVOICE_PAGE_CSS}${INVOICE_DOC_CSS}</style>
</head>
<body>
${invoiceBodyHtml(d)}
</body>
</html>`;
}

/**
 * `REV-2026-0001.html` — the number is what an accountant files it under.
 *
 * The stem goes into a `Content-Disposition` header, so it is reduced to a safe alphabet: no quote
 * to close the filename early, no CR/LF to inject a header, no slash to suggest a path. Runs of dots
 * are collapsed too — harmless without a slash, but `..-..-etc` is not a filename anyone should be
 * handed. The prefix that feeds it is typed into the company form, so it is input like any other.
 */
export function invoiceFileName(d: Pick<InvoiceDocData, "number" | "period">): string {
  const stem = (d.number ?? `invoice-draft-${d.period}`)
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.-]+/, "")
    .slice(0, 80);
  return `${stem || "invoice"}.html`;
}
