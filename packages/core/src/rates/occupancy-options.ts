import { applyRounding, type AdjustmentDirection, type AdjustmentType, type RoundingRule } from "./derive.js";

/**
 * Occupancy-based pricing — the option set under a rate plan (CRS §6.3).
 *
 * ## The one idea that makes this tractable
 *
 * **Per-room is not a second model. It is the one-row special case at max occupancy.**
 *
 * A per-room plan has exactly one option, at the room's ceiling, and it is primary. A per-person
 * plan has one option per occupancy from 1 to that ceiling. Both are the same shape, which is also
 * Channex's shape — so every reader asks for `(room, plan, date, occupancy)` without branching on
 * the model, and switching a plan between models is a row expand or collapse rather than a fork
 * through every query and every screen.
 *
 * ## The two derivation axes are orthogonal and must stay that way
 *
 * The spec names tangling them as the main failure mode, so it is worth stating plainly:
 *
 *   **plan → plan** — "Non-Refundable is Standard minus 20%". Lives on the rate plan
 *                     (`parentRatePlanId`, `derivedType`…), and predates OBP.
 *   **occupancy → occupancy** — "1 guest is 2 guests minus €20". Lives on the option, below.
 *
 * A plan can be either, both, or neither. When it is **both**, each occupancy derives from the
 * parent's *matching* occupancy — that is `rate_mode = cascade`, and it is the only combination
 * that needs a name.
 *
 * ## What restrictions do NOT get
 *
 * An occupancy dimension. Channex has no such dimension on min-stay, CTA, CTD or stop-sell, so they
 * attach to the **primary** occupancy and only to it. A UI that offers per-occupancy restrictions is
 * promising something the wire cannot carry.
 *
 * Pure. Rows in, decisions out.
 */

export type PricingModel = "per_room" | "per_person";
export type OccupancyMode = "manual" | "derived";
/** manual · derived (plan→plan) · cascade (both axes) · auto (channel-computed). */
export type RateMode = "manual" | "derived" | "cascade" | "auto";
export type SeedMode = "copy" | "derive";

/** Channex refuses beyond this, and no real room sleeps more. */
export const MAX_OCCUPANCY = 18;

export interface OccupancyOption {
  occupancy: number;
  isPrimary: boolean;
  mode: OccupancyMode;
  /** The plan-level price for this occupancy. Null on a derived row — it is computed. */
  rateMinor?: number | null;
  adjustmentType?: AdjustmentType | null;
  direction?: AdjustmentDirection | null;
  value?: number | null;
  rounding?: RoundingRule | null;
}

// --- Validation ------------------------------------------------------------
//
// The spec lists these as "enforce in UI and before every CM push", and the second half is the
// important one: an invalid option set does not fail at Channex, it is ACCEPTED and sells the wrong
// price. Gaps and duplicate primaries are exactly the shapes that survive a 200.

export type OptionProblem =
  | { kind: "no-primary" }
  | { kind: "many-primaries"; occupancies: number[] }
  | { kind: "per-room-extra-rows"; count: number }
  | { kind: "per-room-wrong-occupancy"; found: number; expected: number }
  | { kind: "gap"; missing: number[] }
  | { kind: "duplicate"; occupancy: number }
  | { kind: "above-ceiling"; occupancy: number; ceiling: number }
  | { kind: "below-one"; occupancy: number }
  | { kind: "derived-without-rule"; occupancy: number }
  | { kind: "primary-derived" };

