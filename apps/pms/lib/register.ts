import { claimRegisterNo, withTenantTransaction } from "@revio/db";
import { prisma } from "./db";

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
            // Only the booker's name is known at this point. The rest arrive as blanks the register
            // card asks for — an empty name reads as "not captured", which is true.
            fullName: first ? input.leadGuestName : "",
            unitLabel: spec.unitLabel,
            floor: spec.floor,
          },
        });
        first = false;
      }
    }
  });
}
