/**
 * What a chosen extra costs — quoted to the guest, and charged on the folio.
 *
 * Pure, and shared, because this number is computed in three places that must never disagree: the
 * booking page shows it as the guest ticks a box, the server re-derives it when the booking is
 * submitted (a form carries identifiers, never amounts), and the PMS accrues it onto the folio. The
 * all-in promise — the first number you see is the number you pay — survives exactly as long as
 * those three agree, which is why the arithmetic is a function rather than a habit.
 */

export type ExtraBasis = "per_stay" | "per_night";

export interface SellableExtra {
  id: string;
  name: string;
  description?: string | null;
  /** Per stay, or per night, depending on `basis`. Minor units, like all money here. */
  priceMinor: number;
  basis: ExtraBasis;
}

/**
 * The total for one extra over a stay.
 *
 * Deliberately NOT multiplied by guests. Per-person pricing is a real thing hotels want and a real
 * source of surprise totals — "€12 breakfast" quoted at €12 and charged at €24 is the exact
 * complaint this product exists to avoid. If it is added later it needs its own basis value and its
 * own line in the summary, not a silent factor here.
 */
export function extraTotalMinor(extra: Pick<SellableExtra, "priceMinor" | "basis">, nights: number): number {
  const n = Math.max(1, Math.floor(nights));
  return extra.basis === "per_night" ? extra.priceMinor * n : extra.priceMinor;
}

/** The sum for a set of chosen extras — what `computeStayCharges` takes as `extrasMinor`. */
export function extrasTotalMinor(chosen: readonly Pick<SellableExtra, "priceMinor" | "basis">[], nights: number): number {
  return chosen.reduce((sum, e) => sum + extraTotalMinor(e, nights), 0);
}

/**
 * Keep only the ids the hotel actually offers, in catalogue order.
 *
 * The guest's selection arrives as ids from a form, so it is untrusted input: an id that is not on
 * offer must be dropped rather than priced. Returning catalogue order (not selection order) also
 * means the confirmation lists extras the same way the booking page did.
 */
export function resolveChosenExtras(
  offered: readonly SellableExtra[],
  chosenIds: readonly string[],
): SellableExtra[] {
  const wanted = new Set(chosenIds);
  return offered.filter((e) => wanted.has(e.id));
}

/** How an extra's price reads next to its name. `nights` is only needed for the per-night form. */
export function extraPriceLabel(
  extra: Pick<SellableExtra, "priceMinor" | "basis">,
  format: (minor: number) => string,
): string {
  return extra.basis === "per_night"
    ? `${format(extra.priceMinor)} a night`
    : format(extra.priceMinor);
}
