import "server-only";
import { prisma } from "./db";
import { activeProperty } from "./data";
import { fiscalizeInvoice } from "./fiscal";
import { ymd } from "./format";

/**
 * The Invoicing module (spec §4.3/§4.6). Charges live on folios; an invoice is "render this folio
 * (or these lines) as a numbered tax document." Jurisdiction-agnostic: universal primitives here,
 * everything that varies by country (rate values, labels, fiscalization) is property CONFIG (E7),
 * never hardcoded. EN-16931-aware: buyer VAT ID, taxable-supply date ≠ issue date, per-rate tax
 * summary with accommodation broken out.
 */

export type DocType = "invoice" | "proforma" | "credit_note";
export const DOC_LABEL: Record<string, string> = { invoice: "Invoice", proforma: "Proforma", credit_note: "Credit note" };
const DOC_PREFIX: Record<DocType, string> = { invoice: "INV", proforma: "PRO", credit_note: "CN" };

// Kinds that are invoice CONTENT (goods/services supplied). Payments + deposit movements are
// settlement, not invoice lines.
const INVOICE_KINDS = new Set(["accommodation", "minibar", "extra", "fee", "tax"]);

export interface TaxRow { category: string; ratePct: number; netMinor: number; taxMinor: number; grossMinor: number }

/** VAT rate for a charge's tax category, from property config. Prices are VAT-INCLUSIVE (EU norm),
 * so tax is backed out of the gross: net = round(gross / (1 + rate)), tax = gross − net. */
function rateFor(category: string | null, rates: { standard: number; reduced: number }): number {
  if (category === "standard") return rates.standard;
  if (category === "reduced") return rates.reduced;
  return 0; // city_tax, exempt, null → no VAT
}

export function computeTaxSummary(
  lines: { kind: string; taxCategory: string | null; amountMinor: number; voided: boolean }[],
  rates: { standard: number; reduced: number },
): { rows: TaxRow[]; netMinor: number; taxMinor: number; grossMinor: number } {
  const byRate = new Map<string, { category: string; ratePct: number; grossMinor: number }>();
  for (const l of lines) {
    if (l.voided || !INVOICE_KINDS.has(l.kind)) continue;
    const cat = l.taxCategory ?? "standard";
    const ratePct = rateFor(cat, rates);
    const key = `${cat}:${ratePct}`;
    const e = byRate.get(key) ?? { category: cat, ratePct, grossMinor: 0 };
    e.grossMinor += l.amountMinor;
    byRate.set(key, e);
  }
  const order = ["reduced", "standard", "city_tax", "exempt"];
  const rows: TaxRow[] = [...byRate.values()]
    .map((e) => {
      const netMinor = e.ratePct > 0 ? Math.round(e.grossMinor / (1 + e.ratePct / 100)) : e.grossMinor;
      return { category: e.category, ratePct: e.ratePct, netMinor, taxMinor: e.grossMinor - netMinor, grossMinor: e.grossMinor };
    })
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.ratePct - b.ratePct);
  const netMinor = rows.reduce((s, r) => s + r.netMinor, 0);
  const taxMinor = rows.reduce((s, r) => s + r.taxMinor, 0);
  const grossMinor = rows.reduce((s, r) => s + r.grossMinor, 0);
  return { rows, netMinor, taxMinor, grossMinor };
}

/** Allocate the next GAPLESS number for a series. The counter is bumped in a single atomic UPDATE
 * (increment), so concurrent issues can never reuse or skip a number. */
async function nextNumber(tenantId: string, propertyId: string, docType: DocType): Promise<string> {
  let series = await prisma.invoiceSeries.findFirst({ where: { propertyId, docType }, select: { id: true } });
  if (!series) {
    try {
      series = await prisma.invoiceSeries.create({ data: { tenantId, propertyId, docType }, select: { id: true } });
    } catch {
      series = await prisma.invoiceSeries.findFirst({ where: { propertyId, docType }, select: { id: true } });
    }
  }
  const updated = await prisma.invoiceSeries.update({ where: { id: series!.id }, data: { nextNumber: { increment: 1 } }, select: { nextNumber: true } });
  const n = updated.nextNumber - 1; // the value we just claimed
  const year = new Date().getFullYear();
  return `${DOC_PREFIX[docType]}-${year}-${String(n).padStart(4, "0")}`;
}

