import "server-only";
import { nightsToReprice, resolveRate, effectivePrimary, type PriceLookup, type ResolvablePlan } from "@revio/core";
import type { TenantTx } from "@revio/db";

/**
 * Re-resolving a stay's nightly rates after a REAL change — PMS OBP §P6 / §P7 (K4).
 *
 * ## What counts as real
 *
 * The occupancy changed, or the guest moved to a different room type. Nothing else. A rate table
 * edited last Tuesday is not a reason to reprice a stay that was confirmed a month ago — that is the
 * whole point of the snapshot (§P4), and re-resolving on a schedule or on every folio render would
 * quietly undo it.
 *
 * ## Forward only
 *
 * A guest who adds a second person on Thursday does not owe the double rate for Monday. Those nights
 * were slept at one occupancy and have very likely been posted; repricing them is rewriting history,
 * and on a folio the guest has already seen it is a charge that appeared from nowhere.
 *
 * ## Inside the caller's transaction
 *
 * Takes a `tx`, never a client of its own. The occupancy change and the repricing commit together or
 * not at all — a move that lands with the old rates is a folio that bills the wrong room type, and
 * one that reprices without moving is worse.
 */

export type RepriceReason = "occupancy_change" | "room_move";

export interface RepriceInput {
  tx: TenantTx;
  tenantId: string;
  reservationLineId: string;
  roomTypeId: string;
  ratePlanId: string;
  maxOccupancy: number;
  roomDefaultOccupancy: number | null;
  propertyModel: string;
  /** The plan, and every plan it might derive from. */
  plans: Map<string, ResolvablePlan>;
  /** The party size from this change forward. */
  occupancy: number;
  /** Nights on or after this date are repriced; earlier ones are left exactly as they are. */
  fromDate: string;
  reason: RepriceReason;
}

export interface RepriceResult {
  repriced: number;
  /** Nights the new shape cannot price — reported, never written as zero. */
  unpriceable: string[];
}

export async function repriceStay(input: RepriceInput): Promise<RepriceResult> {
  const { tx } = input;

  const existing = await tx.reservationNightRate.findMany({
    where: { reservationLineId: input.reservationLineId },
    orderBy: { date: "asc" },
  });
  if (existing.length === 0) return { repriced: 0, unpriceable: [] };

  const keys = existing.map((n) => ({ date: n.date.toISOString().slice(0, 10) }));
  const targets = new Set(nightsToReprice(keys, input.fromDate));
  if (targets.size === 0) return { repriced: 0, unpriceable: [] };

  // Prices for the window, read once.
  const stored = await tx.ratePrice.findMany({
    where: {
      roomTypeId: input.roomTypeId,
      date: { in: existing.filter((n) => targets.has(n.date.toISOString().slice(0, 10))).map((n) => n.date) },
    },
    select: { roomTypeId: true, ratePlanId: true, date: true, occupancy: true, priceMinor: true },
  });
  const priceMap = new Map(
    stored.map((r) => [`${r.roomTypeId}:${r.ratePlanId}:${r.date.toISOString().slice(0, 10)}:${r.occupancy ?? ""}`, r.priceMinor]),
  );
  const lookup: PriceLookup = (rt, rp, k, occ) => priceMap.get(`${rt}:${rp}:${k}:${occ}`) ?? null;

  const plan = input.plans.get(input.ratePlanId);
  if (!plan) return { repriced: 0, unpriceable: [] };

  const occupancy = Math.min(Math.max(1, input.occupancy), Math.max(1, input.maxOccupancy));
  const unpriceable: string[] = [];
  let repriced = 0;

  for (const night of existing) {
    const dateKey = night.date.toISOString().slice(0, 10);
    if (!targets.has(dateKey)) continue;

    const minor = resolveRate({
      lookup, plans: input.plans, roomTypeId: input.roomTypeId,
      maxOccupancy: input.maxOccupancy, roomDefaultOccupancy: input.roomDefaultOccupancy,
      propertyModel: input.propertyModel, plan, dateKey, occupancy,
    });

    if (minor == null) {
      /*
       * The new shape cannot price this night — a move into a room type with no rate for that party
       * size, say. The OLD rate is kept rather than zeroed: the guest is still staying, and a night
       * that silently becomes free is worse than one that is briefly wrong. Reported so somebody
       * fixes it.
       */
      unpriceable.push(dateKey);
      continue;
    }

    await tx.reservationNightRate.update({
      where: { id: night.id },
      data: { occupancy, rateMinor: minor, source: input.reason },
    });
    repriced++;
  }

  return { repriced, unpriceable };
}

/** The primary occupancy for a room, when a change does not state one. */
export function primaryFor(plan: ResolvablePlan | undefined, roomDefault: number | null, maxOccupancy: number): number {
  return effectivePrimary(plan?.primaryOccupancy ?? null, roomDefault, maxOccupancy);
}
