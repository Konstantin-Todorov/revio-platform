import { buildFiscalReceipt, fiscalRequirement, scaleFiscalItems, type FiscalReceipt, type FiscalReceiptItem, type FiscalTaxGroupMap } from "@revio/core";

/**
 * Which folio lines owe the hotel's device a receipt, and which owe it a storno.
 * Pure — the folio view feeds it the stay's lines; `fiscal-plan.test.ts` holds every rule.
 *
 * ## Receipts follow the money becoming payment for a stay
 *
 * - A `payment` in cash or by card at the desk → a receipt (Н-18 чл. 3 ал. 1).
 * - A HELD deposit → it depends on the deposit type's VAT point, which the hotel's accountant already
 *   set (`DepositType.vatTiming`, stamped on the line as a tax category at capture):
 *     · VAT at **capture** — the deposit is an advance for the stay: the receipt prints when the money
 *       is taken, and returning it later needs a storno.
 *     · VAT at **use** — a security deposit is not a sale: no receipt when it is taken (nothing to
 *       reverse if it goes back untouched); the receipt prints when it is applied to the bill, in the
 *       method it was taken in.
 *   Printing at both points would count the same money twice; printing at neither would leave it out.
 * - Money that never needed a receipt (bank transfer, company account, OTA) never reaches the device.
 *
 * ## Stornos correct the device, not our record
 *
 * - A voided line that had a receipt → a storno of the whole receipt (unchanged).
 * - A `deposit_refund` of a deposit that HAD a receipt → a storno of the refunded amount, its lines the
 *   original receipt's scaled down (`scaleFiscalItems`). The original is the latest receipted held
 *   deposit on the same folio; its receipt number, date and fiscal-memory serial go on the storno.
 */

export type PlanLine = {
  id: string;
  folioId: string;
  kind: string;
  method: string | null;
  amountMinor: number;
  taxCategory: string | null;
  outlet: string | null;
  voided: boolean;
  postedAt: Date;
  fiscalReceiptNo: string | null;
  fiscalReceiptData: unknown;
};

export type StornoOriginal = {
  items: FiscalReceiptItem[];
  paymentType: "cash" | "card";
  receiptNumber: string;
  receiptDateTime: string | null;
  fiscalMemorySerialNumber: string | null;
};

export type FiscalPlanEntry =
  | { owes: "receipt"; receipt: FiscalReceipt }
  | { owes: "storno"; original: StornoOriginal | null; reasonFixed: boolean };

const CHARGE_KINDS = new Set(["accommodation", "minibar", "extra", "fee", "tax"]);
const RECEIPT_KINDS = new Set(["payment", "deposit_held", "deposit_use"]);
const deskMethod = (m: string | null): "cash" | "card" | null => (m === "cash" || m === "card" ? m : null);

function originalOf(l: PlanLine): StornoOriginal | null {
  const d = l.fiscalReceiptData as StornoOriginal | null;
  return d && Array.isArray(d.items) && d.items.length ? d : null;
}

/** The latest line on the same folio, before `l`, matching `pick`. */
function latestBefore(lines: PlanLine[], l: PlanLine, pick: (x: PlanLine) => boolean, includeVoided = false): PlanLine | null {
  let best: PlanLine | null = null;
  for (const x of lines) {
    if (x.id === l.id || x.folioId !== l.folioId || (x.voided && !includeVoided) || x.postedAt > l.postedAt || !pick(x)) continue;
    if (!best || x.postedAt >= best.postedAt) best = x;
  }
  return best;
}

/** The method the money behind this line was taken in, when THIS line is the moment it owes a receipt. */
export function receiptMethodFor(l: PlanLine, lines: PlanLine[]): "cash" | "card" | null {
  if (l.voided || l.amountMinor <= 0) return null;
  if (l.kind === "payment") return deskMethod(l.method);
  // VAT at capture → stamped with a tax category: an advance, receipted when taken.
  if (l.kind === "deposit_held") return l.taxCategory ? deskMethod(l.method) : null;
  if (l.kind === "deposit_use") {
    const held = latestBefore(lines, l, (x) => x.kind === "deposit_held");
    // Only a deposit that was NOT receipted at capture is receipted now.
    return held && !held.taxCategory ? deskMethod(held.method) : null;
  }
  return null;
}

export function fiscalPlan(lines: PlanLine[], jurisdiction: string, groups: FiscalTaxGroupMap): Map<string, FiscalPlanEntry> {
  const plan = new Map<string, FiscalPlanEntry>();
  const charges = lines.filter((l) => !l.voided && CHARGE_KINDS.has(l.kind));
  // Refunds first: each one reverses part of a receipted deposit, and a later void of that deposit
  // may reverse only what is left — the device must never take back more than it sold.
  const refundedFrom = new Map<string, number>();
  for (const l of lines) {
    if (l.kind !== "deposit_refund" || l.voided || l.amountMinor <= 0) continue;
    // A deposit voided AFTER this refund still was the one refunded — so voided lines count here.
    const held = latestBefore(lines, l, (x) => x.kind === "deposit_held" && Boolean(x.fiscalReceiptNo), true);
    if (!held) continue;
    refundedFrom.set(held.id, (refundedFrom.get(held.id) ?? 0) + l.amountMinor);
    const o = originalOf(held);
    plan.set(l.id, { owes: "storno", reasonFixed: true, original: o ? { ...o, items: scaleFiscalItems(o.items, l.amountMinor) } : null });
  }
  for (const l of lines) {
    if (!RECEIPT_KINDS.has(l.kind)) continue;
    if (l.voided) {
      if (!l.fiscalReceiptNo) continue;
      const left = l.amountMinor - (refundedFrom.get(l.id) ?? 0);
      if (left <= 0) continue;
      const o = originalOf(l);
      plan.set(l.id, { owes: "storno", reasonFixed: false, original: o ? { ...o, items: scaleFiscalItems(o.items, left) } : null });
      continue;
    }
    if (l.fiscalReceiptNo) continue;
    const method = receiptMethodFor(l, lines);
    if (!method || !fiscalRequirement(jurisdiction, method)?.required) continue;
    plan.set(l.id, { owes: "receipt", receipt: buildFiscalReceipt({ amountMinor: l.amountMinor, method, charges, groups }) });
  }
  return plan;
}
