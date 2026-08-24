/**
 * How a property numbers the documents it issues.
 *
 * The single most country-specific thing about an invoice, and therefore the last thing that should
 * be a constant. Bulgaria requires a ten-digit number with nothing in it but digits; plenty of
 * jurisdictions are happy with `INV-2026-0001`, which is far easier to read. Both exist here and the
 * property chooses, so adding a country later is a new branch rather than a rewrite.
 */

export type InvoiceNumberScheme = "bg_10digit" | "prefixed";

/** Our document kinds. A proforma is deliberately not one of the tax documents. */
export type IssuedDocType = "invoice" | "proforma" | "credit_note";

/**
 * Is this a tax document?
 *
 * Under Bulgarian law (ЗДДС чл. 112) фактури and известия both are; a proforma is not — it is a
 * request for payment carrying no VAT consequence. That distinction decides which counter a document
 * draws from, and getting it backwards would spend legally-sequenced numbers on documents that are
 * not tax documents at all.
 */
export function isTaxDocument(docType: IssuedDocType): boolean {
  return docType === "invoice" || docType === "credit_note";
}

/**
 * Which counter a document draws from.
 *
 * Under the Bulgarian scheme both tax documents share ONE ascending range per property, because
 * "без дублиране" — no duplication — applies across all of a taxable person's documents, and one
 * range is the reading that cannot be wrong. Separate ranges are permitted, but only if they never
 * collide, and that is a promise no code should be asked to keep silently.
 */
export function seriesKeyFor(scheme: InvoiceNumberScheme, docType: IssuedDocType): string {
  if (scheme === "bg_10digit" && isTaxDocument(docType)) return "tax";
  return docType;
}

const PREFIX: Record<IssuedDocType, string> = { invoice: "INV", proforma: "PRO", credit_note: "CN" };

export interface FormatNumberInput {
  scheme: InvoiceNumberScheme;
  docType: IssuedDocType;
  /** The value claimed from the counter. */
  claimed: bigint;
  /** Only used by the `prefixed` scheme, which restarts each year. */
  year: number;
}

/**
 * Render a claimed counter value as the document's number.
 *
 * Note what `bg_10digit` does NOT do: no prefix, no year, no separator, no annual reset. Each of
 * those was present in the first version of this and each is independently disqualifying — the year
 * most of all, because a sequence that restarts produces a duplicate rather than merely an oddity.
 *
 * A proforma keeps the readable form under both schemes. It is not a tax document, so the ten-digit
 * rule does not reach it, and making one *look* like a tax document is worse than useless.
 */
export function formatDocumentNumber(input: FormatNumberInput): string {
  const { scheme, docType, claimed, year } = input;
  if (scheme === "bg_10digit" && isTaxDocument(docType)) {
    return claimed.toString().padStart(10, "0");
  }
  return `${PREFIX[docType]}-${year}-${claimed.toString().padStart(4, "0")}`;
}

/**
 * Where a freshly created counter starts.
 *
 * A hotel that has been invoicing on paper needs the software's range clear of the numbers already
 * in its books — the same problem we have ourselves, one level down. The readable scheme has no such
 * constraint and starts at 1.
 */
export function seriesStartFor(scheme: InvoiceNumberScheme, docType: IssuedDocType, configuredStart: bigint): bigint {
  if (scheme === "bg_10digit" && isTaxDocument(docType)) return configuredStart;
  return 1n;
}
