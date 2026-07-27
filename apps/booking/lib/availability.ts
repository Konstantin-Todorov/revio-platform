import "server-only";
import { forTenant } from "@revio/db";
import {
  publicAvailability, publicAlternativeStays, checkSearch,
  type PublicRoomOption, type AlternativeStay,
} from "@revio/booking";
import type { PublicProperty } from "./property";

/**
 * The search, as the page calls it.
 *
 * Rate-limited here rather than deeper down: this is the boundary where an anonymous request
 * becomes database work, and it is the only place that knows the caller's IP.
 *
 * Date and money formatting live in ./dates instead — the client components need them too, and this
 * module is server-only.
 */

export interface SearchOutcome {
  options?: PublicRoomOption[];
  /** Nearby dates that are GENUINELY bookable — each one was really searched. Only when empty. */
  alternatives?: AlternativeStay[];
  /** Shown to the guest. Never leaks whether the problem was them, the hotel, or us. */
  error?: string;
  rateLimited?: boolean;
}

export async function searchAvailability(
  property: PublicProperty,
  ip: string,
  q: { checkIn: string; checkOut: string; guests: number },
): Promise<SearchOutcome> {
  if (!checkSearch(ip, property.slug).ok) {
    return { rateLimited: true, error: "Too many searches just now. Please wait a moment and try again." };
  }

  const db = forTenant(property.tenantId);
  const scoped = { ...property, id: property.id };
  const result = await publicAvailability(db, scoped, q);
  if (result.error) return { error: result.error };

  const options = result.options ?? [];

  // Only when the answer is "nothing". The extra queries are worth it precisely because this is the
  // screen where a guest otherwise leaves, and they are never spent on a search that succeeded.
  if (options.length === 0) {
    return { options, alternatives: await publicAlternativeStays(db, scoped, q) };
  }
  return { options };
}
