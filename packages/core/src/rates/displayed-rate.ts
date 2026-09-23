import { effectiveModel, effectivePrimary, type OccupancyOption } from "./occupancy-options.js";
import { resolveRate, type PriceLookup, type ResolvablePlan } from "./resolve-rate.js";

/**
 * A rate plan row as `resolveRate` wants it — mapped ONCE.
 *
 * There were five of these: the Channex push, the booking engine, the RevioCRS calendar and two in
 * the occupancy settings, each a hand copy of the same twenty lines. Their comments said why that
 * mattered ("two adapters would be two chances for the push and the quote to read the same row
 * differently") while being the second and third adapter. Structural input, so a Prisma row with
 * `occupancyOptions` included passes straight in and nothing here imports the database.
 */
export interface PlanRow {
  id: string;
  pricingModel: string | null;
  primaryOccupancy: number | null;
  parentRatePlanId: string | null;
  priceLogic: string;
  derivedType: string | null;
  derivedDirection: string | null;
  derivedValue: number | null;
  derivedRounding: string | null;
  derivedFloorMinor: number | null;
  derivedCeilingMinor: number | null;
  occupancyOptions?: {
    occupancy: number; isPrimary: boolean; mode: string; rateMinor: number | null;
    adjustmentType: string | null; direction: string | null; value: number | null; rounding: string;
  }[];
}

export function toResolvablePlan(rp: PlanRow): ResolvablePlan {
  return {
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
    options: (rp.occupancyOptions ?? []).map((o): OccupancyOption => ({
      occupancy: o.occupancy,
      isPrimary: o.isPrimary,
      mode: o.mode === "derived" ? "derived" : "manual",
      rateMinor: o.rateMinor,
      adjustmentType: o.adjustmentType as "percent" | "fixed" | null,
      direction: o.direction as "increase" | "decrease" | null,
      value: o.value,
      rounding: o.rounding as never,
    })),
  };
}

/**
 * Where the number in a calendar price cell came from.
 *
 *   * `set`     — somebody priced this night on this plan. The only kind that is an override.
 *   * `derived` — follows its parent plan through the plan's adjustment.
 *   * `default` — nobody priced this night; it sells at the plan's own default rate.
 *   * `none`    — the plan cannot price it at all. The ONLY case that is really "no price".
 */
export type RateSource = "set" | "derived" | "default" | "none";

export interface DisplayedRate {
  minor: number | null;
  source: RateSource;
}

/**
 * The headline price a calendar shows for one plan, one room, one night — and why.
 *
 * ## The fault this replaces
 *
 * Both calendars read `RatePrice` rows directly and rendered "—" when none was stored. The push to
 * Channex resolves through `resolveRate`, which falls back to the plan's own default rate. So a
 * night nobody had priced showed "—" in RevioLink while Booking.com was selling it at €120: the
 * screen said "no price" about a room on sale. A hotelier who reads "—" either thinks the room is
 * not sellable, or types a price over a default they did not know existed.
 *
 * The number is `resolveRate`'s — the same call the push, the booking engine and the folio make —
 * at the occupancy the push sends for this plan: the ceiling for a per-room plan, the primary for
 * a per-person one. `source` is only the explanation beside it.
 */
export function displayedRate(input: {
  lookup: PriceLookup;
  plans: ReadonlyMap<string, ResolvablePlan>;
  plan: ResolvablePlan;
  roomTypeId: string;
  maxOccupancy: number;
  roomDefaultOccupancy: number | null;
  propertyModel: string;
  dateKey: string;
}): DisplayedRate {
  const ceiling = Math.max(1, input.maxOccupancy);
  const model = effectiveModel(input.plan.pricingModel, input.propertyModel);
  const occupancy = model === "per_room"
    ? ceiling
    : effectivePrimary(input.plan.primaryOccupancy, input.roomDefaultOccupancy, ceiling);

  const minor = resolveRate({
    lookup: input.lookup, plans: input.plans, roomTypeId: input.roomTypeId,
    maxOccupancy: ceiling, roomDefaultOccupancy: input.roomDefaultOccupancy,
    propertyModel: input.propertyModel, plan: input.plan, dateKey: input.dateKey, occupancy,
  });
  if (minor == null) return { minor: null, source: "none" };
  // Same precedence `resolveRate` applies: a stored row for exactly this cell wins everything.
  if (input.lookup(input.roomTypeId, input.plan.id, input.dateKey, occupancy) != null) return { minor, source: "set" };
  if (input.plan.parentRatePlanId && input.plan.priceLogic === "derived") return { minor, source: "derived" };
  return { minor, source: "default" };
}

/** The hover text for a cell whose price nobody set on that night. `null` for one that was. */
export function rateSourceNote(source: RateSource, planName: string, parentName?: string): string | null {
  switch (source) {
    case "default":
      return `No price set for this night — it sells at ${planName}'s default rate, and that is what the channels are sent. Type a price to override it.`;
    case "derived":
      return `Follows ${parentName ?? "its parent plan"} — change the parent's price and this moves with it.`;
    case "none":
      return `${planName} has no price for this night and no default rate, so it cannot be sold. Set a price, or a default rate in Rooms & Rates.`;
    default:
      return null;
  }
}
