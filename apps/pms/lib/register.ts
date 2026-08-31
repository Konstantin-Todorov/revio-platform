import { claimRegisterNo, withTenantTransaction } from "@revio/db";
import {
  averageNightlyPrice, registerNights, splitName, estimateBeds, monthlyTouristTax,
  annualTouristTaxFloor, monthlyTaxDueDate, annualDeclarationDueDate, annualTopUpDueDate, nightsInMonth,
  type TouristRegisterEntry,
} from "@revio/core";
import { prisma } from "./db";
import { ymd, utcDay, addDaysYmd, hmInTz } from "./format";

/** One room's worth of the check-in: which unit, and how many people slept in it. */
export interface RegisterSeedSpec {
  unitLabel: string;
  floor: string | null;
  guestsCount: number;
}

export interface RegisterSeedInput {
  tenantId: string;
  propertyId: string;
  reservationId: string;
  /** The booker, when we know them — the first row is prefilled from their profile. */
  leadGuestId: string | null;
  leadGuestName: string;
  registeredAt: Date;
  specs: readonly RegisterSeedSpec[];
}

/**
 * Open the register entries for a stay at check-in — регистър на настанените туристи, чл. 116 ЗТ.
 *
 * Rows are created EMPTY apart from what check-in already knows: the room, the floor, the date and
 * the booker's name on the first of them. Everything else — document, citizenship, date of birth —
 * is completed on the stay's register card afterwards.
 *
 * That is deliberate, and it is the whole shape of this feature. A guest arriving at 23:00 with a
 * colleague still parking gets checked in; a hotel that had to type four passports before it could
 * give somebody a key would keep the register somewhere else, and then we would have built nothing.
 * The incompleteness is visible and chased, rather than prevented and worked around.
 *
 * Idempotent: a stay that already has register entries is left alone, so a re-run after a partial
 * failure cannot double-register a party or burn register numbers.
 */
export async function seedRegisterEntries(input: RegisterSeedInput): Promise<void> {
  const existing = await prisma.stayGuest.count({ where: { reservationId: input.reservationId } });
  if (existing > 0) return;

  await withTenantTransaction(input.tenantId, async (tx) => {
    // Re-checked inside the lock: the count above is advisory, this is the one that decides.
    const again = await tx.stayGuest.count({ where: { reservationId: input.reservationId } });
    if (again > 0) return;

    let next = await claimRegisterNo(tx, input.propertyId);
    let first = true;

    for (const spec of input.specs) {
      // At least one person per room. `guestsCount` can be null on an old or imported line, and a
      // room nobody is registered in is worse than a room with one row to correct.
      const people = Math.max(1, spec.guestsCount);
      for (let i = 0; i < people; i++) {
        await tx.stayGuest.create({
          data: {
            tenantId: input.tenantId,
            propertyId: input.propertyId,
            reservationId: input.reservationId,
            guestId: first ? input.leadGuestId : null,
            registerNo: next++,
            registeredAt: input.registeredAt,
            // Only the booker's name is known at this point, and it arrives as one string from the
            // channel. Split on the same rule the migration used — first token given, last family,
            // the rest patronymic — and left for the desk to correct against the document, which is
            // the only place the three parts are actually authoritative.
            ...(first ? splitName(input.leadGuestName) : {}),
            unitLabel: spec.unitLabel,
            floor: spec.floor,
          },
        });
        first = false;
      }
    }
  });
}

/**
 * The property's register for a date range — every accommodated person, in пореден номер order.
 *
 * Ranged on the REGISTRATION date, not on arrival or departure. That is what the register is
 * ordered and numbered by, and it is the only range that returns each entry exactly once: a stay
 * spanning a month boundary would otherwise appear in both months or in neither, depending on which
 * end was matched.
 */
export async function getRegisterEntries(
  propertyId: string,
  timezone: string,
  fromIso: string,
  toIso: string,
): Promise<(TouristRegisterEntry & { id: string; reservationId: string })[]> {
  const rows = await prisma.stayGuest.findMany({
    where: {
      propertyId,
      registeredAt: { gte: utcDay(fromIso), lt: utcDay(addDaysYmd(toIso, 1)) },
    },
    orderBy: { registerNo: "asc" },
    include: {
      reservation: {
        select: {
          totalMinor: true, propertyTotalMinor: true, departedAt: true,
          lines: { select: { checkIn: true, checkOut: true } },
          assignments: { select: { checkedInAt: true, checkedOutAt: true } },
          _count: { select: { stayGuests: true } },
        },
      },
    },
  });

  return rows.map((g) => {
    const r = g.reservation;
    const ci = r.lines.map((l) => l.checkIn).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    const co = r.lines.map((l) => l.checkOut).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const inAt = r.assignments.map((a) => a.checkedInAt).filter((d): d is Date => d != null)
      .sort((x, y) => x.getTime() - y.getTime())[0] ?? null;
    const outAt = r.assignments.map((a) => a.checkedOutAt).filter((d): d is Date => d != null)
      .sort((x, y) => y.getTime() - x.getTime())[0] ?? null;

    const arrivalDate = ci ? ymd(ci) : "";
    const departureDate = r.departedAt ? ymd(r.departedAt) : co ? ymd(co) : null;
    const nights = registerNights(arrivalDate, departureDate);
    const party = Math.max(1, r._count.stayGuests);

    return {
      id: g.id,
      reservationId: g.reservationId,
      registerNo: g.registerNo,
      registeredAt: ymd(g.registeredAt),
      registeredAtTime: hmInTz(g.registeredAt, timezone),
      firstName: g.firstName ?? "",
      middleName: g.middleName,
      lastName: g.lastName ?? "",
      personalId: g.personalId,
      dateOfBirth: g.dateOfBirth ? ymd(g.dateOfBirth) : null,
      sex: g.sex as "m" | "f" | null,
      nationality: g.nationality ?? "",
      documentType: g.documentType as "id_card" | "passport" | "other" | null,
      documentNumber: g.documentNumber,
      documentSeries: g.documentSeries,
      documentCountry: g.documentCountry,
      floor: g.floor,
      unitLabel: g.unitLabel,
      arrivalDate,
      arrivalTime: inAt ? hmInTz(inAt, timezone) : null,
      departureDate,
      departureTime: outAt ? hmInTz(outAt, timezone) : null,
      nights,
      touristPackage: g.touristPackage,
      // Per PERSON, not per room: the column is the average price of a night for this registration,
      // and charging one guest the whole room would overstate every stay with more than one in it.
      avgNightlyPriceMinor: averageNightlyPrice(
        Math.round((r.propertyTotalMinor ?? r.totalMinor) / party),
        nights,
      ),
      cancelled: g.cancelled,
    };
  });
}

