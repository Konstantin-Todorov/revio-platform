/**
 * Restriction priority resolution. When more than one source sets the same restriction for a
 * date/room/rate/channel, the most specific wins (docs/CRS-REFERENCE.md — FOUR levels):
 *
 *   1. Manual edit (Calendar cell or Bulk Update)   — always wins
 *   2. Restriction Rule (highest-priority matching)
 *   3. Rate Plan default
 *   4. Property default                             — global fallback baseline
 *
 * Pure functions only — see packages/core/CLAUDE.md.
 */

import type { RestrictionType } from "../domain/types.js";

export type RestrictionValue = number | boolean;

export interface RestrictionRuleHit {
  /** Higher number = higher priority among rules. */
  priority: number;
  value: RestrictionValue;
}

export interface RestrictionSources {
  /** A manual cell/bulk edit for this exact slot, if any. Beats everything. */
  manual?: RestrictionValue;
  /** Restriction rules already filtered to those matching this slot/channel. */
  matchingRules?: RestrictionRuleHit[];
  /** The rate plan's own default for this restriction, if set. */
  ratePlanDefault?: RestrictionValue;
  /** The property-wide default (PropertyDefaults) — the level-4 global fallback. */
  propertyDefault?: RestrictionValue;
}

export interface ResolvedRestriction {
  value: RestrictionValue;
  source: "manual" | "rule" | "rate_plan_default" | "property_default" | "none";
}

/** Resolve one restriction type for one slot, applying the priority order. */
export function resolveRestriction(
  _type: RestrictionType,
  sources: RestrictionSources,
): ResolvedRestriction {
  if (sources.manual !== undefined) {
    return { value: sources.manual, source: "manual" };
  }

  const rules = sources.matchingRules ?? [];
  if (rules.length > 0) {
    const winner = rules.reduce((best, r) =>
      r.priority > best.priority ? r : best,
    );
    return { value: winner.value, source: "rule" };
  }

  if (sources.ratePlanDefault !== undefined) {
    return { value: sources.ratePlanDefault, source: "rate_plan_default" };
  }

  if (sources.propertyDefault !== undefined) {
    return { value: sources.propertyDefault, source: "property_default" };
  }

  return { value: false, source: "none" };
}
