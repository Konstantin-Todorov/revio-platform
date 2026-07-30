/**
 * The payment-gateway boundary (spec §4.5) — the same pattern as the Channex distribution adapter.
 * Any card transaction flows through here; callers store ONLY a token + the result, never a card
 * number, so PCI scope stays with the gateway.
 *
 * Shared because TWO products need it and an app may never import another app's internals (root
 * CLAUDE.md): RevioPMS charges and refunds at the desk, RevioDirect guarantees a card at booking.
 * One boundary means one place where the "TEST keys only" rule is enforced.
 *
 * Mock-first: with no Stripe key it returns a fake reference (demo default). With a `sk_test_` key it
 * talks to Stripe in TEST MODE against Stripe's own `pm_card_visa` test fixture — no real card is ever
 * entered, no real money moves (livemode:false). Cash is a drawer entry and never comes through here.
 */

export type GatewayResult = { ok: boolean; ref: string; mode: "mock" | "stripe_test"; brand?: string; last4?: string; error?: string };

function stripeKey(): string | null {
  const k = process.env.STRIPE_SECRET_KEY;
  return k && k.startsWith("sk_test_") ? k : null; // TEST keys only — never a live key
}

/**
 * A unique mock reference.
 *
 * Timestamp alone is not enough: two bookings confirmed in the same millisecond would share a
 * reference, and a hotel raising a no-show charge would be pointing at the wrong one. Rare, but the
 * failure is "charged the wrong guest", so it gets randomness rather than optimism.
 */
function mockRef(kind: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `mock_${kind}${Date.now().toString(36)}_${rand}`;
}

export function gatewayMode(): "mock" | "stripe_test" {
  return stripeKey() ? "stripe_test" : "mock";
}

async function stripePost(path: string, key: string, body: Record<string, string>): Promise<{ status: number; json: any }> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  return { status: res.status, json: await res.json() };
}

/** Capture a card payment/deposit. Test mode confirms against Stripe's pm_card_visa fixture. */
export async function chargeCard(amountMinor: number, currency: string, description: string): Promise<GatewayResult> {
  const key = stripeKey();
  if (!key) return { ok: true, ref: mockRef(""), mode: "mock", brand: "test", last4: "4242" };
  try {
    const { json: pi } = await stripePost("payment_intents", key, {
      amount: String(amountMinor),
      currency: currency.toLowerCase(),
      description,
      payment_method: "pm_card_visa", // Stripe's built-in TEST card — no card data leaves the gateway
      confirm: "true",
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
    });
    if (pi?.error) return { ok: false, ref: "", mode: "stripe_test", error: pi.error.message };
    const card = pi?.charges?.data?.[0]?.payment_method_details?.card;
    return { ok: pi?.status === "succeeded", ref: pi?.id ?? "", mode: "stripe_test", brand: card?.brand, last4: card?.last4 };
  } catch (e) {
    return { ok: false, ref: "", mode: "stripe_test", error: e instanceof Error ? e.message : "gateway error" };
  }
}

/** Refund a card transaction back through the same gateway. */
export async function refundCard(ref: string, amountMinor: number): Promise<GatewayResult> {
  const key = stripeKey();
  if (!key || ref.startsWith("mock_")) return { ok: true, ref: mockRef("refund_"), mode: "mock" };
  try {
    const { json: r } = await stripePost("refunds", key, { payment_intent: ref, amount: String(amountMinor) });
    if (r?.error) return { ok: false, ref: "", mode: "stripe_test", error: r.error.message };
    return { ok: r?.status === "succeeded" || r?.status === "pending", ref: r?.id ?? "", mode: "stripe_test" };
  } catch (e) {
    return { ok: false, ref: "", mode: "stripe_test", error: e instanceof Error ? e.message : "gateway error" };
  }
}

/**
 * A card GUARANTEE — verify the card, charge nothing.
 *
 * This is the booking engine's model (design §2.5②): the guest's card secures the room, the money
 * is taken at the hotel. Stripe calls this a SetupIntent, and it is a genuinely different operation
 * from a payment — no amount, no capture, nothing on a statement.
 *
 * **No card number ever reaches us.** In mock mode there is no card at all. In test mode we confirm
 * against Stripe's own `pm_card_visa` fixture, so even in the strongest configuration the only card
 * involved is one Stripe published for testing. Collecting a real card would need Stripe Elements
 * in the browser and a live-mode decision — deliberately out of scope, and the reason the guest
 * form has no card fields.
 */
export async function createCardGuarantee(
  currency: string,
  description: string,
): Promise<GatewayResult> {
  const key = stripeKey();
  if (!key) {
    return { ok: true, ref: mockRef("guarantee_"), mode: "mock", brand: "visa", last4: "4242" };
  }
  try {
    const { json: si } = await stripePost("setup_intents", key, {
      description,
      // usage=off_session: the hotel may need to charge a no-show later without the guest present,
      // which is exactly what a guarantee is for.
      usage: "off_session",
      payment_method: "pm_card_visa",
      confirm: "true",
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
      // Currency is not charged here; it is carried so the eventual capture matches the booking.
      "metadata[currency]": currency.toLowerCase(),
    });
    if (si?.error) return { ok: false, ref: "", mode: "stripe_test", error: si.error.message };
    return {
      ok: si?.status === "succeeded",
      // The payment METHOD is what a later capture needs — the intent itself is single-use.
      ref: si?.payment_method ?? si?.id ?? "",
      mode: "stripe_test",
      brand: "visa",
      last4: "4242",
    };
  } catch (e) {
    return { ok: false, ref: "", mode: "stripe_test", error: e instanceof Error ? e.message : "gateway error" };
  }
}