export function validateOptions(
  options: readonly OccupancyOption[],
  model: PricingModel,
  maxOccupancy: number,
): OptionProblem[] {
  const problems: OptionProblem[] = [];
  const ceiling = Math.min(maxOccupancy, MAX_OCCUPANCY);

  const seen = new Set<number>();
  for (const o of options) {
    if (seen.has(o.occupancy)) problems.push({ kind: "duplicate", occupancy: o.occupancy });
    seen.add(o.occupancy);
    if (o.occupancy < 1) problems.push({ kind: "below-one", occupancy: o.occupancy });
    else if (o.occupancy > ceiling) problems.push({ kind: "above-ceiling", occupancy: o.occupancy, ceiling });
    // A derived row with no rule has no price at all — it is not "the base", it is nothing.
    if (o.mode === "derived" && o.adjustmentType == null) {
      problems.push({ kind: "derived-without-rule", occupancy: o.occupancy });
    }
  }

  const primaries = options.filter((o) => o.isPrimary);
  if (primaries.length === 0) problems.push({ kind: "no-primary" });
  if (primaries.length > 1) {
    problems.push({ kind: "many-primaries", occupancies: primaries.map((o) => o.occupancy) });
  }
  // The primary is what everything else derives FROM, so deriving it is a circular definition.
  if (primaries.length === 1 && primaries[0]!.mode === "derived") problems.push({ kind: "primary-derived" });

  if (model === "per_room") {
    if (options.length > 1) problems.push({ kind: "per-room-extra-rows", count: options.length });
    const only = options[0];
    if (only && only.occupancy !== ceiling) {
      problems.push({ kind: "per-room-wrong-occupancy", found: only.occupancy, expected: ceiling });
    }
  } else {
    // Contiguous 1…ceiling, no gaps. A missing occupancy is not "unavailable at that party size" —
    // it is a rate plan that cannot quote a perfectly ordinary booking.
    const missing: number[] = [];
    for (let n = 1; n <= ceiling; n++) if (!seen.has(n)) missing.push(n);
    if (missing.length > 0) problems.push({ kind: "gap", missing });
  }

  return problems;
}

/** One line a person can act on. The screens render these; the pushes refuse on them. */
export function describeProblem(p: OptionProblem): string {
  switch (p.kind) {
    case "no-primary":
      return "No primary occupancy is set. One occupancy must be primary — it is the rate shown by default and the one restrictions apply to.";
    case "many-primaries":
      return `More than one occupancy is marked primary (${p.occupancies.join(", ")}). Exactly one can be.`;
    case "per-room-extra-rows":
      return `A per-room plan has one price, but this has ${p.count}. Switch the plan to per-person, or remove the extra rows.`;
    case "per-room-wrong-occupancy":
      return `A per-room price covers the whole room, so it belongs at ${p.expected} guests, not ${p.found}.`;
    case "gap":
      return `No price for ${p.missing.length === 1 ? "" : "these guest counts: "}${p.missing.join(", ")}. A per-person plan needs one for every count up to the room's maximum, or it cannot quote that booking.`;
    case "duplicate":
      return `Two prices are set for ${p.occupancy} guests.`;
    case "above-ceiling":
      return `${p.occupancy} guests is more than this room sleeps (${p.ceiling}).`;
    case "below-one":
      return "A price cannot be set for fewer than one guest.";
    case "derived-without-rule":
      return `The price for ${p.occupancy} guests is set to be calculated, but no calculation is given.`;
    case "primary-derived":
      return "The primary occupancy cannot be calculated from itself — give it a price.";
  }
}

// --- Resolution ------------------------------------------------------------

/**
 * The price for one occupancy.
 *
 * A derived row is computed from the PRIMARY, never from the row below it. Chaining ("3 is 2 minus
 * ten, 2 is 1 minus ten") looks equivalent and is not: it compounds rounding at every step, and one
 * edited row silently shifts every row beneath it.
 */
export function optionPrice(
  options: readonly OccupancyOption[],
  occupancy: number,
  primaryMinor: number,
): number | null {
  const option = options.find((o) => o.occupancy === occupancy);
  if (!option) return null;
  if (option.isPrimary) return primaryMinor;
  if (option.mode === "manual") return option.rateMinor ?? null;
  if (option.adjustmentType == null || option.value == null) return null;

  const sign = option.direction === "increase" ? 1 : -1;
  const delta =
    option.adjustmentType === "percent"
      ? Math.round((primaryMinor * option.value) / 100)
      : option.value;
  // Never below zero. A 120% discount is a data-entry error, and a negative rate reaches an OTA as
  // one — `unsupportedReason` in the Channex mapper already refuses it, but not producing it is
  // better than being refused.
  return Math.max(0, applyRounding(primaryMinor + sign * delta, option.rounding ?? undefined));
}

