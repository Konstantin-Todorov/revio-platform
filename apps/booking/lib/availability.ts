import "server-only";
import { forTenant } from "@revio/db";
import { publicAvailability, checkSearch, type PublicRoomOption } from "@revio/booking";
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
  const result = await publicAvailability(db, { ...property, id: property.id }, q);
  if (result.error) return { error: result.error };
  return { options: result.options ?? [] };
}
