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
 * ## Three registrations, not a toggle (2026-09-09)
 *
 * This used to read `vatId != null` as "registered" and charge the domestic rate. Bulgaria has a
 * **third state between registered and not**, and it is the one we are actually in:
 *
 * | | What it is | Domestic sale | EU B2B sale |
 * | --- | --- | --- | --- |
 * | `none` | Not registered | no VAT | no VAT |
 * | `art97a` | **чл. 97а ЗДДС** — a real BG number, valid only for cross-border services | **no VAT may be stated** (чл. 113, ал. 9) | reverse charge |
 * | `full` | **чл. 96 ЗДДС** — ordinary registration | domestic rate | reverse charge |
 *
 * The middle row is why this is not a boolean. Under чл. 97а we hold a BG VAT number and are
 * nonetheless **prohibited from putting VAT on a Bulgarian invoice** — and we cannot deduct input
 * VAT either (чл. 70, ал. 4). Reading the number's presence as "charge 20%" was therefore wrong in
 * the most expensive direction: collecting tax from a customer that we are not entitled to state.
 *
 * ⚠️ **`art97a` domestic is NOT a 0% rate.** A zero-rated supply and a supply on which VAT may not
 * be stated are different things, and an invoice printing "VAT 0%" where the law wants
 * „ДДС не се начислява на основание чл. 113, ал. 9 ЗДДС" is a defective document. `suppressVatLine`
 * carries that distinction to the renderer, because the rate alone cannot.
 *
 * ## Crossing into full registration
 *
 * From 2026-01-01 чл. 96 becomes mandatory above **EUR 51,130 of DOMESTIC turnover in a calendar
 * year** — a calendar-year test, not a rolling twelve months, and the application is due within
 * seven days of crossing. EU B2B supplies whose place of supply is abroad under чл. 21, ал. 2 do
 * **not** count toward it. `vat-threshold.ts` monitors exactly that, which is why it counts only
 * `domestic` and `art97a_domestic` invoices.
 *
 * ## This is not tax advice
 *
 * The rules below are the ordinary treatment for B2B electronically supplied services under
 * Directive 2006/112/EC and the Bulgarian ЗДДС. Sources are listed in `docs/PLAN-2026-09-09.md` §3.
 * An accountant should confirm them against our actual registration certificate — the one fact no
 * amount of reading settles is which article WE are registered under, and it is printed on it.
 */

/** Which VAT registration the issuer holds. See the table above — the middle one is not a rate. */
export type VatRegistration = "none" | "art97a" | "full";

export const VAT_REGISTRATIONS: { value: VatRegistration; label: string; detail: string }[] = [
  {
    value: "none",
    label: "Not registered",
    detail: "No VAT on any invoice, to anyone. What a company looks like before it crosses the threshold.",
  },
  {
    value: "art97a",
    label: "Registered for cross-border services only (чл. 97а)",
    detail:
      "We hold a BG VAT number but may not state VAT on a Bulgarian invoice, and cannot deduct input VAT. EU business customers are invoiced under reverse charge.",
  },
  {
    value: "full",
    label: "Fully registered (чл. 96)",
    detail:
      "Ordinary registration. Bulgarian customers are charged the domestic rate; EU business customers are still reverse charge.",
  },
];

export function isVatRegistration(v: string | null | undefined): v is VatRegistration {
  return v === "none" || v === "art97a" || v === "full";
}

/**
 * What the company row says, read defensively.
 *
 * A row written before this column existed, or by hand, can hold anything. Falling back to the
 * *narrowest* treatment is the safe direction: under-charging is corrected before issuing, while
 * over-charging has already taken money we must give back.
 */
export function registrationOf(company: { vatRegistration?: string | null; vatId?: string | null }): VatRegistration {
  if (isVatRegistration(company.vatRegistration)) return company.vatRegistration;
  return "none";
}

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
  /**
   * Buyer is in our own country and we hold only a чл. 97а registration.
   *
   * Its own treatment rather than a 0% `domestic`, because the invoice must carry a specific legal
   * ground and must NOT show a VAT line. See `suppressVatLine`.
   */
  | "art97a_domestic"
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
  /**
   * Print no VAT line at all, rather than a line reading 0%.
   *
   * Only чл. 97а domestic supplies set this. Everything else at 0% — reverse charge, outside the
   * EU — is a supply that HAS a VAT treatment which happens to be zero, and showing the line with
   * its legal note is what makes the document valid. A чл. 113, ал. 9 supply is the opposite: the
   * law says VAT may not be stated, so stating it as zero is stating it.
   */
  suppressVatLine: boolean;
  /**
   * Does this sale count toward the чл. 96 registration threshold?
   *
   * Only domestic supplies do. An EU B2B service is supplied where the customer is, so it is outside
   * Bulgarian turnover entirely — counting it would have us registering years early.
   */
  countsTowardThreshold: boolean;
}

export interface VatContext {
  /** Our own registered country, ISO alpha-2. */
  issuerCountry: string;
  /**
   * WHICH registration we hold. This, not the presence of a number, is what decides.
   *
   * Optional so that a caller written before 2026-09-09 still compiles — and when it is missing the
   * old inference is applied, which is stated at the call site rather than hidden here.
   */
  registration?: VatRegistration;
  /** Our VAT number. Printed on the invoice; on its own it decides nothing. */
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

