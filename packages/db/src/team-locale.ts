import { forSystem } from "./rls.js";

/**
 * The language a hotel's TEAM reads its mail in — for the addresses the hotel gave us for bookings
 * and arrivals, which are mailboxes rather than people.
 *
 * The person's own choice wins where the address belongs to one of the hotel's users (their
 * `User.locale`, the language they set the panel to); otherwise the account owner's. English when
 * nobody has chosen. So a hotel whose staff work in Bulgarian gets its new-booking and arrivals mail
 * in Bulgarian, and a chain whose reservations office reads English keeps English.
 */
export async function teamLocale(tenantId: string, addresses: readonly string[]): Promise<string> {
  const db = forSystem();
  const lowered = addresses.map((a) => a.trim().toLowerCase()).filter(Boolean);
  if (lowered.length > 0) {
    const person = await db.user.findFirst({
      where: { tenantId, email: { in: lowered }, locale: { not: null } },
      select: { locale: true },
    });
    if (person?.locale) return person.locale;
  }
  const owner = await db.user.findFirst({
    where: { tenantId, role: "owner", active: true },
    orderBy: { id: "asc" },
    select: { locale: true },
  });
  return owner?.locale ?? "en";
}
