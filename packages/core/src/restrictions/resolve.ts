/**
 * ARI precedence resolution — the TWO-TIER model (docs/specs/CRS-GUIDE-V1.md §1.4).
 *
 * Tier 1 — date-scoped edits (attached to actual dates):
 *   Any rate, restriction, or open/close value set for specific dates via the Calendar or a
 *   Bulk run. Calendar and bulk are PEERS — they write the same stored record, so the most
 *   recent write simply IS the stored value (last write wins by recency). There is no fixed
 *   "manual beats bulk" ranking; provenance (updatedAt + source on DailyCell/RatePrice)
 *   records which surface wrote last so the audit trail can explain which edit won.
 *
 *   Standing restriction RULES ("Easter minimum stay", source-targetable in the CRS) are
 *   evaluated inside this tier, below an explicit cell value: an explicit date-scoped cell
 *   edit overrides a rule for that date; a rule overrides the standing defaults.
 *
 * Tier 2 — standing defaults (product-level, no dates):
 *   rate-plan default (more specific) → property default (catch-all).
 *
 * Resolution for any date + rate plan:
 *   date-scoped value → matching rule → rate-plan default → property default
 *
 * Displayed precedence line wherever ARI is edited:
 *   "date-scoped edit (calendar or bulk — most recent wins) → restriction rule →
 *    rate-plan default → property default"
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

/** Which surface last wrote a date-scoped value (DailyCell/RatePrice provenance). */
export type DateScopedSource = "calendar" | "bulk" | "seed" | "api";

export interface RestrictionSources {
  /**
   * The stored date-scoped value for this exact slot, if any (a Calendar or Bulk edit —
   * peers by recency, the stored value is whichever wrote last). Beats everything.
   */
  dateScoped?: RestrictionValue;
  /** Provenance of the date-scoped value, when known — surfaced in audit/tooltips. */
  dateScopedVia?: DateScopedSource;
  /** Restriction rules already filtered to those matching this slot/channel/source. */
  matchingRules?: RestrictionRuleHit[];
  /** The rate plan's own standing default for this restriction, if set. */
  ratePlanDefault?: RestrictionValue;
  /** The property-wide standing default (PropertyDefaults) — the catch-all fallback. */
  propertyDefault?: RestrictionValue;
}

export interface ResolvedRestriction {
  value: RestrictionValue;
  source: "date_scoped" | "rule" | "rate_plan_default" | "property_default" | "none";
  /** When source is date_scoped and provenance was supplied: which surface wrote it. */
  via?: DateScopedSource;
}

/** Resolve one restriction type for one slot, applying the two-tier precedence. */
export function resolveRestriction(
  _type: RestrictionType,
  sources: RestrictionSources,
): ResolvedRestriction {
  if (sources.dateScoped !== undefined) {
    return {
      value: sources.dateScoped,
      source: "date_scoped",
      ...(sources.dateScopedVia ? { via: sources.dateScopedVia } : {}),
    };
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

/** The precedence line to display wherever a user edits ARI (spec §1.4). */
export const PRECEDENCE_LINE =
  "date-scoped edit (calendar or bulk — most recent wins) → restriction rule → rate-plan default → property default";