  /*
   * The registration decides, and the number only appears on the document.
   *
   * When a caller has not been updated to pass one, fall back to the OLD inference so nothing
   * silently changes treatment — but note that the old inference is the defect this function was
   * changed to fix, so every real call site passes it explicitly.
   */
  const registration: VatRegistration = ctx.registration ?? (hasVatId(ctx.issuerVatId) ? "full" : "none");

  if (registration === "none") {
    return {
      treatment: "not_registered",
      ratePct: 0,
      note: "No VAT charged — the supplier is not registered for VAT.",
      needsReview: false,
      suppressVatLine: true,
      countsTowardThreshold: !!buyerCountry && buyerCountry === issuerCountry,
    };
  }

  if (!buyerCountry) {
    /*
     * Not a tax question — a data question.
     *
     * Without a country there is no treatment to choose, and defaulting to domestic would quietly
     * overcharge every foreign customer whose address we simply have not filled in yet. Blocked
     * rather than guessed: `needsReview` stops the invoice at `invoice-doc.ts`.
     */
    return {
      treatment: "domestic",
      ratePct: registration === "full" ? ctx.standardRatePct : 0,
      note: null,
      needsReview: true,
      suppressVatLine: false,
      countsTowardThreshold: true,
    };
  }

  if (buyerCountry === issuerCountry) {
    if (registration === "art97a") {
      /*
       * The case this whole rewrite exists for.
       *
       * We hold a BG VAT number and are nonetheless forbidden to put VAT on this invoice. It is not
       * a zero rate and must not print as one — `suppressVatLine` is what carries that to the
       * renderer, because a rate of 0 is indistinguishable from an exempt supply once it is a number.
       *
       * It DOES count toward the чл. 96 threshold: domestic turnover is exactly what that test
       * measures, and it is measured whether or not we are charging VAT on it. This is the number
       * that eventually forces full registration, so it must not be quietly excluded because it
       * happens to carry no tax.
       */
      return {
        treatment: "art97a_domestic",
        ratePct: 0,
        note: "ДДС не се начислява на основание чл. 113, ал. 9 ЗДДС. · No VAT is charged — the supplier is registered under Art. 97a of the Bulgarian VAT Act, for cross-border services only.",
        needsReview: false,
        suppressVatLine: true,
        countsTowardThreshold: true,
      };
    }
    return {
      treatment: "domestic",
      ratePct: ctx.standardRatePct,
      note: null,
      needsReview: false,
      suppressVatLine: false,
      countsTowardThreshold: true,
    };
  }

  if (isEu(buyerCountry)) {
    if (hasVatId(ctx.buyerVatId)) {
      /*
       * Reverse charge, and identical under чл. 97а and чл. 96 — which is the point of holding a
       * чл. 97а registration at all. The place of supply is the customer's member state, so this is
       * not Bulgarian turnover and never counts toward the threshold.
       *
       * Both legal grounds are printed, in both languages. Art. 226(11a) of the directive requires
       * the words "reverse charge" on the document; the Bulgarian article is what our own revenue
       * office reads.
       */
      return {
        treatment: "eu_reverse_charge",
        ratePct: 0,
        note: "Обратно начисляване — чл. 21, ал. 2 ЗДДС. · Reverse charge — VAT to be accounted for by the recipient (Art. 44 and Art. 196, Council Directive 2006/112/EC).",
        needsReview: false,
        suppressVatLine: false,
        countsTowardThreshold: false,
      };
    }
    /*
     * An EU business with no VAT number is treated as a consumer, and consumer sales of digital
     * services are taxed where the CUSTOMER is, through OSS. That needs an OSS registration and the
     * destination country's rate — neither of which this function can invent.
     *
     * Under чл. 97а it is worse than merely unknown: that registration does not permit charging
     * VAT at all, so there is no rate we could fall back to even if we wanted one. Either way a
     * person decides, which is what `needsReview` buys.
     */
    return {
      treatment: "eu_b2c",
      ratePct: registration === "full" ? ctx.standardRatePct : 0,
      note:
        registration === "art97a"
          ? `Customer in ${buyerCountry} with no VAT number. A чл. 97а registration does not permit charging VAT, and a consumer sale of digital services is taxed in the customer's country under OSS. Ask an accountant before issuing this one.`
          : `Customer in ${buyerCountry} with no VAT number — destination-country VAT may apply under the OSS scheme. Confirm before issuing.`,
      needsReview: true,
      suppressVatLine: false,
      countsTowardThreshold: false,
    };
  }

  return {
    treatment: "outside_eu",
    ratePct: 0,
    note: "Outside the scope of EU VAT — service supplied to a customer established outside the EU.",
    needsReview: false,
    suppressVatLine: false,
    countsTowardThreshold: false,
  };
}

/**
 * Should the document omit the VAT line entirely, given only the snapshotted treatment?
 *
 * The renderer holds a stored `vatTreatment` string rather than a `VatDecision`, deliberately: an
 * invoice is rendered from what was decided when it was ISSUED, never re-decided today. So the rule
 * has to be answerable from the treatment alone, and it is.
 *
 * Kept beside `decideVat` rather than in the renderer so the two cannot disagree — a treatment added
 * here and forgotten there would print a VAT line the law forbids.
 */
export function suppressesVatLine(treatment: string | null | undefined): boolean {
  return treatment === "art97a_domestic" || treatment === "not_registered";
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