export interface GenerateInvoiceInput {
  reservationId: string;
  folioId?: string; // which folio's lines to invoice (accommodation vs consumption split); default primary
  docType: DocType;
  buyerName: string;
  buyerVatId?: string | null;
  buyerAddress?: string | null;
  userId?: string | null;
}

/** Render a folio (or a chosen folio of a split stay) as a numbered tax document. */
export async function generateInvoice(input: GenerateInvoiceInput): Promise<string | null> {
  const { property, session } = await activeProperty();
  const defaults = await prisma.propertyDefaults.findUnique({ where: { propertyId: property.id } });
  const rates = { standard: defaults?.vatStandardPct ?? 20, reduced: defaults?.vatReducedPct ?? 9 };

  const folio = input.folioId
    ? await prisma.folio.findFirst({ where: { id: input.folioId, reservationId: input.reservationId, propertyId: property.id }, include: { lines: true } })
    : await prisma.folio.findFirst({ where: { reservationId: input.reservationId, propertyId: property.id, isPrimary: true }, include: { lines: true } });
  if (!folio) return null;

  const supply = await supplyDateFor(input.reservationId);
  const summary = computeTaxSummary(folio.lines, rates);
  const number = await nextNumber(session.tenantId, property.id, input.docType);

  const snapshot = folio.lines
    .filter((l) => !l.voided && INVOICE_KINDS.has(l.kind))
    .map((l) => ({ kind: l.kind, description: l.description, outlet: l.outlet, taxCategory: l.taxCategory, amountMinor: l.amountMinor }));

  const inv = await prisma.taxInvoice.create({
    data: {
      tenantId: session.tenantId, propertyId: property.id, reservationId: input.reservationId, folioId: folio.id,
      docType: input.docType, number,
      issuerName: defaults?.invoiceIssuerName || property.name,
      issuerVatId: defaults?.invoiceVatId ?? null,
      issuerAddress: defaults?.invoiceAddress || property.address || null,
      buyerName: input.buyerName, buyerVatId: input.buyerVatId ?? null, buyerAddress: input.buyerAddress ?? null,
      supplyDate: supply,
      currency: folio.currency,
      netMinor: summary.netMinor, taxMinor: summary.taxMinor, grossMinor: summary.grossMinor,
      taxSummary: summary.rows, lineSnapshot: snapshot,
      createdById: input.userId ?? null,
    },
    select: { id: true },
  });

  // Fiscalization boundary (spec §4.7) — if this property's jurisdiction pack requires real-time
  // reporting (e.g. Bulgaria N-18), report the document and stamp the returned fiscal seal on it.
  const fiscal = await fiscalizeInvoice(
    { jurisdiction: defaults?.jurisdiction ?? "generic", fiscalizationEnabled: defaults?.fiscalizationEnabled ?? false, eInvoicingEnabled: defaults?.eInvoicingEnabled ?? false },
    { docType: input.docType, number, grossMinor: summary.grossMinor, currency: folio.currency },
  );
  if (fiscal) await prisma.taxInvoice.update({ where: { id: inv.id }, data: { fiscalRef: fiscal.fiscalRef } });

  return inv.id;
}

/** Taxable supply = the stay's check-out date (services rendered by departure); falls back to today. */
async function supplyDateFor(reservationId: string): Promise<Date> {
  const line = await prisma.reservationLine.findFirst({ where: { reservationId }, orderBy: { checkOut: "desc" }, select: { checkOut: true } });
  return line?.checkOut ?? new Date();
}

export async function getTaxInvoice(id: string) {
  const { property } = await activeProperty();
  const inv = await prisma.taxInvoice.findFirst({ where: { id, propertyId: property.id } });
  if (!inv) return null;
  const reservation = await prisma.reservation.findFirst({ where: { id: inv.reservationId }, select: { guestName: true } });
  return { property, invoice: inv, guestName: reservation?.guestName ?? inv.buyerName };
}

/** Invoices already issued for a stay — shown on the folio so you don't double-issue. */
export async function listInvoicesForReservation(reservationId: string) {
  const rows = await prisma.taxInvoice.findMany({
    where: { reservationId },
    orderBy: { createdAt: "desc" },
    select: { id: true, number: true, docType: true, grossMinor: true, currency: true, issueDate: true, status: true, buyerName: true },
  });
  return rows.map((r) => ({ ...r, issueDate: ymd(r.issueDate) }));
}
