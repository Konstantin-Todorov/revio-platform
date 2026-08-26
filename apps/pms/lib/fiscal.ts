import "server-only";
import { fiscalRequirement, type PaymentMethod } from "@revio/core";

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
 * ## Revio does not fiscalize, deliberately and permanently
 *
 * Under Наредба Н-18 a fiscal receipt comes from a REGISTERED DEVICE (ФУ/ЕКАФП) or from software on
 * the НАП СУПТО register. Since чл. 118 ЗДДС was amended, using СУПТО is **voluntary** — so we have a
 * choice, and we are taking the other one, for a specific reason:
 *
 *   Software that drives a hotel's fiscal device BECOMES СУПТО, and the obligations then land on the
 *   HOTEL, not only on us. They must use that one software EXCLUSIVELY for sales at that site, every
 *   fiscal device there is demoted to a printer of ours, and they must declare us to НАП within 7
 *   days of installation along with the location of our database. That turns "add a channel manager"
 *   into "replace your entire till", and it makes Revio impossible to sell alongside the POS a
 *   restaurant or spa already runs.
 *
 * So: **the hotel's existing certified device stays the system of record for receipts.** Revio
 * records the receipt that device produced, and reconciles against it. We report the requirement; we
 * never satisfy it. That keeps us off the register, keeps the hotel's other systems working, and —
 * the part that actually unblocks sales — means a hotel can go live on Revio today.
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
