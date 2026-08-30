import { deriveRate, type DerivedRateConfig } from "./derive.js";
import { effectiveModel, effectivePrimary, optionPrice, type OccupancyOption } from "./occupancy-options.js";

/**
 * The price for a room type, on a rate plan, on a date, at a party size — CRS §6.6.
 *
 * ## Why this is one function and not five
 *
 * The spec's warning is the reason: *"every surface that quotes, displays, syncs, or bills a rate
 * must become occupancy-aware. One per-room surface left behind produces the classic parity failure
 * — guest sees one price on the booking engine, the OTA shows another, the folio bills a third."*
 *
 * The booking engine, the CRS availability search, the Channex push and the PMS folio must all
 * arrive at the same number for the same inputs. The only way to guarantee that is for them to run
 * the same code, so this takes a lookup function rather than a database handle and lives in core
 * where all four can reach it.
 *
 * ## The two axes, resolved in the right order
 *
 * A plan can derive from a parent plan (axis 1) and, independently, price by occupancy (axis 2).
 * Both together is `cascade`. The order matters and is not interchangeable:
 *
 *   parent + per-person  → take the PARENT'S PRICE AT THIS OCCUPANCY, then apply the plan's
 *                          discount. "Non-Refundable for 1 guest" is "Standard for 1 guest minus
 *                          20%", not "Standard for 2 guests minus 20% minus the single-guest
 *                          offset" — which is what deriving twice would give, and it is a different
 *                          number.
 *   parent + per-room    → the parent's single price, then the plan's discount.
 *   no parent            → the stored price, or the occupancy rule applied to the primary.
 *
 * ## An explicit price always wins
 *
 * A stored price for exactly this (room, plan, date, occupancy) is a human decision about a specific
 * night. It outranks every rule, in both axes. That is what makes a calendar override an override.
 */

/** Look up a STORED price. Null when nothing is stored for that exact combination. */
export type PriceLookup = (
  roomTypeId: string,
  ratePlanId: string,
  dateKey: string,
  occupancy: number,
) => number | null | undefined;

export interface ResolvablePlan {
  id: string;
  /** Null inherits the property model. */
  pricingModel?: string | null;
  primaryOccupancy?: number | null;
  parentRatePlanId?: string | null;
  priceLogic?: string | null;
  derivedType?: string | null;
  derivedDirection?: string | null;
  derivedValue?: number | null;
  derivedRounding?: string | null;
  derivedFloorMinor?: number | null;
  derivedCeilingMinor?: number | null;
  /** The plan's occupancy rows. Empty is treated as per-room at the ceiling. */
  options?: OccupancyOption[];
}

export interface ResolveInput {
  lookup: PriceLookup;
  plans: ReadonlyMap<string, ResolvablePlan>;
  roomTypeId: string;
  maxOccupancy: number;
  roomDefaultOccupancy?: number | null;
  propertyModel: string;
  plan: ResolvablePlan;
  dateKey: string;
  /** Party size. Clamped to the room's ceiling — a request for more than fits is not a price. */
  occupancy: number;
}

/**
 * Resolve one night's price. `null` means "this plan cannot price that party size", which is a real
 * answer and must not be rendered as zero.
 */
export function resolveRate(input: ResolveInput): number | null {
  return resolveInner(input, new Set());
}

function resolveInner(input: ResolveInput, seen: Set<string>): number | null {
  const { plan, lookup, roomTypeId, dateKey } = input;

  // A derivation cycle would recurse until the stack gives out. The schema forbids one; a database
  // is not a place to assume that.
  if (seen.has(plan.id)) return null;
  seen.add(plan.id);

  const model = effectiveModel(plan.pricingModel, input.propertyModel);
  const primary = effectivePrimary(plan.primaryOccupancy, input.roomDefaultOccupancy, input.maxOccupancy);
  const options = plan.options ?? [];

  /*
   * Per-room prices the room, whatever the party size — as long as they fit.
   *
   * The row is at the CEILING, not at `primary`. A per-room plan has exactly one option and the spec
   * puts it at max occupancy; `defaultOccupancy` says which occupancy is PRIMARY for a per-person
   * plan and has no bearing on where a per-room row lives. A test caught these disagreeing, which
   * would have read a stored per-room override as missing and silently fallen back to the plan's
   * default price.
   */
  const wanted = model === "per_room" ? input.maxOccupancy : input.occupancy;
  if (wanted < 1 || wanted > input.maxOccupancy) return null;

  // 1. An explicit stored price outranks every rule, in both axes.
  const stored = lookup(roomTypeId, plan.id, dateKey, wanted);
  if (stored != null) return stored;

  // 2. Derived from a parent plan.
  const parentId = plan.parentRatePlanId;
  if (parentId && plan.priceLogic === "derived") {
    const parent = input.plans.get(parentId);
    if (!parent) return null;
    // cascade: the parent's price AT THIS OCCUPANCY, then this plan's adjustment. Deriving from the
    // parent's PRIMARY and then applying the occupancy offset again would apply two discounts.
    const parentAt = model === "per_person" ? wanted : primary;
    const parentMinor = resolveInner({ ...input, plan: parent, occupancy: parentAt }, seen);
    if (parentMinor == null) return null;
    return deriveRate(parentMinor, planDerivation(plan, parentId));
  }

  // 3. Own price: the occupancy rule applied to the primary, or the option's stated rate.
  if (options.length === 0) return null;

  const primaryMinor =
    lookup(roomTypeId, plan.id, dateKey, primary) ??
    options.find((o) => o.isPrimary)?.rateMinor ??
    null;
  if (primaryMinor == null) return null;
  if (wanted === primary) return primaryMinor;

  return optionPrice(options, wanted, primaryMinor);
}

function planDerivation(plan: ResolvablePlan, parentRatePlanId: string): DerivedRateConfig {
  return {
    parentRatePlanId,
    adjustmentType: (plan.derivedType as "percent" | "fixed") ?? "percent",
    direction: (plan.derivedDirection as "increase" | "decrease") ?? "decrease",
    value: plan.derivedValue ?? 0,
    rounding: (plan.derivedRounding as DerivedRateConfig["rounding"]) ?? "none",
    ...(plan.derivedFloorMinor != null ? { floorMinor: plan.derivedFloorMinor } : {}),
    ...(plan.derivedCeilingMinor != null ? { ceilingMinor: plan.derivedCeilingMinor } : {}),
  };
}

/**
 * Every night of a stay, at one party size.
 *
 * Returns null for the WHOLE stay if any single night cannot be priced. A stay quoted with one night
 * missing is not a cheaper stay, it is a wrong total — and the guest is charged the difference at
 * the desk.
 */
export function resolveStay(
  input: Omit<ResolveInput, "dateKey">,
  dateKeys: readonly string[],
): { totalMinor: number; nights: { date: string; minor: number }[] } | null {
  const nights: { date: string; minor: number }[] = [];
  let totalMinor = 0;
  for (const dateKey of dateKeys) {
    const minor = resolveRate({ ...input, dateKey });
    if (minor == null) return null;
    nights.push({ date: dateKey, minor });
    totalMinor += minor;
  }
  return { totalMinor, nights };
}
