import "server-only";
import { forSystem, forTenant } from "@revio/db";

/**
 * The guest's "Unsubscribe" key → the one guest it belongs to, and the two things it can do.
 *
 * Resolved through the system perimeter on purpose, exactly like a public slug or a manage-booking
 * key: an anonymous click carries no tenant context until the token has been resolved, and the
 * token is the whole credential. Everything after that scopes to the tenant it returns.
 *
 * What a token can do is deliberately tiny — switch ONE guest's promotional mail off or back on.
 * It reads no booking, no email address and no history, so a leaked or forwarded link exposes
 * nothing and a guessed one (24 random bytes) is not a realistic attack.
 */

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

export interface PrefsGuest {
  id: string;
  tenantId: string;
  optedOut: boolean;
  hotel: string;
  defaultLanguage: string;
}

export async function guestByPrefsToken(token: string): Promise<PrefsGuest | null> {
  if (!TOKEN.test(token)) return null;
  const g = await forSystem().guest.findUnique({
    where: { emailPrefsToken: token },
    select: { id: true, tenantId: true, marketingOptOutAt: true, erasedAt: true, property: { select: { name: true, defaultLanguage: true } } },
  });
  // An erased guest has no one left to ask; the page says the link is no longer valid.
  if (!g || g.erasedAt) return null;
  return { id: g.id, tenantId: g.tenantId, optedOut: g.marketingOptOutAt !== null, hotel: g.property.name, defaultLanguage: g.property.defaultLanguage };
}

/**
 * Opt out (or back in). Idempotent: unsubscribing twice keeps the FIRST date — "when did they ask"
 * is the fact a complaint turns on, and a mail client re-sending its one-click POST must not move it.
 */
export async function setMarketingOptOut(guest: { id: string; tenantId: string }, optOut: boolean): Promise<void> {
  const db = forTenant(guest.tenantId);
  if (optOut) {
    await db.guest.updateMany({ where: { id: guest.id, marketingOptOutAt: null }, data: { marketingOptOutAt: new Date() } });
  } else {
    await db.guest.update({ where: { id: guest.id }, data: { marketingOptOutAt: null } });
  }
}
