import { effectivePrimary, resolveStay, toResolvablePlan, type PriceLookup } from "@revio/core";
import type { forTenant } from "./rls.js";

type ScopedPrisma = ReturnType<typeof forTenant>;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Every night of a stay, `checkIn` inclusive, `checkOut` exclusive, as YYYY-MM-DD. */
function nightsOf(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${checkIn}T00:00:00Z`); t < Date.parse(`${checkOut}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * What a stay on one (room type, rate plan) costs — through `resolveStay`, the resolver the Channex
 * push, the booking engine and the folio use.
 *
 * Here rather than in an app because two callers needed it the day it was written: RevioCRS's
 * availability search and RevioLink's demo "Simulate booking". The CRS version read stored rows and
 * returned null for any night nobody had priced (while the channel sold it at the plan default); the
 * simulator's own copy turned the same night into a €0 booking. One definition, so neither can drift
 * from what the channels are told.
 *
 * `guests` is the whole party across `quantity` rooms; absent, the plan's headline occupancy is
 * used. Null means what the push means by it: this plan genuinely cannot price one of these nights.
 */
export async function quoteStay(
  db: ScopedPrisma,
  input: { roomTypeId: string; ratePlanId: string; checkIn: string; checkOut: string; quantity?: number; guests?: number },
): Promise<number | null> {
  const quantity = Math.max(1, input.quantity ?? 1);
  const nights = nightsOf(input.checkIn, input.checkOut);
  const room = await db.roomType.findUnique({
    where: { id: input.roomTypeId }, select: { propertyId: true, maxGuests: true, defaultOccupancy: true },
  });
  if (!room || nights.length === 0) return null;
  // Every plan of the property: a derived plan resolves through its parent chain.
  const [planRows, defaults, rows] = await Promise.all([
    db.ratePlan.findMany({ where: { propertyId: room.propertyId }, include: { occupancyOptions: true } }),
    db.propertyDefaults.findUnique({ where: { propertyId: room.propertyId }, select: { pricingModel: true } }),
    db.ratePrice.findMany({
      where: {
        roomTypeId: input.roomTypeId,
        date: { gte: new Date(`${input.checkIn}T00:00:00Z`), lt: new Date(`${input.checkOut}T00:00:00Z`) },
      },
      select: { ratePlanId: true, date: true, occupancy: true, priceMinor: true },
    }),
  ]);
  const plans = new Map(planRows.map((p) => [p.id, toResolvablePlan(p)]));
  const plan = plans.get(input.ratePlanId);
  if (!plan) return null;
  const stored = new Map(rows.map((r) => [`${r.ratePlanId}:${ymd(r.date)}:${r.occupancy ?? ""}`, r.priceMinor]));
  const lookup: PriceLookup = (_rt, rp, k, occ) => stored.get(`${rp}:${k}:${occ}`) ?? null;
  const ceiling = Math.max(1, room.maxGuests);
  const occupancy = input.guests && input.guests > 0
    ? Math.min(ceiling, Math.max(1, Math.ceil(input.guests / quantity)))
    : effectivePrimary(plan.primaryOccupancy, room.defaultOccupancy, ceiling);
  const stay = resolveStay({
    lookup, plans, roomTypeId: input.roomTypeId, maxOccupancy: ceiling, roomDefaultOccupancy: room.defaultOccupancy,
    propertyModel: defaults?.pricingModel ?? "per_room", plan, occupancy,
  }, nights);
  return stay ? stay.totalMinor * quantity : null;
}
