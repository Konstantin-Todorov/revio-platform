import { afterEach, describe, expect, it } from "vitest";
import { guestPublishableKeyForMode, guestSecretKey, stripeGuestMode } from "./stripe-mode";

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });
const set = (mode: string | undefined, sk: string | undefined, pk?: string) => {
  if (mode === undefined) delete process.env.STRIPE_GUEST_MODE; else process.env.STRIPE_GUEST_MODE = mode;
  if (sk === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = sk;
  delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (pk === undefined) delete process.env.STRIPE_PUBLISHABLE_KEY; else process.env.STRIPE_PUBLISHABLE_KEY = pk;
};

describe("guest Stripe mode", () => {
  it("is test unless live is chosen explicitly", () => {
    set(undefined, "sk_test_x");
    expect(stripeGuestMode()).toBe("test");
    expect(guestSecretKey()).toBe("sk_test_x");
  });

  it("refuses a live key while in test mode — pasting it must not start charging real cards", () => {
    set(undefined, "sk_live_x", "pk_live_x");
    expect(guestSecretKey()).toBeNull();
    expect(guestPublishableKeyForMode()).toBeNull();
  });

  it("uses a live key only when live is chosen", () => {
    set("live", "sk_live_x", "pk_live_x");
    expect(stripeGuestMode()).toBe("live");
    expect(guestSecretKey()).toBe("sk_live_x");
    expect(guestPublishableKeyForMode()).toBe("pk_live_x");
  });

  it("refuses a test key once live is chosen — bookings must not silently stop taking money", () => {
    set("live", "sk_test_x", "pk_test_x");
    expect(guestSecretKey()).toBeNull();
    expect(guestPublishableKeyForMode()).toBeNull();
  });
});
