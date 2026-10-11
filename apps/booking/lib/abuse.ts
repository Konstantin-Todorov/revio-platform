import { takeAllowance, type AllowanceRule } from "@revio/db";
import { HOLD_PER_IP, HOLD_PER_PROPERTY, MANAGE_LINK_LIMIT } from "@revio/booking";

/**
 * The limits on this app that cost somebody something, counted in the database.
 *
 * Search and the price calendar stay on the in-memory limiter in `@revio/booking`: they only read,
 * and losing their count on a deploy costs nothing. These three spend something real — a room off
 * sale, an intent on the hotel's Stripe account, a mail from our domain — so their count has to
 * survive a deploy and be shared by every replica. See `@revio/db`'s `public-allowance.ts`.
 */

/** Card intents for one hold. A guest retrying a declined card reuses the intent; this is pressing "Pay". */
export const CARD_PER_HOLD: AllowanceRule = { limit: 6, windowMs: 30 * 60_000 };
/** Card intents from one address, across holds — a family booking two stays is well inside it. */
export const CARD_PER_IP: AllowanceRule = { limit: 12, windowMs: 15 * 60_000 };
/** Mails a guest can ask for (manage link, waitlist) from one address at one hotel. */
export const MAIL_PER_IP: AllowanceRule = MANAGE_LINK_LIMIT;

/**
 * May this address take a room off sale now? The per-property ceiling is only spent once the per-IP
 * check has passed, so one abusive address cannot burn the allowance every real guest shares.
 */
export async function allowHold(ip: string, propertyId: string): Promise<boolean> {
  if (!(await takeAllowance("hold-ip", `${propertyId}:${ip}`, HOLD_PER_IP)).ok) return false;
  return (await takeAllowance("hold-property", propertyId, HOLD_PER_PROPERTY)).ok;
}

/** May this address ask Stripe for another intent for this hold (or pay link)? */
export async function allowCardIntent(ip: string, key: string): Promise<boolean> {
  if (!(await takeAllowance("card-ip", ip, CARD_PER_IP)).ok) return false;
  return (await takeAllowance("card-hold", key, CARD_PER_HOLD)).ok;
}

/** May this address make the hotel send one more guest mail? `kind` keeps the two forms apart. */
export async function allowGuestMail(ip: string, propertyKey: string, kind: "manage" | "waitlist"): Promise<boolean> {
  return (await takeAllowance("mail-ip", `${kind}:${propertyKey}:${ip}`, MAIL_PER_IP)).ok;
}