/** Every occupancy priced, for a calendar row or a Channex `options[]` payload. */
export function priceAllOccupancies(
  options: readonly OccupancyOption[],
  primaryMinor: number,
): { occupancy: number; minor: number | null; isPrimary: boolean }[] {
  return [...options]
    .sort((a, b) => a.occupancy - b.occupancy)
    .map((o) => ({
      occupancy: o.occupancy,
      minor: optionPrice(options, o.occupancy, primaryMinor),
      isPrimary: o.isPrimary,
    }));
}

// --- Switching model -------------------------------------------------------

/**
 * Expand a per-room plan into per-person rows, or collapse it back.
 *
 * **No rate data is lost in either direction**, which is what makes the toggle safe to offer. Going
 * per-person keeps the existing price on the primary and seeds the rest; coming back keeps the
 * primary's price as the single row. A hotel can try it and change their mind.
 */
export function expandToPerPerson(
  current: readonly OccupancyOption[],
  maxOccupancy: number,
  primaryOccupancy: number,
  seed: SeedMode,
  seedRule?: { adjustmentType: AdjustmentType; direction: AdjustmentDirection; value: number },
): OccupancyOption[] {
  const ceiling = Math.min(maxOccupancy, MAX_OCCUPANCY);
  const primary = Math.min(Math.max(1, primaryOccupancy), ceiling);
  const existing = new Map(current.map((o) => [o.occupancy, o]));
  // The price that survives the switch: whatever the plan charged before.
  const carried = current.find((o) => o.isPrimary)?.rateMinor ?? current[0]?.rateMinor ?? null;

  const out: OccupancyOption[] = [];
  for (let n = 1; n <= ceiling; n++) {
    if (n === primary) {
      out.push({ occupancy: n, isPrimary: true, mode: "manual", rateMinor: carried });
      continue;
    }
    const kept = existing.get(n);
    if (kept && !kept.isPrimary) {
      out.push({ ...kept, isPrimary: false });
      continue;
    }
    out.push(
      seed === "derive" && seedRule
        ? { occupancy: n, isPrimary: false, mode: "derived", rateMinor: null, ...seedRule }
        : // "copy" is the honest default: the same price at every occupancy is not a clever guess,
          // it is exactly what the hotel charged yesterday, and it is visibly theirs to change.
          { occupancy: n, isPrimary: false, mode: "manual", rateMinor: carried },
    );
  }
  return out;
}

export function collapseToPerRoom(
  current: readonly OccupancyOption[],
  maxOccupancy: number,
  primaryMinor: number,
): OccupancyOption[] {
  const ceiling = Math.min(maxOccupancy, MAX_OCCUPANCY);
  // The primary's price becomes the room price. Any other interpretation loses the number the hotel
  // was actually selling at.
  return [{ occupancy: ceiling, isPrimary: true, mode: "manual", rateMinor: primaryMinor }];
}

/** The option set a brand-new plan starts with, under either model. */
export function defaultOptions(model: PricingModel, maxOccupancy: number, rateMinor: number | null): OccupancyOption[] {
  const ceiling = Math.min(Math.max(1, maxOccupancy), MAX_OCCUPANCY);
  if (model === "per_room") {
    return [{ occupancy: ceiling, isPrimary: true, mode: "manual", rateMinor }];
  }
  return Array.from({ length: ceiling }, (_, i) => ({
    occupancy: i + 1,
    isPrimary: i + 1 === ceiling,
    mode: "manual" as const,
    rateMinor,
  }));
}

/** The property default, unless the plan overrides it. Channex sets `sell_mode` per plan. */
export function effectiveModel(planModel: string | null | undefined, propertyModel: string): PricingModel {
  const v = planModel ?? propertyModel;
  return v === "per_person" ? "per_person" : "per_room";
}

/** Null inherits the room type's default, which itself falls back to the ceiling. */
export function effectivePrimary(
  planPrimary: number | null | undefined,
  roomDefault: number | null | undefined,
  maxOccupancy: number,
): number {
  const ceiling = Math.min(Math.max(1, maxOccupancy), MAX_OCCUPANCY);
  const v = planPrimary ?? roomDefault ?? ceiling;
  return Math.min(Math.max(1, v), ceiling);
}
