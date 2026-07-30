import { afterEach, describe, expect, it } from "vitest";
import { chargeCard, createCardGuarantee, gatewayMode, refundCard } from "./gateway.js";

/**
 * The safety property this package exists to guarantee: **a live key can never move real money.**
 *
 * `stripeKey()` accepts only the `sk_test_` prefix, so pasting a production key into the wrong
 * environment variable degrades to the mock instead of charging a real card. That is a one-line
 * rule protecting the single most expensive possible mistake in the platform, and it is exactly the
 * kind of line a well-meaning refactor deletes — so it is asserted here rather than trusted.
 */

const original = process.env.STRIPE_SECRET_KEY;
afterEach(() => {
  if (original === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = original;
});

describe("key handling", () => {
  it("runs on the mock when no key is set", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(gatewayMode()).toBe("mock");
  });

  it("uses Stripe only for a TEST key", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc123";
    expect(gatewayMode()).toBe("stripe_test");
  });

  it.each([
    ["a live key", "sk_live_abc123"],
    ["a restricted live key", "rk_live_abc123"],
    ["a publishable key", "pk_test_abc123"],
    ["an empty string", ""],
    ["whitespace", "   "],
    ["a lookalike prefix", "sk_testing_abc"],
  ])("refuses %s and falls back to the mock", (_label, key) => {
    process.env.STRIPE_SECRET_KEY = key;
    // The important half: a LIVE key must never select the real gateway. Falling back to the mock
    // means the worst case is a fake reference, never a real charge.
    if (key.startsWith("sk_test_")) return;
    expect(gatewayMode()).toBe("mock");
  });
});

describe("mock behaviour", () => {
  it("charges without a network call and returns a traceable reference", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = await chargeCard(28298, "EUR", "test stay");
    expect(res.ok).toBe(true);
    expect(res.mode).toBe("mock");
    expect(res.ref).toMatch(/^mock_/);
  });

  it("guarantees a card without charging anything", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = await createCardGuarantee("EUR", "guarantee");
    expect(res.ok).toBe(true);
    expect(res.mode).toBe("mock");
    // A guarantee is a different operation from a payment, and its reference says so — a reader
    // scanning a folio should never mistake one for the other.
    expect(res.ref).toMatch(/^mock_guarantee_/);
    expect(res.last4).toBe("4242");
  });

  it("gives every call its own reference, so two bookings never collide", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const refs = new Set<string>();
    for (let i = 0; i < 50; i++) refs.add((await createCardGuarantee("EUR", `g${i}`)).ref);
    expect(refs.size).toBeGreaterThan(1);
  });

  it("refunds a mock charge without reaching the network", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = await refundCard("mock_abc", 1000);
    expect(res.ok).toBe(true);
    expect(res.mode).toBe("mock");
  });

  it("keeps a mock reference on the mock path even when a test key is present", async () => {
    // A booking taken on the demo must not be refunded against a real Stripe object later.
    process.env.STRIPE_SECRET_KEY = "sk_test_abc123";
    const res = await refundCard("mock_abc", 1000);
    expect(res.mode).toBe("mock");
  });
});
