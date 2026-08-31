/**
 * Туристически данък — the municipal tourist tax, ЗМДТ чл. 61р–61с.
 *
 * Read from the statute rather than from a summary, and the provisions are quoted where they decide
 * something, because the last Bulgarian rule this codebase encoded from memory was wrong for a month.
 *
 * The reason this belongs next to the register and not in a reports folder is чл. 61с ал. 2: the
 * municipality assesses the monthly tax **from ЕСТИ data**. The register IS the tax base. A hotel
 * whose register is wrong does not merely file a bad return — it is assessed on somebody else's
 * numbers.
 *
 * WHAT THIS IS NOT: a filing. Nothing here submits anything, and the figures are the hotel's own
 * arithmetic on their own nights, to be checked by whoever does their books.
 */

/** чл. 61с ал. 1 — the municipal council sets the rate per нощувка within this band. */
export const STATUTORY_RATE_MIN_MINOR = 20;
export const STATUTORY_RATE_MAX_MINOR = 300;

/** чл. 61с ал. 4 — the annual floor is assessed at 30% occupancy of the bed base. */
export const ANNUAL_OCCUPANCY_FLOOR = 0.3;

/**
 * чл. 61с ал. 2 — the month's tax is the nights provided times the rate.
 *
 * Cancelled registrations are not nights provided and must be excluded by the caller; this function
 * is given a count, not a register.
 */
export function monthlyTouristTax(nights: number, rateMinor: number): number {
  if (nights <= 0 || rateMinor <= 0) return 0;
  return Math.round(nights * rateMinor);
}

/** Days in a calendar year — `Р` in the formula. Leap years are 366 and it matters at 30%. */
export function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

export interface AnnualFloorInput {
  year: number;
  /** `Л` — the number of BEDS, not rooms. The statute says легла. */
  beds: number;
  /** `Д` — the municipal rate per night, in minor units. */
  rateMinor: number;
  /** `ДП` — the sum of the monthly tax already assessed for the year, in minor units. */
  paidMinor: number;
}

export interface AnnualFloorResult {
  /** `Р × Л × Д × 30%` — what the year owes at the statutory floor. */
  floorMinor: number;
  /** `ДД` — the top-up owed, never negative. */
  topUpMinor: number;
  /** True when the year's real nights already clear the floor and nothing more is owed. */
  clearsFloor: boolean;
}

/**
 * чл. 61с ал. 4–5 — the annual floor, and the top-up owed if a year falls under it.
 *
 *   ДД = (Р × Л × Д × 30%) − ДП
 *
 * The comparison is made **for the calendar YEAR, not per month**. That distinction is the whole
 * point of the provision and is easy to get backwards: a hotel is not topped up for a quiet
 * February, only for a quiet twelve months. Running it monthly would bill a seasonal property —
 * which is most of the Bulgarian coast — for every closed month.
 *
 * A negative result is not a refund. The statute makes the difference payable when the sum falls
 * short; it gives nothing back when it does not, so the top-up floors at zero.
 */
export function annualTouristTaxFloor(input: AnnualFloorInput): AnnualFloorResult {
  const { year, beds, rateMinor, paidMinor } = input;
  if (beds <= 0 || rateMinor <= 0) {
    return { floorMinor: 0, topUpMinor: 0, clearsFloor: true };
  }
  const floorMinor = Math.round(daysInYear(year) * beds * rateMinor * ANNUAL_OCCUPANCY_FLOOR);
  const topUpMinor = Math.max(0, floorMinor - paidMinor);
  return { floorMinor, topUpMinor, clearsFloor: topUpMinor === 0 };
}

/**
 * The three dates this tax runs on.
 *
 * - чл. 61с ал. 3 — the month's tax by the 15th of the following month.
 * - чл. 61р ал. 5 — the annual declaration by 31 January.
 * - чл. 61с ал. 4 — any annual top-up by 1 March.
 */
export function monthlyTaxDueDate(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m!, 15));
  return d.toISOString().slice(0, 10);
}

export function annualDeclarationDueDate(year: number): string {
  return `${year + 1}-01-31`;
}

export function annualTopUpDueDate(year: number): string {
  return `${year + 1}-03-01`;
}

/**
 * A bed count from the room types, for a property that has not stated one.
 *
 * A guess, and offered as one. `maxGuests × rooms` is the sleeping capacity we hold, which is the
 * closest thing we have to легла — but a room that sleeps two on a sofa bed is not two легла to
 * every municipality, and the declared bed base is a number the hotel agreed with theirs. It seeds
 * the field; it does not decide it.
 */
export function estimateBeds(roomTypes: readonly { maxGuests: number; totalRooms: number }[]): number {
  return roomTypes.reduce((n, rt) => n + Math.max(0, rt.maxGuests) * Math.max(0, rt.totalRooms), 0);
}
