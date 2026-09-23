import { withTenantTransaction, type forTenant } from "@revio/db";

/**
 * A staff member confirms a hold, and the hold becomes a reservation.
 *
 * Extracted from `confirmReservation` so the part that must be exactly-once can be raced by a
 * harness rather than argued about. It takes the client as a parameter and imports nothing from
 * Next, which is what lets `scripts/crs-confirm-race.ts` call the same code the action calls.
 */
export type TenantDb = ReturnType<typeof forTenant>;

/**
 * Somebody else converted this hold first — another member of staff, a second tab, a retry.
 * Thrown inside the transaction, so the reservation this call had already written is rolled back.
 */
export class HoldAlreadyTaken extends Error {
  constructor() {
    super("This hold has just been confirmed by somebody else.");
    this.name = "HoldAlreadyTaken";
  }
}

export interface ConvertHoldProperty {
  id: string;
  tenantId: string;
  baseCurrency: string;
}

export interface HeldStay {
  id: string;
  roomTypeId: string;
  quantity: number;
  checkIn: Date;
  checkOut: Date;
}

export interface ConvertHoldInput {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  specialRequests: string | null;
  notes: string | null;
  ratePlanId: string;
  bookingSourceId: string | null;
  paymentGuarantee: string;
  priceMinor: number;
  guestsCount: number;
  createdById: string | null;
}

/*
 * ⚠️ EXACTLY ONCE, and it was not until 2026-09-23.
 *
 * Twelve concurrent confirms of one hold produced TWELVE reservations — measured by
 * `scripts/crs-confirm-race.ts` against this function before the fix. The staff path read the hold
 * as active, wrote the reservation, and then converted the hold with an UNCONDITIONAL update,
 * outside any transaction. Every racer read "active", every racer wrote a reservation, and every
 * conversion succeeded because it asked nothing about the hold's state. One room, twelve bookings.
 *
 * The guest's booking page had exactly this defect, found it, fixed it and wrote the fix down in
 * `packages/booking/src/public-engine.ts`. This is the same fix, applied to the path it was not:
 *
 *   - The conversion IS the claim: `UPDATE … WHERE status = 'active'` takes the row lock, the loser
 *     waits, re-reads the committed row, sees `converted`, and matches nothing.
 *   - It runs in the SAME transaction as the reservation, so `count !== 1` rolls back the
 *     reservation this call already wrote. Without the transaction the loser would be refused and
 *     leave its reservation behind.
 *   - No intermediate "claiming" status. Both places that count a hold against inventory require
 *     `status = 'active'`, so flipping it early would RELEASE the room for the width of the window.
 */
export async function convertHoldToReservation(
  property: ConvertHoldProperty,
  hold: HeldStay,
  input: ConvertHoldInput,
): Promise<{ reservationId: string; guestName: string }> {
  return withTenantTransaction(property.tenantId, async (db) => {
  // Guest record: reuse by e-mail when one exists (booking history accumulates), else create.
  const existing = input.email ? await db.guest.findFirst({ where: { propertyId: property.id, email: input.email } }) : null;
  const guest =
    existing ??
    (await db.guest.create({
      data: {
        tenantId: property.tenantId,
        propertyId: property.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        company: input.company,
        specialRequests: input.specialRequests,
      },
    }));
  if (existing && input.specialRequests) {
    await db.guest.update({ where: { id: existing.id }, data: { specialRequests: input.specialRequests } });
  }

  const guestName = `${input.firstName} ${input.lastName}`;
  const reservation = await db.reservation.create({
    data: {
      tenantId: property.tenantId,
      propertyId: property.id,
      channelId: null,
      externalId: null,
      guestName,
      status: "confirmed",
      totalMinor: input.priceMinor,
      currency: property.baseCurrency,
      propertyCurrency: property.baseCurrency,
      propertyTotalMinor: input.priceMinor,
      fxRate: 1,
      fxAt: new Date(),
      guestId: guest.id,
      bookingSourceId: input.bookingSourceId,
      paymentGuarantee: input.paymentGuarantee,
      notes: input.notes,
      createdById: input.createdById,
      lines: {
        create: [{
          roomTypeId: hold.roomTypeId,
          ratePlanId: input.ratePlanId,
          quantity: hold.quantity,
          checkIn: hold.checkIn,
          checkOut: hold.checkOut,
          priceMinor: input.priceMinor,
          guestsCount: input.guestsCount,
        }],
      },
    },
  });
  const converted = await db.hold.updateMany({
    where: { id: hold.id, propertyId: property.id, status: "active" },
    data: { status: "converted", reservationId: reservation.id },
  });
  if (converted.count !== 1) throw new HoldAlreadyTaken();
  return { reservationId: reservation.id, guestName };
  });
}
