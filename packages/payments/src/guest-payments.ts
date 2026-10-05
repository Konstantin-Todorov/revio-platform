/**
 * A guest paying the HOTEL on RevioDirect — card entered in Stripe's own Payment Element, charged on
 * the hotel's connected account (`Stripe-Account`), so the money settles to the hotel and never
 * passes through ours.
 *
 * ## Authorise, book, then capture
 *
 * A payment is created with `capture_method=manual`: the card is authorised while the guest is on
 * the page (3-D Secure included), the reservation is written, and only then is the money captured.
 * If the booking fails — the hold expired, the room went — the authorisation is cancelled and the
 * guest was never charged. If they close the tab in between, Stripe releases the authorisation by
 * itself. The alternative order, charge-then-book, has a window in which a guest has paid for a
 * booking that does not exist, and the only repair is a refund they have to wait days for.
 *
 * Every intent saves the card for later off-session use (`setup_future_usage` / SetupIntent
 * `usage`), because a balance charged before arrival and a no-show fee are both charges made without
 * the guest present. Authenticating while they ARE present is what lets those go through as
 * merchant-initiated.
 *
 * ## Keys
 *
 * Test or live by explicit choice (`STRIPE_GUEST_MODE`, see `stripe-mode.ts`); a key whose prefix
 * disagrees with that choice is refused. Live since 2026-10-05. `STRIPE_TEST_CHARGE_PLATFORM=1` (local development only, and
 * only with a test key) charges the platform's own sandbox when no connected account exists — for
 * exercising the form before Connect is enabled. It can never apply in live mode.
 */

import { guestPublishableKeyForMode, guestSecretKey, stripeGuestMode } from "./stripe-mode.js";

export type GuestIntentKind = "payment" | "setup";

// Test or live by explicit choice — see `stripe-mode.ts`.
const key = guestSecretKey;

/** Whether guests can pay online at all from this deployment. */
export function guestPaymentsConfigured(): boolean {
  return key() !== null;
}

/** Local development: charge the platform sandbox when a hotel has no connected account. Test keys only. */
export function testChargesOnPlatform(): boolean {
  return key() !== null && stripeGuestMode() === "test" && process.env.STRIPE_TEST_CHARGE_PLATFORM === "1";
}

/** The publishable key the browser loads Stripe.js with. */
export function guestPublishableKey(): string | null {
  return guestPublishableKeyForMode();
}

/** The fields of a Stripe object this module reads — nothing else is trusted to exist. */
interface StripeObject {
  id?: string;
  client_secret?: string;
  status?: string;
  amount?: number;
  amount_capturable?: number;
  currency?: string;
  metadata?: Record<string, string>;
  payment_method?: string | { id?: string; card?: { brand?: string; last4?: string } } | null;
  customer?: string | { id?: string } | null;
  last_payment_error?: { code?: string; message?: string } | null;
  error?: { message?: string; code?: string; payment_intent?: { id?: string; status?: string } };
}

async function call(
  method: "GET" | "POST",
  path: string,
  account: string | null,
  body?: Record<string, string>,
): Promise<{ status: number; json: StripeObject }> {
  const k = key();
  if (!k) return { status: 0, json: { error: { message: "Online payments are not configured." } } };
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${k}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // The hotel's account, so the charge is theirs. Absent only in the local platform-test mode.
      ...(account ? { "Stripe-Account": account } : {}),
    },
    ...(body ? { body: new URLSearchParams(body).toString() } : {}),
  });
  return { status: res.status, json: (await res.json()) as StripeObject };
}

export type CreatedIntent = { ok: true; id: string; clientSecret: string; customerId: string } | { ok: false; error: string };

export async function createGuestIntent(opts: {
  account: string | null;
  kind: GuestIntentKind;
  amountMinor: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
  /** The guest, as a Customer on the hotel's account. A card can only be charged again — the
   *  balance before arrival, a no-show fee — if it is attached to a Customer; Stripe refuses to
   *  reuse a payment method that was saved without one. */
  guest: { email: string; name: string; /** The page's language — Stripe's own receipts, if the hotel turns them on, follow it. */ locale?: string };
  /**
   * `authorise` (default) for a booking: hold the money, capture once the reservation exists.
   * `charge` for a payment link: the booking already exists, so the money is taken when the guest
   * confirms, and the card is not saved — they paid once, for one thing.
   */
  mode?: "authorise" | "charge";
}): Promise<CreatedIntent> {
  const cust = await call("POST", "customers", opts.account, {
    email: opts.guest.email, name: opts.guest.name, "metadata[source]": "reviodirect",
    ...(opts.guest.locale ? { "preferred_locales[0]": opts.guest.locale } : {}),
  });
  if (cust.status !== 200 || !cust.json.id) return { ok: false, error: cust.json.error?.message ?? `Stripe answered ${cust.status}` };
  const customer = cust.json.id;
  const meta = Object.fromEntries(Object.entries(opts.metadata).map(([k, v]) => [`metadata[${k}]`, v]));
  const body: Record<string, string> =
    opts.kind === "payment"
      ? {
          amount: String(opts.amountMinor),
          currency: opts.currency.toLowerCase(),
          ...(opts.mode === "charge"
            ? {}
            : { capture_method: "manual", setup_future_usage: "off_session" }),
          // Cards (Apple Pay and Google Pay are cards) — no method that redirects away mid-booking.
          "payment_method_types[]": "card",
          description: opts.description,
          customer,
          ...meta,
        }
      : { usage: "off_session", "payment_method_types[]": "card", description: opts.description, customer, ...meta };
  const { status, json } = await call("POST", opts.kind === "payment" ? "payment_intents" : "setup_intents", opts.account, body);
  // The status code decides, never the shape: an error body is valid JSON too.
  if (status !== 200 || !json?.id || !json?.client_secret) return { ok: false, error: json?.error?.message ?? `Stripe answered ${status}` };
  return { ok: true, id: json.id, clientSecret: json.client_secret, customerId: customer };
}

