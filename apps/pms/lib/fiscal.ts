import "server-only";
import {
  defaultFiscalTaxGroups, fiscalRequirement, FISCAL_TAX_GROUPS,
  type FiscalTaxGroupMap, type PaymentMethod,
} from "@revio/core";

/**
 * The fiscalization boundary (spec §4.7) — rewritten 2026-08-26 after reading the ordinance itself.
 *
 * ## What changed, and why it matters
 *
 * This file used to mint a mock seal and stamp `NRA-3F8A21C4` onto a real tax invoice whenever a
 * property ticked a checkbox. That is worse than doing nothing: a fabricated fiscal reference on a
 * legal document is not a placeholder, it is a document that misstates its own compliance. The mock
 * now refuses to run for a non-demo tenant.
 *
 * ## Revio prints on the hotel's own device — as ordinary software, never as СУПТО
 *
 * Until 2026-10-05 this file said Revio would never fiscalize, on the belief that software driving a
 * fiscal device BECOMES СУПТО and drags the hotel into exclusivity and an НАП declaration. Re-checked
 * against Н-18: the listed-СУПТО regime is an ELECTION the hotel makes (чл. 118 ал. 18 ЗДДС), and Н-18
 * expressly allows receipts issued through non-listed software. So the PMS page may send the receipt
 * to the hotel's registered device through ErpNet.FP on the desk PC (`fiscalDevice = "erpnet"`), and
 * the hotel's restaurant or spa till is untouched. We never declare ourselves СУПТО and never say we
 * are. The device remains the system of record: we store the number IT returned, never one we made.
 * Design: `docs/specs/FISCAL-PRINTER.md`; the correction: `BG-FISCALIZATION-RESEARCH.md`.
 *
 * ## Most hotel money needs no receipt at all
 *
 * чл. 3 ал. 1 exempts credit transfer, direct debit and cash paid into a payment account. OTA
 * prepayments, company accounts and bank transfers are all exempt; only cash and card AT THE PROPERTY
 * trigger a device. `fiscalRequirement` in `@revio/core` holds that rule and is where it is tested.
 *
 * The other obligation — structured B2B e-invoicing (EN 16931 / Peppol / ViDA from 1 July 2030) — is
 * separate, voluntary in Bulgaria today, and still just a seam.
 */

export type FiscalConfig = {
  jurisdiction: string;
  fiscalizationEnabled: boolean;
  eInvoicingEnabled: boolean;
  /** Demo tenants may show the end-to-end path with a visibly fake seal. Real ones may not. */
  isDemo?: boolean;
};

export type FiscalResult =
  | {
      /** The reference to stamp on the document. */
      fiscalRef: string;
      mode: "mock" | "recorded" | "provider";
      note: string;
    }
  | null;

/**
 * Fiscalize an issued document.
 *
 * Returns `null` — no reference, no claim — in every case except a demo tenant. That is the correct
 * behaviour, not a gap: for a real property the reference belongs to their device and arrives via
 * `recordFiscalReceipt`, and inventing one here is precisely the failure mode being removed.
 */
export async function fiscalizeInvoice(
  cfg: FiscalConfig,
  doc: { docType: string; number: string; grossMinor: number; currency: string },
): Promise<FiscalResult> {
  if (!cfg.fiscalizationEnabled) return null;

  if (!cfg.isDemo) {
    // A real property. We do not have a device and we are not on the СУПТО register, so there is
    // nothing truthful to stamp. The invoice screen says so in words; see `fiscalStatusNote`.
    return null;
  }

  const authority = cfg.jurisdiction === "bg" ? "NRA" : "TAX";
  const seal = mockSeal(`${doc.docType}:${doc.number}:${doc.grossMinor}`);
  return {
    // Prefixed so it can never be mistaken for a real seal, in a screenshot or in the database.
    fiscalRef: `DEMO-${authority}-${seal}`,
    mode: "mock",
    note: "Demo tenant — a fabricated seal shown to demonstrate the path. Not a fiscal document.",
  };
}

/**
 * Record the receipt number the hotel's own registered device produced.
 *
 * This is the real path, and it is deliberately dumb: a string, validated for shape only. The device
 * already did the legally significant work; our job is to hold the reference so the folio, the
 * invoice and the night audit can be reconciled against the till.
 */
export function recordFiscalReceipt(receiptNumber: string): FiscalResult {
  const trimmed = receiptNumber.trim();
  if (!trimmed) return null;
  return {
    fiscalRef: trimmed,
    mode: "recorded",
    note: "Receipt number from the property's registered fiscal device.",
  };
}

/**
 * What to tell the person looking at an invoice or a payment.
 *
 * Three states, and the middle one is the only one that is a problem — so it is the only one phrased
 * as an action.
 */
export function fiscalStatusNote(
  cfg: FiscalConfig,
  method: PaymentMethod | null,
  fiscalRef: string | null,
): string {
  if (fiscalRef) return `Fiscal receipt: ${fiscalRef}`;

  const req = method ? fiscalRequirement(cfg.jurisdiction, method) : null;
  if (req && !req.required) return `No fiscal receipt required — ${req.reason}`;
  if (req?.required) {
    return `A fiscal receipt is required for this payment (${req.reason}) and none is recorded. Issue it on the property's registered device and enter the number here.`;
  }
  return "No fiscal reporting configured for this property.";
}

/** A short, stable pseudo-seal for the demo. NOT a fiscal signature, and never issued to a real tenant. */
function mockSeal(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).toUpperCase().padStart(8, "0").slice(0, 8);
}

/** The property's tax-category → Н-18 group mapping, falling back to the default for its VAT status. */
export function fiscalGroupsFor(d: { fiscalTaxGroups?: unknown; invoiceVatId?: string | null } | null): FiscalTaxGroupMap {
  const base = defaultFiscalTaxGroups(Boolean(d?.invoiceVatId));
  const stored = (d?.fiscalTaxGroups ?? null) as Partial<Record<keyof FiscalTaxGroupMap, string>> | null;
  if (!stored) return base;
  const ok = (g: unknown): g is FiscalTaxGroupMap[keyof FiscalTaxGroupMap] => (FISCAL_TAX_GROUPS as readonly string[]).includes(String(g));
  return {
    standard: ok(stored.standard) ? stored.standard : base.standard,
    reduced: ok(stored.reduced) ? stored.reduced : base.reduced,
    city_tax: ok(stored.city_tax) ? stored.city_tax : base.city_tax,
    exempt: ok(stored.exempt) ? stored.exempt : base.exempt,
  };
}
