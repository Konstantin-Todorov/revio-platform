import { describe, expect, it } from "vitest";
import { checkoutIdempotencyKey } from "./stripe-checkout";

describe("Stripe Checkout idempotency", () => {
  it("does not change with the clock", () => {
    expect(checkoutIdempotencyKey("inv_1", null)).toBe("revio-invoice-inv_1-initial");
    expect(checkoutIdempotencyKey("inv_1", null)).toBe("revio-invoice-inv_1-initial");
  });

  it("gives every caller after the same stored session one request key", () => {
    const first = checkoutIdempotencyKey("inv_1", "cs_test_previous");
    const concurrent = checkoutIdempotencyKey("inv_1", "cs_test_previous");
    expect(concurrent).toBe(first);
  });

  it("allows one new generation only after a different session was stored", () => {
    expect(checkoutIdempotencyKey("inv_1", "cs_test_first"))
      .not.toBe(checkoutIdempotencyKey("inv_1", "cs_test_second"));
  });
});
