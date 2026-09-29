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
// The one rule this file must not re-derive: whether the law permits a VAT line at all. It lives
// beside `decideVat` so the document and the decision cannot disagree.
import { suppressesVatLine } from "./vat";
import { amountInWords } from "./amount-words";

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
  /** Settlement, when there is one. A paid invoice has to look paid. */
  paid?: { on: string; via: string | null; reference: string | null } | null;
  /** "bg" for a Bulgarian buyer, "en" otherwise — frozen at issue. Absent = English (older invoices). */
  language?: "bg" | "en";
  /** МОЛ on each side — "Получател" and "Съставил" at the foot of a Bulgarian invoice. */
  issuerRepresentative?: string | null;
  buyerRepresentative?: string | null;
  /** "Място на сделката". */
  issuePlace?: string | null;
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

/** Every label on the document, in the two languages it is issued in. */
const DOC_WORDS = {
  bg: {
    title: "Фактура", copy: "Оригинал", no: "No", due: "Сума за плащане", paidTotal: "Платена сума",
    buyer: "Получател", supplier: "Доставчик",
    company: "Име на фирма", companyId: "ЕИК", vatId: "ДДС No", address: "Адрес", rep: "МОЛ", attention: "На вниманието на",
    colNo: "No", colItem: "Име на стоката/услугата", colUnit: "Мярка", colQty: "К-во", colPrice: "Ед. цена", colVat: "ДДС (%)", colTotal: "Стойност",
    unit: "бр.", base: "Данъчна основа", vat: "Начислен ДДС", total: "Сума за плащане",
    words: "Словом", method: "Начин на плащане", methodBank: "Банков път", methodCard: "Карта",
    bank: "Банкови реквизити", issued: "Дата на издаване", taxEvent: "Дата на данъчно събитие", place: "Място на сделката",
    basis: "Основание на сделка по ЗДДС", period: "Период", dueDate: "Срок за плащане",
    signBuyer: "Получател", signIssuer: "Съставил", signature: "Подпис",
    paid: "Платена", legal: "Съгласно чл. 6, ал. 1 от Закона за счетоводството, чл. 114 от ЗДДС и чл. 78 от ППЗДДС печатът и подписът не са задължителни реквизити на фактурата.",
    notIssued: "— неиздадена —",
  },
  en: {
    title: "Invoice", copy: "Original", no: "No", due: "Amount due", paidTotal: "Amount paid",
    buyer: "Bill to", supplier: "Supplier",
    company: "Company", companyId: "Company no.", vatId: "VAT no.", address: "Address", rep: "Represented by", attention: "For the attention of",
    colNo: "No", colItem: "Description", colUnit: "Unit", colQty: "Qty", colPrice: "Unit price", colVat: "VAT (%)", colTotal: "Amount",
    unit: "pc", base: "Taxable amount", vat: "VAT", total: "Total due",
    words: "In words", method: "Payment method", methodBank: "Bank transfer", methodCard: "Card",
    bank: "Bank details", issued: "Issue date", taxEvent: "Date of supply", place: "Place of supply",
    basis: "VAT basis", period: "Period", dueDate: "Due date",
    signBuyer: "Received by", signIssuer: "Issued by", signature: "Signature",
    paid: "Paid", legal: "Stamp and signature are not mandatory requisites of this invoice.",
    notIssued: "— not issued —",
  },
} as const;

