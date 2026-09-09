/**
 * How close we are to mandatory VAT registration, and how long we would have to act.
 *
 * ## Why this is a screen and not a spreadsheet
 *
 * From 2026-01-01 registration under **чл. 96 ЗДДС** becomes mandatory once domestic turnover
 * exceeds **EUR 51,130 in a calendar year**, and the application is due within **seven days** of
 * crossing. Two properties of that rule make it a bad fit for human memory:
 *
 *   1. **It is a calendar-year test, not a rolling twelve months.** The count restarts on 1 January,
 *      so an intuition built on "the last year of trading" is wrong in both directions — reassuring
 *      in January, alarming in December.
 *   2. **The deadline is seven days from an event nobody is watching for.** The threshold is crossed
 *      by an invoice, not by a date, so the only way to notice on time is to look at invoices.
 *
 * We have every invoice. Deriving this costs one query and removes a class of penalty that is
 * entirely avoidable, so it is derived.
 *
 * ## What counts, and the part that is easy to get wrong
 *
 * **Only DOMESTIC supplies.** A SaaS subscription sold to a VAT-registered business in another EU
 * member state is supplied where the customer is (чл. 21, ал. 2) — it is not Bulgarian turnover and
 * does not enter this test at all. Counting it would have us registering early, which is not a safe
 * error: full registration means charging 20% to Bulgarian customers who were not being charged it,
 * plus monthly filings, and it cannot be undone for a year.
 *
 * The domestic test is applied to the **customer's country**, not to the VAT treatment recorded on
 * the invoice. Under a `none` registration every treatment reads `not_registered` regardless of who
 * bought, so the treatment cannot answer the question — and `none` is exactly the state in which
 * this monitor matters most.
 *
 * **Demo tenants are excluded**, like everywhere else money is counted (`lib/demo.ts`): their
 * invoices exist so the billing flow stays testable and are not income. Including them would report
 * a tax obligation arising from our own rehearsals.
 *
 * **Drafts do not count.** Turnover arises from a supply that has been invoiced, and a draft is a
 * number we have not sent to anybody.
 *
 * ⚠️ Not tax advice, and deliberately conservative where it is unsure — see `docs/PLAN-2026-09-09.md`
 * §3 for sources. It reports a position; a person decides what to do about it.
 */

/** EUR 51,130, in minor units. The 2026 figure — see the sources note above. */
export const VAT_THRESHOLD_MINOR = 5_113_000;

/** Days to apply after crossing. Short enough that finding out late is the whole risk. */
export const VAT_REGISTRATION_DEADLINE_DAYS = 7;

export interface ThresholdInvoice {
  /** Null for a draft — which is why drafts fall out below rather than being filtered by caller. */
  issuedAt: Date | null;
  /** Net of VAT. The threshold is measured on turnover, not on what was collected. */
  netMinor: number | null;
  /** Written when the draft was generated; the fallback when an invoice predates `netMinor`. */
  amountMinor: number;
  /** The customer's country, ISO alpha-2. Null when we simply have not filled it in. */
  buyerCountry: string | null;
  isDemo: boolean;
}

export type ThresholdBand = "quiet" | "approaching" | "close" | "crossed";

export interface ThresholdStatus {
  year: number;
  turnoverMinor: number;
  thresholdMinor: number;
  /** Never negative — past the threshold the question is no longer "how much is left". */
  remainingMinor: number;
  /** 0–100+, for a bar. Not clamped: being at 140% is information. */
  pctUsed: number;
  band: ThresholdBand;
  crossed: boolean;
  /** How many invoices were counted, and how many were left out — so the number can be argued with. */
  countedCount: number;
  excludedCount: number;
  /**
   * Customers with no country on file whose invoices were therefore NOT counted.
   *
   * Reported rather than assumed either way. Treating them as domestic would invent a liability;
   * treating them as foreign and staying silent would hide one. Naming them is the only honest
   * option, and it is also a to-do: fill in the country.
   */
  unknownCountryCount: number;
}

function band(pct: number): ThresholdBand {
  if (pct >= 100) return "crossed";
  if (pct >= 90) return "close";
  if (pct >= 70) return "approaching";
  return "quiet";
}

/**
 * Pure: given the invoices and who we are, where do we stand this calendar year?
 *
 * `issuerCountry` rather than a hard-coded "BG" because the domestic test is "the country the
 * supplier is established in", and that is a field on the company row — a hard-coded country would
 * quietly become wrong for anybody who ever forks this.
 */
export function vatThresholdStatus(
  invoices: ThresholdInvoice[],
  issuerCountry: string,
  year: number,
): ThresholdStatus {
  const issuer = issuerCountry.trim().toUpperCase();
  let turnoverMinor = 0;
  let countedCount = 0;
  let excludedCount = 0;
  let unknownCountryCount = 0;

  for (const inv of invoices) {
    if (inv.isDemo || !inv.issuedAt || inv.issuedAt.getUTCFullYear() !== year) {
      excludedCount++;
      continue;
    }
    const country = (inv.buyerCountry ?? "").trim().toUpperCase();
    if (!country) {
      unknownCountryCount++;
      excludedCount++;
      continue;
    }
    if (country !== issuer) {
      excludedCount++;
      continue;
    }
    // `netMinor` is the VAT-exclusive figure and the right one; `amountMinor` is the fallback for
    // invoices generated before the document fields existed, where the two are the same number.
    turnoverMinor += inv.netMinor ?? inv.amountMinor;
    countedCount++;
  }

  const pctUsed = (turnoverMinor / VAT_THRESHOLD_MINOR) * 100;
  return {
    year,
    turnoverMinor,
    thresholdMinor: VAT_THRESHOLD_MINOR,
    remainingMinor: Math.max(0, VAT_THRESHOLD_MINOR - turnoverMinor),
    pctUsed,
    band: band(pctUsed),
    crossed: turnoverMinor > VAT_THRESHOLD_MINOR,
    countedCount,
    excludedCount,
    unknownCountryCount,
  };
}

/**
 * What to say about that position — one sentence, written for somebody who has not read the law.
 *
 * The wording changes with the registration we already hold, because the same number means different
 * things: a fully registered company has nothing to do at any level, while one on чл. 97а has a
 * seven-day clock that starts without warning.
 */
export function thresholdAdvice(status: ThresholdStatus, registration: "none" | "art97a" | "full"): string | null {
  if (registration === "full") return null; // already registered — the threshold is behind us
  const eur = (m: number) => `€${(m / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

  if (status.crossed) {
    return `Domestic turnover for ${status.year} is ${eur(status.turnoverMinor)}, past the ${eur(status.thresholdMinor)} threshold. Registration under чл. 96 is mandatory and the application is due within ${VAT_REGISTRATION_DEADLINE_DAYS} days of crossing it.`;
  }
  if (status.band === "close") {
    return `${eur(status.remainingMinor)} of domestic turnover left before registration under чл. 96 becomes mandatory. Once crossed there are only ${VAT_REGISTRATION_DEADLINE_DAYS} days to apply, so it is worth preparing now rather than then.`;
  }
  if (status.band === "approaching") {
    return `${eur(status.remainingMinor)} left this calendar year before VAT registration becomes mandatory. The count restarts on 1 January.`;
  }
  return null;
}
