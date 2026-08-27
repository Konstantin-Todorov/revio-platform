import "server-only";
import { matchDuplicates, normalisePhone, type DuplicateCandidate } from "@revio/core";
import { prisma } from "./db";
import { activeProperty } from "./data";

/**
 * Stable guest identity + duplicate detection (PMS-REFINEMENT-R1 §3.5 — "foundational, build first").
 *
 * Without a stable id across direct / OTA / walk-in, "Ventsi Mukov" and "Ventsi Mukov Mukov" fragment
 * and every guest metric rots. This finds likely-same-person candidates; `actions-guests.ts` collapses
 * them onto one winner. A merge is SOFT — the loser is re-parented and flagged, never deleted, so ids
 * stay resolvable.
 *
 * **The matching rules moved to `@revio/core` when the CRS needed them too.** This file is now only
 * the query. That is not just tidiness: the rules are pure and tested there, and the version that
 * lived here matched two OTA relay addresses as the same person on the strongest signal it had.
 */

export type { DuplicateCandidate };

/**
 * Likely duplicates of a guest, within the same property.
 *
 * ⚠️ **The candidate set is narrowed in SQL.** This used to load every non-merged guest in the
 * property and filter in JavaScript, then get called a second time by `duplicateCount` — so opening a
 * profile at a hotel with twenty thousand guests read the table twice. The `OR` below is three
 * indexed-ish lookups against the same three signals the pure matcher uses, so the rows that reach
 * memory are already the plausible ones.
 *
 * The phone arm is the imprecise one: we compare on trailing digits, which SQL cannot express against
 * a column stored in whatever format it arrived in. So it is a `contains` on the significant digits —
 * deliberately wider than the real rule, because `matchDuplicates` makes the final decision and a
 * candidate it rejects costs nothing.
 */
export async function findDuplicateGuests(guestId: string): Promise<DuplicateCandidate[]> {
  const { property } = await activeProperty();
  const guest = await prisma.guest.findFirst({ where: { id: guestId, propertyId: property.id } });
  if (!guest) return [];

  const phoneKey = normalisePhone(guest.phone);
  const signals = [
    ...(guest.email ? [{ email: { equals: guest.email, mode: "insensitive" as const } }] : []),
    ...(phoneKey.length >= 6 ? [{ phone: { contains: phoneKey } }] : []),
    {
      AND: [
        { firstName: { equals: guest.firstName, mode: "insensitive" as const } },
        { lastName: { equals: guest.lastName, mode: "insensitive" as const } },
      ],
    },
  ];

  const candidates = await prisma.guest.findMany({
    where: {
      propertyId: property.id,
      mergedIntoId: null,
      id: { not: guestId },
      OR: signals,
    },
    // A guest with a very common name at a large property should not pull an unbounded set into
    // memory. Someone with more than this many candidates has a data problem a list will not solve.
    take: 50,
  });

  return matchDuplicates(guest, candidates);
}

/** Count of open duplicate candidates — a light badge for the profile (§3.5). */
export async function duplicateCount(guestId: string): Promise<number> {
  return (await findDuplicateGuests(guestId)).length;
}
