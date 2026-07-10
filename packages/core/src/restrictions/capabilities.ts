/**
 * Per-channel capability map (docs/specs/CM-GUIDE-V2.md §5.2).
 *
 * Not every OTA supports every restriction type (the canonical example: Expedia has no
 * close-to-departure). That is a LIMITATION, not a failure — so:
 *  - never send a channel a restriction type it can't honour (filtered at push build time),
 *  - never count a capability mismatch as a failed sync,
 *  - show "not applicable on this channel" in the UI instead of an error.
 *
 * The source of truth per channel is `Channel.supportedRestrictions` (seeded per OTA, editable
 * by the operator). An EMPTY list means "unknown" and is treated as fully capable, so channels
 * created before this map existed keep working.
 */
import type { RestrictionType } from "../domain/types.js";

export const ALL_RESTRICTION_TYPES: readonly RestrictionType[] = [
  "stop_sell",
  "min_los",
  "max_los",
  "cta",
  "ctd",
  "advance_purchase_min",
  "advance_purchase_max",
  "channel_allocation",
] as const;

/** ErrorItem.code used for capability mismatches — dashboards must NOT count these as failures. */
export const CAPABILITY_ERROR_CODE = "restriction_not_supported";

/** May this channel receive this restriction type? Empty/unknown list ⇒ assume yes. */
export function channelSupports(
  supported: readonly string[] | null | undefined,
  type: RestrictionType,
): boolean {
  if (!supported || supported.length === 0) return true;
  return supported.includes(type);
}

/** The restriction types a channel can NOT honour (for UI badges / rule warnings). */
export function unsupportedRestrictions(supported: readonly string[] | null | undefined): RestrictionType[] {
  if (!supported || supported.length === 0) return [];
  return ALL_RESTRICTION_TYPES.filter((t) => !supported.includes(t));
}