export interface RetrievedIntent {
  kind: GuestIntentKind;
  status: string;
  amountMinor: number;
  /** For a payment: what is authorised and ready to capture. */
  capturableMinor: number;
  currency: string;
  metadata: Record<string, string>;
  paymentMethodId: string | null;
  customerId: string | null;
  brand: string | null;
  last4: string | null;
}

export async function retrieveGuestIntent(id: string, account: string | null): Promise<RetrievedIntent | null> {
  const kind: GuestIntentKind = id.startsWith("seti_") ? "setup" : "payment";
  if (kind === "payment" && !id.startsWith("pi_")) return null;
  const { status, json } = await call("GET", `${kind === "payment" ? "payment_intents" : "setup_intents"}/${encodeURIComponent(id)}?expand[]=payment_method`, account);
  if (status !== 200 || !json?.id) return null;
  const pm = typeof json.payment_method === "object" ? json.payment_method : null;
  return {
    kind,
    status: json.status ?? "",
    amountMinor: json.amount ?? 0,
    capturableMinor: json.amount_capturable ?? 0,
    currency: (json.currency ?? "").toUpperCase(),
    metadata: json.metadata ?? {},
    paymentMethodId: pm?.id ?? (typeof json.payment_method === "string" ? json.payment_method : null),
    customerId: typeof json.customer === "string" ? json.customer : json.customer?.id ?? null,
    brand: pm?.card?.brand ?? null,
    last4: pm?.card?.last4 ?? null,
  };
}

/** Take the authorised money. Called only after the reservation exists. */
export async function captureGuestIntent(id: string, account: string | null): Promise<{ ok: boolean; error?: string }> {
  const { status, json } = await call("POST", `payment_intents/${encodeURIComponent(id)}/capture`, account, {});
  return status === 200 && json?.status === "succeeded" ? { ok: true } : { ok: false, error: json?.error?.message ?? `Stripe answered ${status}` };
}

/** Release an authorisation the booking could not use. The guest is never charged. */
export async function cancelGuestIntent(id: string, account: string | null): Promise<void> {
  if (id.startsWith("pi_")) await call("POST", `payment_intents/${encodeURIComponent(id)}/cancel`, account, {});
}

export type OffSessionResult =
  | { ok: true; intentId: string }
  | { ok: false; intentId: string | null; reason: "authentication_required" | "declined" | "not_configured" | "error"; message: string };

/**
 * Charge a saved card with the guest NOT present — the balance before arrival, a no-show fee, a
 * late-cancellation fee. Merchant-initiated, on the hotel's account, against the card the guest
 * authenticated at booking.
 *
 * It can still be refused: the bank may ask for the guest again (`authentication_required`), or
 * decline. Neither is a failure of ours to hide — the caller records it and asks the guest to pay
 * through a link. Idempotent by `idempotencyKey`, so a retried job never charges twice.
 */
export async function chargeSavedCard(opts: {
  account: string | null;
  customerId: string;
  paymentMethodId: string;
  amountMinor: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
  idempotencyKey: string;
}): Promise<OffSessionResult> {
  const k = key();
  if (!k) return { ok: false, intentId: null, reason: "not_configured", message: "Online payments are not configured." };
  const meta = Object.fromEntries(Object.entries(opts.metadata).map(([m, v]) => [`metadata[${m}]`, v]));
  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${k}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": opts.idempotencyKey,
      ...(opts.account ? { "Stripe-Account": opts.account } : {}),
    },
    body: new URLSearchParams({
      amount: String(opts.amountMinor),
      currency: opts.currency.toLowerCase(),
      customer: opts.customerId,
      payment_method: opts.paymentMethodId,
      off_session: "true",
      confirm: "true",
      description: opts.description,
      ...meta,
    }).toString(),
  });
  const json = (await res.json()) as StripeObject;
  if (res.status === 200 && json.status === "succeeded" && json.id) return { ok: true, intentId: json.id };
  const code = json.error?.code ?? json.last_payment_error?.code ?? "";
  const intentId = json.error?.payment_intent?.id ?? json.id ?? null;
  return {
    ok: false,
    intentId,
    reason: code === "authentication_required" ? "authentication_required" : code === "card_declined" ? "declined" : "error",
    message: json.error?.message ?? json.last_payment_error?.message ?? `Stripe answered ${res.status}`,
  };
}

/** Return money to the guest, on the hotel's account. Partial refunds are allowed. */
export async function refundGuestPayment(opts: {
  account: string | null; intentId: string; amountMinor: number; idempotencyKey: string;
}): Promise<{ ok: boolean; error?: string }> {
  const k = key();
  if (!k) return { ok: false, error: "Online payments are not configured." };
  const res = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${k}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": opts.idempotencyKey,
      ...(opts.account ? { "Stripe-Account": opts.account } : {}),
    },
    body: new URLSearchParams({ payment_intent: opts.intentId, amount: String(opts.amountMinor) }).toString(),
  });
  const json = (await res.json()) as StripeObject;
  return res.status === 200 ? { ok: true } : { ok: false, error: json.error?.message ?? `Stripe answered ${res.status}` };
}
