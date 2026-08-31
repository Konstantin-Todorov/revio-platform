import "server-only";
import { assessMove, type MoveNight, type MoveAssessment } from "@revio/core";
import { prisma } from "./db";
import { ymd, utcDay } from "./format";

/**
 * What does this cross-type move cost, and who decides? (§2.5)
 *
 * A guest moved from a Standard into a Deluxe is being given something they did not buy. That is a
 * money event, and the spec is emphatic that a human classifies it — comp it, charge it, or set an
 * amount — rather than the system posting a difference nobody chose.
 *
 * This reads the two prices and hands `assessMove` the nights; the maths and the option set live in
 * `@revio/core`, tested, because "which resolutions are offered" is a rule and not a rendering
 * detail — offering "refund" on an upgrade is how a tired receptionist at 23:00 gets it backwards.
 *
 * The PMS reads CRS rates in EXACTLY this one place. A calendar or a folio that showed prices would
 * be a second rate screen drifting from the first; a move that ignored them would ask a manager to
 * price an upgrade from memory.
 */
export async function assessMoveForReservation(reservationId: string): Promise<
  | (MoveAssessment & {
      currency: string;
      bookedRoomTypeName: string;
      accommodatedRoomTypeName: string;
      unitLabel: string;
    })
  | null
> {
  const assignment = await prisma.roomAssignment.findFirst({
    where: { reservationId, status: "active", checkedOutAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      unit: { select: { label: true, roomTypeId: true, roomType: { select: { name: true } } } },
      line: {
        select: {
          roomTypeId: true, checkIn: true, checkOut: true, priceMinor: true,
          // The party size the stay is priced at — a move's difference must be computed against it.
          guestsCount: true,
          ratePlanId: true, roomType: { select: { name: true } },
        },
      },
      reservation: { select: { currency: true, departedAt: true } },
    },
  });
  if (!assignment || assignment.reservation.departedAt) return null;

  const line = assignment.line;
  // Same type — nothing was sold differently, so there is nothing to reconcile.
  if (assignment.unit.roomTypeId === line.roomTypeId) return null;

  const nights: string[] = [];
  for (let d = new Date(line.checkIn); d < line.checkOut; d = new Date(d.getTime() + 86_400_000)) {
    nights.push(ymd(d));
  }
  if (nights.length === 0) return null;

  // What the destination type costs, on the SAME rate plan the guest booked. A move does not change
  // which rate plan they are on — the spec is explicit that the reservation keeps its original plan,
  // and pricing the new room on a different one would quietly re-sell the stay.
  /*
   * ⚠️ Occupancy-filtered. Keyed by date alone below, which OBP made ambiguous: a per-person room
   * has a row per guest count and the map would keep an arbitrary one, so the difference quoted for
   * a move could be computed against the wrong party size.
   *
   * The stay's own occupancy, falling back to the destination room's ceiling.
   */
  const destRoom = await prisma.roomType.findUnique({
    where: { id: assignment.unit.roomTypeId }, select: { maxGuests: true },
  });
  const moveOccupancy = line.guestsCount ?? destRoom?.maxGuests ?? 1;
  const destPrices = await prisma.ratePrice.findMany({
    where: {
      roomTypeId: assignment.unit.roomTypeId,
      ratePlanId: line.ratePlanId,
      occupancy: moveOccupancy,
      date: { gte: utcDay(nights[0]!), lte: utcDay(nights[nights.length - 1]!) },
    },
    select: { date: true, priceMinor: true },
  });
  const destByDate = new Map(destPrices.map((p) => [ymd(p.date), p.priceMinor]));

  // The booked price per night, from what the guest is actually being charged rather than from the
  // rate table — the rate may have moved since they booked, and the difference must be measured
  // against their bill, not against today's list price.
  const bookedPerNight = Math.round((line.priceMinor ?? 0) / nights.length);

  const stayNights: MoveNight[] = nights.map((date) => ({
    date,
    bookedMinor: bookedPerNight,
    // No rate loaded for a night means we cannot price it, and guessing would put a number in front
    // of a manager that nothing stands behind. Treating it as equal to the booked price makes that
    // night contribute zero rather than a fiction.
    destinationMinor: destByDate.get(date) ?? bookedPerNight,
  }));

  // The move takes effect from today when the stay is under way, and from arrival when it is not:
  // nights already slept were in the old room and were correctly charged for it.
  const today = ymd(new Date());
  const effectiveFrom = today > nights[0]! ? today : nights[0]!;

  const assessment = assessMove({
    bookedRoomTypeId: line.roomTypeId,
    destinationRoomTypeId: assignment.unit.roomTypeId,
    stayNights,
    effectiveFrom,
  });

  return {
    ...assessment,
    currency: assignment.reservation.currency ?? "EUR",
    bookedRoomTypeName: line.roomType.name,
    accommodatedRoomTypeName: assignment.unit.roomType.name,
    unitLabel: assignment.unit.label,
  };
}
