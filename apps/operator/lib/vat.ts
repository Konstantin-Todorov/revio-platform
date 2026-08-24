/**
 * How much VAT goes on an invoice we send a hotel.
 *
 * We sell software — an "electronically supplied service" — from one EU country to businesses that
 * are mostly in others. That combination has a specific set of rules, and getting them wrong is not
 * a rounding error: charging VAT where reverse charge applies makes the customer pay 20% they cannot
 * reclaim, and NOT charging it where it was due leaves us owing the difference to the revenue office
 * out of our own margin.
 *
 * So the decision is a pure function with the reasoning attached, rather than a number computed at
 * the point of rendering. Every branch returns the legal note that has to be printed next to it —
 * a 0% line with no explanation is not a valid invoice in any of these cases.
 *
 * ## List prices EXCLUDE VAT
 *
 * `pricing.ts` states no VAT position at all: €49 is just €49. B2B SaaS list prices are conventionally
 * quoted net, and every customer here is a business, so net is the reading taken throughout — VAT is
 * ADDED to the monthly price, not extracted from it. The opposite reading changes every invoice by
 * 20%, which is why it is written down here rather than left implicit at the call site.
 *
 * ## This is not tax advice
 *
 * The rules below are the ordinary treatment for B2B electronically supplied services under
 * Directive 2006/112/EC. An accountant should confirm them against our actual registrations before
 * the first invoice goes out — particularly `eu_b2c`, which we deliberately refuse to guess at.
 */

/** EU member states, ISO 3166-1 alpha-2. Excludes the UK. */
export const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

export function isEu(country: string | null | undefined): boolean {
  return !!country && EU_COUNTRIES.has(country.trim().toUpperCase());
}

export type VatTreatment =
  /** We are not VAT registered — no VAT on anything. */
  | "not_registered"
  /** Buyer is in our own country: ordinary domestic VAT. */
  | "domestic"
  /** Buyer is a VAT-registered business elsewhere in the EU: they account for it, we charge 0%. */
  | "eu_reverse_charge"
  /** Buyer is in the EU with no VAT ID. Destination-country VAT under OSS — not guessable here. */
  | "eu_b2c"
  /** Buyer is outside the EU: outside the scope of EU VAT. */
  | "outside_eu";

export interface VatDecision {
  treatment: VatTreatment;
  /** The rate to apply, as a percentage. */
  ratePct: number;
  /**
   * The sentence printed on the invoice beside the VAT line. Not decoration: for reverse charge and
   * out-of-scope supplies the legal reference is what makes a 0% line valid rather than a mistake.
   */
  note: string | null;
  /**
   * True when a human has to decide before this invoice can be issued. Better a blocked invoice than
   * a confidently wrong one — an incorrect VAT treatment is corrected with a credit note and an
   * apology to someone's accountant.
   */
  needsReview: boolean;
}

export interface VatContext {
  /** Our own registered country, ISO alpha-2. */
  issuerCountry: string;
  /** Our VAT number. Absent = not VAT registered, which changes everything below. */
  issuerVatId: string | null | undefined;
  /** Our domestic standard rate, e.g. 20 for Bulgaria. */
  standardRatePct: number;
  /** The hotel's country, ISO alpha-2. */
  buyerCountry: string | null | undefined;
  /** The hotel's VAT number, if they gave us one. */
  buyerVatId: string | null | undefined;
}

/**
 * A VAT ID is present in the sense that matters: something was actually filled in.
 *
 * Deliberately NOT a validity check. Whether a number is live in VIES is a network call to someone
 * else's service, and a service being down must never silently reclassify a customer from reverse
 * charge to 20% VAT. Validation belongs at the point the number is ENTERED, where a person can fix
 * it; this function only decides treatment from what we hold.
 */
function hasVatId(v: string | null | undefined): boolean {
  return !!v && v.trim().length >= 4;
}

export function decideVat(ctx: VatContext): VatDecision {
  const issuerCountry = ctx.issuerCountry.trim().toUpperCase();
  const buyerCountry = (ctx.buyerCountry ?? "").trim().toUpperCase();

  if (!hasVatId(ctx.issuerVatId)) {
    return {
      treatment: "not_registered",
      ratePct: 0,
      note: "No VAT charged — the supplier is not registered for VAT.",
      needsReview: false,
    };
  }

  if (!buyerCountry) {
    // Not a tax question — a data question. Without a country there is no treatment to choose, and
    // defaulting to domestic would quietly overcharge every foreign customer whose address we
    // simply have not filled in yet.
    return {
      treatment: "domestic",
      ratePct: ctx.standardRatePct,
      note: null,
      needsReview: true,
    };
  }

  if (buyerCountry === issuerCountry) {
    return { treatment: "domestic", ratePct: ctx.standardRatePct, note: null, needsReview: false };
  }

  if (isEu(buyerCountry)) {
    if (hasVatId(ctx.buyerVatId)) {
      return {
        treatment: "eu_reverse_charge",
        ratePct: 0,
        note: "Reverse charge — VAT to be accounted for by the recipient (Art. 196, Directive 2006/112/EC).",
        needsReview: false,
      };
    }
    // An EU business with no VAT number is treated as a consumer, and consumer sales of digital
    // services are taxed where the CUSTOMER is, through OSS. That needs an OSS registration and the
    // destination country's rate — neither of which this function can invent. It is also rare enough
    // (a hotel below its country's VAT threshold) that a person should look at it.
    return {
      treatment: "eu_b2c",
      ratePct: ctx.standardRatePct,
      note: `Customer in ${buyerCountry} with no VAT number — destination-country VAT may apply under the OSS scheme. Confirm before issuing.`,
      needsReview: true,
    };
  }

  return {
    treatment: "outside_eu",
    ratePct: 0,
    note: "Outside the scope of EU VAT — service supplied to a customer established outside the EU.",
    needsReview: false,
  };
}

export interface VatAmounts {
  netMinor: number;
  taxMinor: number;
  grossMinor: number;
}

/**
 * Add VAT to a net amount.
 *
 * Rounds once, at the total. Rounding each line and summing produces a total that disagrees with
 * net + tax by a cent or two, and a customer's accounts-payable system rejects an invoice whose
 * arithmetic does not close.
 */
export function applyVat(netMinor: number, ratePct: number): VatAmounts {
  const taxMinor = Math.round((netMinor * ratePct) / 100);
  return { netMinor, taxMinor, grossMinor: netMinor + taxMinor };
}
