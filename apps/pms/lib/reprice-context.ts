import "server-only";
import type { ResolvablePlan } from "@revio/core";
import { prisma } from "./db";

/**
 * Everything `repriceStay` needs about a property's plans, read once.
 *
 * Separate from `reprice.ts` because that file is deliberately transaction-only — it takes a `tx`
 * and touches nothing else. This does the reading, outside the transaction, so the transaction stays
 * as short as it can be: it holds row locks for its whole life, and a rate-plan read is not something
 * that needs to be inside it.
 */
export async function repriceContext(propertyId: string): Promise<{
  plans: Map<string, ResolvablePlan>;
  propertyModel: string;
}> {
  const [plans, defaults] = await Promise.all([
    prisma.ratePlan.findMany({
      where: { propertyId },
      include: { occupancyOptions: true },
    }),
    prisma.propertyDefaults.findUnique({ where: { propertyId }, select: { pricingModel: true } }),
  ]);

  return {
    propertyModel: defaults?.pricingModel ?? "per_room",
    // Every plan, not only the one on the line: a derived plan resolves through its parent, and a
    // parent missing from the map makes the whole night unpriceable.
    plans: new Map(
      plans.map((rp) => [
        rp.id,
        {
          id: rp.id,
          pricingModel: rp.pricingModel,
          primaryOccupancy: rp.primaryOccupancy,
          parentRatePlanId: rp.parentRatePlanId,
          priceLogic: rp.priceLogic,
          derivedType: rp.derivedType,
          derivedDirection: rp.derivedDirection,
          derivedValue: rp.derivedValue,
          derivedRounding: rp.derivedRounding,
          derivedFloorMinor: rp.derivedFloorMinor,
          derivedCeilingMinor: rp.derivedCeilingMinor,
          options: rp.occupancyOptions.map((o) => ({
            occupancy: o.occupancy,
            isPrimary: o.isPrimary,
            mode: o.mode === "derived" ? ("derived" as const) : ("manual" as const),
            rateMinor: o.rateMinor,
            adjustmentType: o.adjustmentType as "percent" | "fixed" | null,
            direction: o.direction as "increase" | "decrease" | null,
            value: o.value,
            rounding: o.rounding as never,
          })),
        } satisfies ResolvablePlan,
      ]),
    ),
  };
}
