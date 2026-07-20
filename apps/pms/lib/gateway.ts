import "server-only";

/**
 * The payment-gateway boundary (spec §4.5) — the same pattern as the Channex distribution adapter.
 * Any real card / virtual-card / card-deposit transaction flows through here; the PMS stores ONLY a
 * token + the result, never a card number, so PCI scope stays with the gateway.
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
  if (!key) return { ok: true, ref: `mock_${Date.now().toString(36)}`, mode: "mock", brand: "test", last4: "4242" };
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
  if (!key || ref.startsWith("mock_")) return { ok: true, ref: `mock_refund_${Date.now().toString(36)}`, mode: "mock" };
  try {
    const { json: r } = await stripePost("refunds", key, { payment_intent: ref, amount: String(amountMinor) });
    if (r?.error) return { ok: false, ref: "", mode: "stripe_test", error: r.error.message };
    return { ok: r?.status === "succeeded" || r?.status === "pending", ref: r?.id ?? "", mode: "stripe_test" };
  } catch (e) {
    return { ok: false, ref: "", mode: "stripe_test", error: e instanceof Error ? e.message : "gateway error" };
  }
}