export interface TouristTaxSummary {
  /** Nights actually provided in the month — cancelled registrations are not nights. */
  monthNights: number;
  monthTaxMinor: number;
  monthDueDate: string;
  /** The calendar year to date: what чл. 61с ал. 4 will be measured against. */
  yearNights: number;
  yearTaxMinor: number;
  floorMinor: number;
  topUpMinor: number;
  clearsFloor: boolean;
  declarationDueDate: string;
  topUpDueDate: string;
  /** Null until the property states them — every figure above is zero without both. */
  rateMinor: number | null;
  beds: number | null;
  suggestedBeds: number;
}

/**
 * The month's tourist tax and the year's floor — ЗМДТ чл. 61с.
 *
 * Counted off the REGISTER, not off the folios, because that is what the municipality assesses on:
 * чл. 61с ал. 2 has the officer compute the month from ЕСТИ data. Billing a guest for a city-tax
 * fee and registering them are different acts, and a register that disagrees with the folio is a
 * discrepancy the hotel needs to see rather than one we should paper over by counting the easier one.
 */
export async function getTouristTax(
  propertyId: string,
  timezone: string,
  monthIso: string,
): Promise<TouristTaxSummary> {
  const year = Number(monthIso.slice(0, 4));
  const [defaults, roomTypes] = await Promise.all([
    prisma.propertyDefaults.findUnique({
      where: { propertyId },
      select: { touristTaxRateMinor: true, touristTaxBeds: true },
    }),
    prisma.roomType.findMany({ where: { propertyId, active: true }, select: { maxGuests: true, totalRooms: true } }),
  ]);

  const rateMinor = defaults?.touristTaxRateMinor ?? null;
  const suggestedBeds = estimateBeds(roomTypes);
  const beds = defaults?.touristTaxBeds ?? null;

  /*
   * Ranged WIDE and then apportioned, rather than ranged by registration date.
   *
   * чл. 61с ал. 2 taxes the nights PROVIDED in the month. Those are not the nights of the entries
   * registered in it: a guest registered in August for nights slept in June belongs on June's
   * return, and a stay from 30 August to 2 September owes two nights to August and one to
   * September. Reading the register by registration date and summing whole stays — which is what
   * this did first — put a June holiday on the August return.
   *
   * So the query covers a year either side of the month and every stay is apportioned by the dates
   * it actually covered. `nightsInMonth` is exact and additive: what a stay contributes across the
   * months it touches sums to the stay.
   */
  const wideFrom = `${year - 1}-01-01`;
  const wideTo = `${year + 1}-12-31`;
  const all = await getRegisterEntries(propertyId, timezone, wideFrom, wideTo);
  const live = all.filter((e) => !e.cancelled);

  const monthNights = live.reduce((n, e) => n + nightsInMonth(e.arrivalDate, e.departureDate, monthIso), 0);
  const yearNights = live.reduce(
    (n, e) => n + MONTHS.reduce((m, mm) => m + nightsInMonth(e.arrivalDate, e.departureDate, `${year}-${mm}`), 0),
    0,
  );
  const yearTaxMinor = monthlyTouristTax(yearNights, rateMinor ?? 0);
  const floor = annualTouristTaxFloor({ year, beds: beds ?? 0, rateMinor: rateMinor ?? 0, paidMinor: yearTaxMinor });

  return {
    monthNights,
    monthTaxMinor: monthlyTouristTax(monthNights, rateMinor ?? 0),
    monthDueDate: monthlyTaxDueDate(monthIso),
    yearNights,
    yearTaxMinor,
    floorMinor: floor.floorMinor,
    topUpMinor: floor.topUpMinor,
    clearsFloor: floor.clearsFloor,
    declarationDueDate: annualDeclarationDueDate(year),
    topUpDueDate: annualTopUpDueDate(year),
    rateMinor, beds, suggestedBeds,
  };
}

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;
