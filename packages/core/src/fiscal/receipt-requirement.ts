/**
 * Does this payment legally require a fiscal receipt?
 *
 * The question the whole fiscalization problem turns on, and the one the earlier research pass got
 * wrong. `docs/specs/BG-FISCALIZATION-RESEARCH.md` stated that Bulgaria requires every consumer sale
 * — "cash, card, bank transfer" — to be reported in real time. **Bank transfer is explicitly
 * exempt**, and that single word changes what has to be built.
 *
 * Наредба Н-18, чл. 3, ал. 1 obliges a seller to issue a fiscal receipt from a registered device:
 *
 *   "...освен когато плащането се извършва чрез внасяне на пари в наличност по платежна сметка,
 *    кредитен превод, директен дебит или наличен паричен превод"
 *
 *   — EXCEPT where payment is made by paying cash into a payment account, **credit transfer**,
 *     direct debit, or cash postal transfer.
 *
 * So the trigger is the PAYMENT METHOD, not the sale, not the invoice, and not the software. A hotel
 * settling by bank transfer needs no fiscal device for that money, however large the sum. A hotel
 * taking a €20 note at the desk does.
 *
 * ## Why this is a function in core and not a note in a document
 *
 * Because it decides, per payment, whether the hotel is compliant — and that answer has to be visible
 * on a screen while the money is being taken, not discovered during an inspection. It is pure so the
 * folio, the invoice and the operator's readiness check all give the same answer.
 *
 * **This is not tax advice and it is not a substitute for the hotel's accountant.** It encodes one
 * article of one ordinance, in one jurisdiction, so the software stops guessing.
 */

/** Payment methods as recorded on a folio line (`FolioLine.method`). */
export type PaymentMethod = "cash" | "card" | "company_account" | "bank_transfer" | "prepaid_ota";

export type FiscalRequirement =
  /** A registered fiscal device must issue a receipt for this payment. */
  | { required: true; reason: string }
  /** Exempt — and we say WHICH exemption, because "no" without a reason is not auditable. */
  | { required: false; reason: string };

/**
 * Bulgaria (Наредба Н-18 чл. 3 ал. 1).
 *
 * `card` is deliberately REQUIRED. It reads like an electronic transfer and is not one: the exemption
 * list names credit transfer and direct debit, and a card payment at a terminal is neither. Getting
 * this backwards is the expensive direction of the error — it would tell a hotel it may skip a
 * receipt it is obliged to issue.
 */
function bulgaria(method: PaymentMethod): FiscalRequirement {
  switch (method) {
    case "cash":
      return { required: true, reason: "Cash at the property — Наредба Н-18 чл. 3 ал. 1." };
    case "card":
      return {
        required: true,
        // Spelled out because this is the answer people get wrong.
        reason:
          "Card payment at the property — Наредба Н-18 чл. 3 ал. 1. A card is not a credit transfer, " +
          "so it is not covered by the transfer exemption.",
      };
    case "bank_transfer":
      return { required: false, reason: "Bank transfer (кредитен превод) — exempt under Наредба Н-18 чл. 3 ал. 1." };
    case "company_account":
      // Billed to a company and settled from its account: a credit transfer with an invoice attached.
      return { required: false, reason: "Invoiced to a company account, settled by transfer — exempt under чл. 3 ал. 1." };
    case "prepaid_ota":
      // Two reasons, and the first is the stronger one: the guest's money went to the OTA, so this is
      // not the hotel's consumer sale at all. The OTA then remits by transfer, which is also exempt.
      return {
        required: false,
        reason: "Paid to the OTA, remitted to the hotel by transfer — not a consumer sale at the property.",
      };
  }
}

/**
 * Jurisdictions we have actually researched. Anything else returns `null` from `fiscalRequirement`
 * rather than a confident guess — an unresearched country is not the same as an exempt one.
 */
export const FISCAL_JURISDICTIONS = ["bg"] as const;
export type FiscalJurisdiction = (typeof FISCAL_JURISDICTIONS)[number];

export function isFiscalJurisdiction(j: string): j is FiscalJurisdiction {
  return (FISCAL_JURISDICTIONS as readonly string[]).includes(j);
}

/** `null` means "we have not researched this jurisdiction" — never "no receipt needed". */
export function fiscalRequirement(jurisdiction: string, method: PaymentMethod): FiscalRequirement | null {
  return jurisdiction === "bg" ? bulgaria(method) : null;
}

/**
 * Can this property operate with no fiscal device at all?
 *
 * The commercially useful form of the question, and the one that decides whether a hotel can go live
 * on Revio today. Yes, if and only if none of the payment methods it actually accepts requires a
 * receipt. A hotel selling through OTAs and invoicing companies is already there; a hotel with a
 * front desk that takes cards is not.
 */
export function needsFiscalDevice(
  jurisdiction: string,
  acceptedMethods: readonly PaymentMethod[],
): { needed: boolean; triggeredBy: PaymentMethod[] } {
  const triggeredBy = acceptedMethods.filter((m) => fiscalRequirement(jurisdiction, m)?.required === true);
  return { needed: triggeredBy.length > 0, triggeredBy };
}
