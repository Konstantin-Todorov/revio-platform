/**
 * Does a promo code apply to this stay on this rate — and if not, why not, in a word a page can say.
 *
 * A code takes a percentage off the ROOM price of every night, never off taxes, fees or extras: the
 * hotel gave a discount on its rooms, and the tourist tax is not the hotel's to discount. Applied per
 * night so the per-night snapshot the folio bills from carries the discounted price.
 */
export interface PromoRule {
  code: string;
  percentOff: number;
  stayFrom: string | null; // YYYY-MM-DD, arrivals from
  stayTo: string | null;   // arrivals until
  minNights: number | null;
  ratePlanIds: string[];
  maxUses: number | null;
  usedCount: number;
  active: boolean;
}

export type PromoRefusal = "unknown" | "inactive" | "dates" | "nights" | "used_up";

/** Normalise what a guest typed: trim, upper-case, letters/digits/dash only, at most 24. */
export function normalisePromo(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
}

/** Whether the code can be used for this stay at all (before looking at a particular rate). */
export function promoRefusal(p: PromoRule | null, stay: { arrival: string; nights: number }): PromoRefusal | null {
  if (!p) return "unknown";
  if (!p.active) return "inactive";
  if (p.maxUses != null && p.usedCount >= p.maxUses) return "used_up";
  if ((p.stayFrom && stay.arrival < p.stayFrom) || (p.stayTo && stay.arrival > p.stayTo)) return "dates";
  if (p.minNights != null && stay.nights < p.minNights) return "nights";
  return null;
}

/** The percentage for one rate: 0 when the code is limited to other rates. */
export function promoPercentFor(p: PromoRule, ratePlanId: string): number {
  if (p.ratePlanIds.length > 0 && !p.ratePlanIds.includes(ratePlanId)) return 0;
  return Math.min(90, Math.max(0, Math.round(p.percentOff)));
}

/** A night's room price after the code — rounded to the cent, never below zero. */
export function discountedNight(minor: number, percent: number): number {
  return percent > 0 ? Math.max(0, Math.round((minor * (100 - percent)) / 100)) : minor;
}
