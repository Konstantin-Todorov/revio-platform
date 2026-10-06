import type { forTenant } from "@revio/db";
import { computeStayCharges, extrasTotalMinor } from "@revio/core";

type Db = ReturnType<typeof forTenant>;

/**
 * What a STORED reservation costs the guest, all in: rooms, the extras they bought, and the hotel's
 * taxes and fees — rebuilt with the same `computeStayCharges` the quote and the folio use.
 *
 * The reservation stores accommodation only (room revenue is what ADR and RevPAR are built on), so
 * any mail or page that tells a guest "your total" must add the rest. RevioCRS's guest emails sent
 * the room-only figure as the total, which disagreed with the confirmation the guest already had.
 * One implementation, shared by every app that states a total, is what keeps them equal.
 */
export async function storedStayTotal(db: Db, reservationId: string): Promise<{ totalMinor: number; currency: string } | null> {
  const r = await db.reservation.findFirst({
    where: { id: reservationId },
    select: {
      propertyId: true, currency: true,
      lines: { select: { priceMinor: true, checkIn: true, checkOut: true, guestsCount: true, childrenCount: true, infantsCount: true, quantity: true } },
    },
  });
  if (!r || r.lines.length === 0) return null;
  const [fees, defaults, extras] = await Promise.all([
    db.taxFee.findMany({ where: { propertyId: r.propertyId, active: true } }),
    db.propertyDefaults.findFirst({ where: { propertyId: r.propertyId } }),
    db.stayExtra.findMany({ where: { reservationId, active: true }, select: { priceMinor: true, basis: true } }),
  ]);
  const nightsOf = (l: { checkIn: Date; checkOut: Date }) => Math.round((l.checkOut.getTime() - l.checkIn.getTime()) / 86_400_000);
  const nights = Math.max(...r.lines.map(nightsOf));
  const charged = computeStayCharges({
    stay: {
      accommodationMinor: r.lines.reduce((s, l) => s + (l.priceMinor ?? 0), 0),
      nights,
      rooms: r.lines.reduce((s, l) => s + (l.quantity ?? 1), 0),
      guests: r.lines.reduce((s, l) => s + (l.guestsCount ?? 2), 0),
      persons: r.lines.reduce((s, l) => s + (l.guestsCount ?? 2) + (l.childrenCount ?? 0) + (l.infantsCount ?? 0), 0),
    },
    fees: fees as never,
    cityTaxIncluded: defaults?.cityTaxMode === "included",
    extrasMinor: extrasTotalMinor(
      extras.map((e) => ({ priceMinor: e.priceMinor, basis: e.basis === "per_stay" ? "per_stay" as const : "per_night" as const })),
      nights,
    ),
  });
  return { totalMinor: charged.totalMinor, currency: r.currency };
}
