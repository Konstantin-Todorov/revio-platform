import "server-only";
import { prisma } from "./db";
import { activeProperty } from "./data";

/**
 * Stable guest identity + duplicate detection (PMS-REFINEMENT-R1 §3.5 — "foundational, build first").
 * Without a stable id across direct / OTA / walk-in, "Ventsi Mukov" and "Ventsi Mukov Mukov" fragment and
 * every guest metric rots. Duplicate detection surfaces likely-same-person candidates; the merge action
 * (actions-guests.ts) collapses them onto one winner. Merge is a SOFT merge — the loser is re-parented and
 * flagged (mergedIntoId), never deleted, so ids stay resolvable.
 */

const normName = (first: string, last: string) => `${first} ${last}`.toLowerCase().replace(/\s+/g, " ").trim();
const normPhone = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "");

export type DuplicateCandidate = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  reason: "email" | "phone" | "name";
};

/**
 * Likely duplicates of a guest within the same property: another (non-merged) Guest sharing a
 * case-insensitive email, a digits-only phone, or a normalized full name. Strongest signal wins the
 * reason label. Never returns the guest itself or already-merged records.
 */
export async function findDuplicateGuests(guestId: string): Promise<DuplicateCandidate[]> {
  const { property } = await activeProperty();
  const guest = await prisma.guest.findFirst({ where: { id: guestId, propertyId: property.id } });
  if (!guest) return [];

  const others = await prisma.guest.findMany({
    where: { propertyId: property.id, mergedIntoId: null, id: { not: guestId } },
  });

  const email = guest.email?.toLowerCase().trim() || null;
  const phone = normPhone(guest.phone);
  const name = normName(guest.firstName, guest.lastName);

  const out: DuplicateCandidate[] = [];
  for (const o of others) {
    let reason: DuplicateCandidate["reason"] | null = null;
    if (email && o.email && o.email.toLowerCase().trim() === email) reason = "email";
    else if (phone.length >= 6 && normPhone(o.phone) === phone) reason = "phone";
    else if (name && normName(o.firstName, o.lastName) === name) reason = "name";
    if (reason) out.push({ id: o.id, name: `${o.firstName} ${o.lastName}`.trim(), email: o.email, phone: o.phone, reason });
  }
  // email > phone > name
  const rank = { email: 0, phone: 1, name: 2 };
  return out.sort((a, b) => rank[a.reason] - rank[b.reason]);
}

/** Count of open duplicate candidates for a guest — a light badge for the profile (§3.5). */
export async function duplicateCount(guestId: string): Promise<number> {
  return (await findDuplicateGuests(guestId)).length;
}
