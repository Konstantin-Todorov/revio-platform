import "server-only";
import { forSystem } from "@revio/db";
import { SOLD_STATUSES } from "@revio/core";
import { BOOKING_ENGINE_SOURCE_NAME, periodRange } from "./pricing";

export { periodRange };

const prisma = forSystem();

/**
 * What RevioDirect actually produced, per client, in a period.
 *
 * ## Why this is one function and not two queries
 *
 * The Overview's usage panel and the invoice must agree to the cent. They did not: the panel computed
 * direct revenue and showed a 2% fee beside it, while `generateInvoices` billed
 * `monthlyPriceMinor(plan, entitlements)` and nothing else — the console displayed a fee it never
 * charged. Two definitions of "a booking our engine produced" would have been the next bug even
 * after that was fixed, so there is one.
 *
 * ## What counts, and why
 *
 * - **`bookingSource = Booking Engine`.** The 2% is charged on bookings *our engine produced*, never
 *   on the hotel's own phone reservations. That is the promise on the pricing page and it is the
 *   whole reason the fee is defensible against an OTA's 15%.
 * - **`SOLD_STATUSES` only.** A cancelled booking earned the hotel nothing, so it earns us nothing.
 * - **Dated by `importedAt`** — when the booking was *made*, not when the guest stays. A booking made
 *   in March for August is March's usage; billing it in August would invoice a hotel for work done
 *   five months earlier and make every month's figure impossible to reconcile.
 */
export interface DirectUsage {
  revenueMinor: number;
  bookings: number;
}

/** `[from, to)` — the second bound is exclusive, so month boundaries cannot double-count. */
export async function directUsageByTenant(from: Date, to: Date): Promise<Map<string, DirectUsage>> {
  const lines = await prisma.reservationLine.findMany({
    where: {
      reservation: {
        importedAt: { gte: from, lt: to },
        status: { in: [...SOLD_STATUSES] },
        bookingSource: { name: BOOKING_ENGINE_SOURCE_NAME },
      },
    },
    select: { priceMinor: true, reservation: { select: { id: true, tenantId: true } } },
  });

  const byTenant = new Map<string, { revenueMinor: number; reservations: Set<string> }>();
  for (const l of lines) {
    const t = l.reservation.tenantId;
    const e = byTenant.get(t) ?? { revenueMinor: 0, reservations: new Set<string>() };
    e.revenueMinor += l.priceMinor ?? 0;
    // A stay can have several lines; the hotel made ONE booking.
    e.reservations.add(l.reservation.id);
    byTenant.set(t, e);
  }

  return new Map(
    [...byTenant].map(([t, e]) => [t, { revenueMinor: e.revenueMinor, bookings: e.reservations.size }]),
  );
}
