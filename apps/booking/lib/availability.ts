import "server-only";
import { forTenant } from "@revio/db";
import { publicAvailability, checkSearch, type PublicRoomOption } from "@revio/booking";
import type { PublicProperty } from "./property";

/**
 * The search, as the page calls it.
 *
 * Rate-limited here rather than deeper down: this is the boundary where an anonymous request
 * becomes database work, and it is the only place that knows the caller's IP.
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

/** Nights between two YYYY-MM-DD dates. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Money for display. Minor units in, a formatted string out — never floats in the maths. */
export function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** "Fri 5 Sep" — short, unambiguous, no locale surprises about 05/09 vs 09/05. */
export function prettyDate(ymd: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  }).format(new Date(`${ymd}T00:00:00Z`));
}
