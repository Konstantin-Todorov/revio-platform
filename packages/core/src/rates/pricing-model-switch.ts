import {
  expandToPerPerson, collapseToPerRoom, effectivePrimary, MAX_OCCUPANCY,
  type OccupancyOption, type PricingModel, type SeedMode,
} from "./occupancy-options.js";
import type { AdjustmentDirection, AdjustmentType } from "./derive.js";

/**
 * Switching a property (or one plan) between per-room and per-person — CRS §6.2.
 *
 * ## The promise this has to keep
 *
 * **No rate data is lost, in either direction.** That is what makes the toggle safe to put in front
 * of a hotelier at all. Going per-person keeps the price they were charging on the primary occupancy
 * and seeds the rest; coming back keeps the primary's price as the single room price. Somebody can
 * try it on a Tuesday and change their mind on a Wednesday.
 *
 * ## Why this is planned before it is applied
 *
 * A property toggle touches every plan on every room type at once. A hotel with 6 room types and 7
 * plans is 42 option sets, and half-applying that leaves some plans per-person and some per-room
 * with nothing saying which — a state no screen is designed to show and no push can resolve.
 *
 * So: this function DECIDES, purely, and returns the whole plan. The caller writes it in one
 * transaction, or not at all. It also means the preview a hotelier confirms is computed by the same
 * code that performs it, rather than by a second implementation that can disagree.
 *
 * Pure. No DB.
 */

export interface PlanToSwitch {
  ratePlanId: string;
  planName: string;
  /** Null inherits the property model — those are the plans a property toggle actually moves. */
  planModel: string | null;
  primaryOccupancy: number | null;
  /** Every room type this plan is sold on. A plan spanning rooms with different caps is normal. */
  roomTypes: { roomTypeId: string; maxOccupancy: number; defaultOccupancy: number | null }[];
  options: OccupancyOption[];
}

export interface SwitchInput {
  target: PricingModel;
  propertyModel: PricingModel;
  plans: readonly PlanToSwitch[];
  seed: SeedMode;
  seedRule?: { adjustmentType: AdjustmentType; direction: AdjustmentDirection; value: number };
}

export interface PlanSwitchResult {
  ratePlanId: string;
  planName: string;
  /** Unchanged plans are reported, not silently dropped — see `skipped`. */
  changed: boolean;
  /** Why nothing happened, in words, when it did not. */
  skipped?: string;
  before: number;
  after: number;
  options: OccupancyOption[];
  primaryOccupancy: number;
}

export interface SwitchPlan {
  results: PlanSwitchResult[];
  changedCount: number;
  /** True when there is nothing to do — the caller should say so rather than showing an empty diff. */
  noop: boolean;
}

/**
 * The occupancy ceiling for a plan sold across several room types.
 *
 * **The SMALLEST cap wins**, and this is the decision most worth arguing about. A plan on a 2-guest
 * Double and a 4-guest Family could carry four options and skip the top two for the Double — but
 * then the plan's own option set does not describe what it sells, and every consumer has to
 * re-derive the intersection. Taking the smallest keeps one option set that is valid everywhere the
 * plan is sold. A hotel that genuinely wants 4-guest pricing on the Family gives it its own plan,
 * which is what rate plans are for.
 *
 * The bulk editor takes the opposite approach on purpose (§6.4: render to the HIGHEST cap and skip
 * per room type) because it is editing a matrix across rooms, not defining a plan.
 */
export function planCeiling(rooms: readonly { maxOccupancy: number }[]): number {
  if (rooms.length === 0) return 1;
  return Math.min(MAX_OCCUPANCY, ...rooms.map((r) => Math.max(1, r.maxOccupancy)));
}

export function planPricingModelSwitch(input: SwitchInput): SwitchPlan {
  const results: PlanSwitchResult[] = [];

  for (const plan of input.plans) {
    const ceiling = planCeiling(plan.roomTypes);
    const roomDefault = plan.roomTypes[0]?.defaultOccupancy ?? null;
    const primary = effectivePrimary(plan.primaryOccupancy, roomDefault, ceiling);
    const before = plan.options.length;

    // A plan that has overridden the property model is left alone by a PROPERTY toggle. The override
    // is a deliberate statement — "this one is different" — and silently reverting it would undo a
    // decision somebody made on purpose.
    if (plan.planModel !== null && plan.planModel !== input.target) {
      results.push({
        ratePlanId: plan.ratePlanId, planName: plan.planName, changed: false,
        skipped: `Set to ${plan.planModel === "per_person" ? "per person" : "per room"} on its own — a property change does not override that.`,
        before, after: before, options: plan.options, primaryOccupancy: primary,
      });
      continue;
    }

    const next =
      input.target === "per_person"
        ? expandToPerPerson(plan.options, ceiling, primary, input.seed, input.seedRule)
        : collapseToPerRoom(
            plan.options, ceiling,
            plan.options.find((o) => o.isPrimary)?.rateMinor ?? plan.options[0]?.rateMinor ?? 0,
          );

    const unchanged = sameShape(plan.options, next);
    results.push({
      ratePlanId: plan.ratePlanId, planName: plan.planName,
      changed: !unchanged,
      ...(unchanged ? { skipped: "Already in this shape." } : {}),
      before, after: next.length, options: next, primaryOccupancy: primary,
    });
  }

  const changedCount = results.filter((r) => r.changed).length;
  return { results, changedCount, noop: changedCount === 0 };
}

function sameShape(a: readonly OccupancyOption[], b: readonly OccupancyOption[]): boolean {
  if (a.length !== b.length) return false;
  const key = (o: OccupancyOption) => `${o.occupancy}|${o.isPrimary}|${o.mode}|${o.rateMinor ?? ""}`;
  const as = [...a].map(key).sort();
  const bs = [...b].map(key).sort();
  return as.every((v, i) => v === bs[i]);
}

/** One sentence for the confirmation, computed from the same plan that will be applied. */
export function describeSwitch(plan: SwitchPlan, target: PricingModel): string {
  if (plan.noop) {
    return target === "per_person"
      ? "Every rate plan already prices per person — nothing to change."
      : "Every rate plan already prices per room — nothing to change.";
  }
  const n = plan.changedCount;
  const skipped = plan.results.filter((r) => !r.changed && r.skipped && r.skipped !== "Already in this shape.").length;
  const rows = plan.results.filter((r) => r.changed).reduce((s, r) => s + r.after - r.before, 0);

  const head =
    target === "per_person"
      ? `${n} rate plan${n === 1 ? "" : "s"} will price per person, adding ${rows} occupancy price${rows === 1 ? "" : "s"}.`
      : `${n} rate plan${n === 1 ? "" : "s"} will price per room, collapsing to one price each.`;

  // Said up front, because "no rate data is lost" is the thing a hotelier needs to believe before
  // they press the button — and it is true, so it should be claimed.
  const safety =
    target === "per_person"
      ? " Your current price stays on the primary occupancy."
      : " The primary occupancy's price becomes the room price.";
  const note = skipped > 0 ? ` ${skipped} plan${skipped === 1 ? " is" : "s are"} set on their own and will not change.` : "";
  return head + safety + note;
}