/** A money figure as the document's language writes it: "100,00 €" / "€100.00". */
export function docMoney(minor: number, currency: string, lang: "bg" | "en"): string {
  // Intl prints a hyphen; a discount line in a column of prices wants a real minus sign, which is
  // what `money()` always printed and what a reader's eye takes as "subtracted".
  return new Intl.NumberFormat(lang === "bg" ? "bg-BG" : "en-GB", { style: "currency", currency, minimumFractionDigits: 2 })
    .format(minor / 100).replace("-", "\u2212");
}
function docDay(d: Date | null, lang: "bg" | "en"): string {
  if (!d) return "—";
  if (lang === "bg") {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} г.`;
  }
  return day(d);
}
/** The VAT note is stored bilingual ("… ЗДДС. · No VAT is charged …"); each document prints its half. */
function noteFor(note: string | null, lang: "bg" | "en"): string | null {
  if (!note) return null;
  const [first, second] = note.split(" · ");
  if (!second) return note;
  return /[А-Яа-я]/.test(first ?? "") ? (lang === "bg" ? first! : second) : (lang === "bg" ? second : first!);
}

/**
 * The document body — laid out the way a Bulgarian invoice is read (founder's own invoice, 2026-09-29,
 * as the reference): the amount due at the top right where a finance person looks first, the two
 * parties side by side, the lines as a table with unit and quantity, the total in words, the dates,
 * the payment route and the VAT basis, and the signature line. An English invoice has the same shape.
 *
 * Plain semantic HTML with its own class names, deliberately independent of Tailwind — the
 * downloaded file has no stylesheet to load and must look identical offline, on a phone, and in a
 * printer, a year from now.
 */
export function invoiceBodyHtml(d: InvoiceDocData): string {
  const lang = d.language ?? "en";
  const w = DOC_WORDS[lang];
  const cur = d.currency;
  const m = (minor: number) => docMoney(minor, cur, lang);
  const lines = d.lines.length
    ? d.lines
    : [{ description: lang === "bg" ? "Месечен абонамент" : "Monthly subscription", netMinor: d.netMinor }];
  const showVat = !suppressesVatLine(d.vatTreatment);

  const party = (h: string, rows: [string, string | null | undefined][]) => `<div class="party">
      <h3>${esc(h)}</h3>
      <dl>${rows.filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}:</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    </div>`;

  const row = (l: InvoiceDocLine, i: number) =>
    `<tr><td>${i + 1}</td><td>${esc(l.description)}</td><td>${esc(w.unit)}</td><td class="num">1</td><td class="num">${esc(m(l.netMinor))}</td>${
      showVat ? `<td class="num">${esc(`${d.vatRatePct}%`)}</td>` : ""
    }<td class="num">${esc(m(l.netMinor))}</td></tr>`;

  return `<article class="doc" lang="${lang}">
  <header>
    <div class="issuer">
      <div class="name">${esc(d.issuerName ?? "—")}</div>
    </div>
    <div class="meta">
      <div class="copy">${esc(w.copy)}</div>
      <div class="title">${esc(w.title)}</div>
      <div class="number mono">${esc(w.no)}: ${esc(d.number ?? w.notIssued)}</div>
      <div class="due-label">${esc(d.paid ? w.paidTotal : w.due)}:</div>
      <div class="due mono">${esc(m(d.grossMinor))}</div>
    </div>
  </header>

  <section class="parties">
    ${party(w.buyer, [
      [w.company, d.buyerName], [w.companyId, d.buyerCompanyId], [w.vatId, d.buyerVatId],
      [w.address, d.buyerAddress], [w.rep, d.buyerRepresentative], [w.attention, d.buyerAttention],
    ])}
    ${party(w.supplier, [
      [w.company, d.issuerName], [w.companyId, d.issuerCompanyId], [w.vatId, d.issuerVatId],
      [w.address, d.issuerAddress], [w.rep, d.issuerRepresentative],
    ])}
  </section>

  <table class="lines">
    <thead><tr><th>${esc(w.colNo)}</th><th>${esc(w.colItem)}</th><th>${esc(w.colUnit)}</th><th class="num">${esc(w.colQty)}</th><th class="num">${esc(w.colPrice)}</th>${
      showVat ? `<th class="num">${esc(w.colVat)}</th>` : ""
    }<th class="num">${esc(w.colTotal)}</th></tr></thead>
    <tbody>${lines.map(row).join("")}</tbody>
  </table>

  <div class="totals">
    <dl>
      <dt>${esc(w.base)}</dt><dd class="num">${esc(m(d.netMinor))}</dd>
      ${
        /*
         * A supply on which VAT MAY NOT BE STATED gets no VAT line — not a line reading 0%.
         *
         * Under чл. 113, ал. 9 ЗДДС a person registered only under чл. 97а is prohibited from
         * stating VAT in an invoice, and "VAT 0.00" states it. The legal ground still prints, as the
         * VAT basis below — which is what makes the omission correct rather than an omission.
         */
        showVat ? `<dt>${esc(`${w.vat} (${d.vatRatePct}%)`)}</dt><dd class="num">${esc(m(d.taxMinor))}</dd>` : ""
      }
      <dt class="grand">${esc(d.paid ? w.paidTotal : w.total)}</dt><dd class="num grand">${esc(m(d.grossMinor))}</dd>
    </dl>
  </div>

  ${
    /*
     * A paid invoice has to LOOK paid. Without this the document is byte-identical before and after
     * payment, which made the receipt email attach the same bill a second time.
     */
    d.paid
      ? `<div class="paid"><span class="mark">${esc(w.paid)}</span>
<span>${esc(d.paid.on)}${d.paid.via ? ` · ${esc(d.paid.via)}` : ""}${d.paid.reference ? ` · ${esc(d.paid.reference)}` : ""}</span></div>`
      : ""
  }

  <section class="facts">
    <dl>
      <dt>${esc(w.words)}:</dt><dd>${esc(amountInWords(d.grossMinor, cur, lang))}</dd>
      <dt>${esc(w.method)}:</dt><dd>${esc(d.paid?.via === "Card" ? w.methodCard : w.methodBank)}</dd>
      ${
        d.issuerIban || d.issuerBankName
          ? `<dt>${esc(w.bank)}:</dt><dd>${[
              d.issuerBankName ? esc(d.issuerBankName) : "",
              d.issuerBic ? `BIC: <span class="mono">${esc(d.issuerBic)}</span>` : "",
              d.issuerIban ? `IBAN: <span class="mono">${esc(d.issuerIban)}</span>` : "",
            ].filter(Boolean).join("<br>")}</dd>`
          : ""
      }
    </dl>
    <dl>
      <dt>${esc(w.issued)}:</dt><dd class="mono">${esc(docDay(d.issuedAt, lang))}</dd>
      <dt>${esc(w.taxEvent)}:</dt><dd class="mono">${esc(docDay(d.issuedAt, lang))}</dd>
      ${d.dueDate ? `<dt>${esc(w.dueDate)}:</dt><dd class="mono">${esc(docDay(d.dueDate, lang))}</dd>` : ""}
      ${d.issuePlace ? `<dt>${esc(w.place)}:</dt><dd>${esc(d.issuePlace)}</dd>` : ""}
      <dt>${esc(w.period)}:</dt><dd class="mono">${esc(d.period)}</dd>
      ${noteFor(d.vatNote, lang) ? `<dt>${esc(w.basis)}:</dt><dd>${esc(noteFor(d.vatNote, lang))}</dd>` : ""}
    </dl>
  </section>

  <section class="sign">
    <div><span>${esc(w.signBuyer)}:</span><strong>${esc(d.buyerRepresentative ?? "")}</strong><em>${esc(w.signature)}: ..............................</em></div>
    <div><span>${esc(w.signIssuer)}:</span><strong>${esc(d.issuerRepresentative ?? "")}</strong><em>${esc(w.signature)}: ..............................</em></div>
  </section>

  <footer>
    <div>${esc(w.legal)}</div>
    ${d.footerNote ? `<div>${esc(d.footerNote)}</div>` : ""}
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
.doc .paid { display: flex; align-items: center; gap: 10px; margin: 18px 0 0; padding: 10px 14px; border: 1px solid #b7e0c4; background: #f1faf4; border-radius: 8px; font-size: 12px; color: #2c6b44; font-variant-numeric: tabular-nums; }
.doc .paid .mark { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
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
.doc header .meta .copy { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #8a94a6; }
.doc header .meta .due-label { margin-top: 14px; font-size: 11.5px; font-weight: 700; color: #414c60; }
.doc header .meta .due { font-size: 24px; font-weight: 800; color: #1f6fd1; letter-spacing: -.01em; }
.doc .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; padding: 22px 0; }
.doc .parties h3 { color: #1f6fd1; font-size: 12px; letter-spacing: .02em; text-transform: none; }
.doc .parties dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0; font-size: 12.5px; }
.doc .parties dt { color: #6b7486; font-size: 11px; padding-top: 1px; }
.doc .parties dd { margin: 0; font-weight: 600; color: #1c2434; }
.doc table.lines th, .doc table.lines td { padding-left: 6px; padding-right: 6px; }
.doc table.lines thead th { background: #1f6fd1; color: #fff; border: 0; white-space: nowrap; }
.doc .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 26px; }
.doc .facts dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 0; font-size: 12.5px; align-content: start; }
.doc .facts dt { font-weight: 700; color: #1c2434; }
.doc .facts dd { margin: 0; color: #414c60; }
.doc .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 30px; font-size: 12px; }
.doc .sign div { display: flex; flex-direction: column; gap: 2px; }
.doc .sign span { color: #6b7486; font-size: 11px; }
.doc .sign em { font-style: normal; color: #8a94a6; font-size: 11px; margin-top: 6px; }
@media (max-width: 560px) { .doc { padding: 22px; } .doc .parties, .doc .facts, .doc .sign { grid-template-columns: 1fr; } .doc header { flex-direction: column; gap: 14px; } .doc header .meta { text-align: left; } .doc table.lines { font-size: 12px; } }
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
