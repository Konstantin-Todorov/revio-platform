/**
 * Which Stripe environment GUEST payments use — RevioDirect cards, saved-card charges, refunds,
 * payment links and hotels' Connect onboarding.
 *
 * ⚠️ A CHOICE, never an inference — the same rule as `OperatorCompany.stripeMode` for our own
 * invoicing. Live guest money moves only when `STRIPE_GUEST_MODE=live` is set on the service AND the
 * key is a live key. A key whose prefix disagrees with the chosen mode is refused rather than used:
 * pasting a live key "to check it" must never make the next booking charge a real card, and a test
 * key left behind after going live must never make bookings silently stop taking money.
 */
export type StripeGuestMode = "test" | "live";

export function stripeGuestMode(): StripeGuestMode {
  return process.env.STRIPE_GUEST_MODE?.trim() === "live" ? "live" : "test";
}

/** The secret key for guest payments, or null when absent or of the wrong mode. */
export function guestSecretKey(): string | null {
  const k = process.env.STRIPE_SECRET_KEY?.trim();
  const prefix = stripeGuestMode() === "live" ? "sk_live_" : "sk_test_";
  return k && k.startsWith(prefix) ? k : null;
}

/** The publishable key the browser loads Stripe.js with — the same mode rule. */
export function guestPublishableKeyForMode(): string | null {
  const pk = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? process.env.STRIPE_PUBLISHABLE_KEY)?.trim();
  const prefix = stripeGuestMode() === "live" ? "pk_live_" : "pk_test_";
  return pk && pk.startsWith(prefix) ? pk : null;
}
