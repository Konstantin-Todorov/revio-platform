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

/*
 * There is deliberately NO statutory rate band constant here.
 *
 * чл. 61с ал. 1 states one, and it was written in лева: 0.20 to 3.00. Bulgaria is on the euro, and
 * I could not establish from the published sources what those figures became on redenomination —
 * what turned up was a PROPOSAL to raise the ceiling, which is not law. So the band is not asserted
 * anywhere, in code or on screen.
 *
 * Nothing was validating against it in any case, which made it a claim about the law that no
 * behaviour depended on — exactly the shape of the fiscalization note that was wrong for a month.
 * The hotel enters the rate its own council set, in its own currency, and that is the only figure
 * that is certainly right.
 */

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

/**
 * Nights of a stay that fall inside a given calendar month.
 *
 * чл. 61с ал. 2 taxes «броят на **предоставените** нощувки за месеца» — the nights PROVIDED in that
 * month, which is not the same as the nights of the stays registered in it, and not the same as the
 * nights of the stays that started in it.
 *
 * Two ways to get this wrong, and the register makes both visible:
 *
 *  - A stay registered in August for nights slept in June belongs to June's return. Counting it in
 *    August overstates one month and understates another, and both are separately payable.
 *  - A stay from 30 August to 2 September provides TWO nights in August and one in September. Billed
 *    whole to either month, the hotel pays the right annual total on the wrong two returns.
 *
 * A night is identified by the date it begins, so the stay covers [arrival, departure) and the month
 * covers [first, last]. Nothing here is timezone-sensitive: these are calendar dates already
 * resolved in the property's own zone.
 */
export function nightsInMonth(
  arrivalDate: string,
  departureDate: string | null,
  monthIso: string,
): number {
  if (departureDate == null || !/^\d{4}-\d{2}$/.test(monthIso)) return 0;

  const start = `${monthIso}-01`;
  const [y, m] = monthIso.split("-").map(Number);
  const end = new Date(Date.UTC(y!, m!, 1)).toISOString().slice(0, 10); // first of the NEXT month

  // The overlap of [arrival, departure) with [start, end), in whole nights.
  const from = arrivalDate > start ? arrivalDate : start;
  const to = departureDate < end ? departureDate : end;
  if (to <= from) return 0;

  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
