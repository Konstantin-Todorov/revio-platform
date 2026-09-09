import { describe, it, expect } from "vitest";
import {
  readStripeKey, stripeHint, switchWarning,
  validateSecretKey, validatePublishableKey, validateWebhookSecret,
} from "./stripe-key";

/*
 * Fake keys, and DELIBERATELY TOO SHORT to be mistaken for real ones.
 *
 * The first version of this file used realistic 28-character tails and GitHub's push protection
 * rejected the push, flagging them as live Stripe credentials. It was right to: a fixture that a
 * scanner cannot tell from a real key is a fixture that trains people to click past the warning.
 *
 * The code under test only ever reads the prefix and the last four characters, so a short tail
 * exercises every branch — and "FAKE" in the middle means a human reading a diff knows too.
 */
const SK_TEST = "sk_test_FAKE4242";
const SK_LIVE = "sk_live_FAKE9999";
const PK_TEST = "pk_test_FAKE1234";
const RK_TEST = "rk_test_FAKE5555";

describe("readStripeKey", () => {
  it("reads kind and mode from the prefix", () => {
    expect(readStripeKey(SK_TEST)).toEqual({ kind: "secret", mode: "test" });
    expect(readStripeKey(SK_LIVE)).toEqual({ kind: "secret", mode: "live" });
    expect(readStripeKey(RK_TEST)).toEqual({ kind: "restricted", mode: "test" });
    expect(readStripeKey(PK_TEST)).toEqual({ kind: "publishable", mode: "test" });
    expect(readStripeKey("whsec_abc123")).toEqual({ kind: "webhook", mode: null });
    expect(readStripeKey("hello")).toEqual({ kind: "unknown", mode: null });
  });

  it("ignores surrounding whitespace, which is how a key arrives from a clipboard", () => {
    expect(readStripeKey(`  ${SK_TEST}\n`).mode).toBe("test");
  });
});

describe("validateSecretKey — the mode trap", () => {
  /*
   * THE test on this file. A live key accepted into the sandbox slot charges real cards while the
   * person believes they are rehearsing, and inferring the mode from the key (which is trivial —
   * it is in the prefix) is precisely what would allow it.
   */
  it("REFUSES a live key in the sandbox slot, and says why in those words", () => {
    const r = validateSecretKey(SK_LIVE, "test");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/LIVE key/);
      expect(r.error).toMatch(/[Rr]eal cards/);
    }
  });

  it("REFUSES a test key in the live slot — broken rather than dangerous, but still refused", () => {
    const r = validateSecretKey(SK_TEST, "live");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/TEST key/);
  });

  it("accepts a matching key and returns a hint that is not the key", () => {
    const r = validateSecretKey(SK_TEST, "test");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.hint).toBe("sk_test_••••4242");
      expect(r.hint).not.toContain("FAKE");
    }
  });

  it("accepts a restricted key, which is the better practice of the two", () => {
    expect(validateSecretKey(RK_TEST, "test").ok).toBe(true);
  });
});

describe("validateSecretKey — recognising what was actually pasted", () => {
  it("names the publishable key rather than saying 'invalid'", () => {
    const r = validateSecretKey(PK_TEST, "test");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/PUBLISHABLE/);
  });

  it("sends a webhook secret to the field it belongs in", () => {
    const r = validateSecretKey("whsec_abc", "test");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/webhook/i);
  });

  it("catches a key copied with something else attached", () => {
    const r = validateSecretKey(`${SK_TEST} and more`, "test");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/space or line break/);
  });

  it("asks for a key when the field is empty", () => {
    expect(validateSecretKey("   ", "test").ok).toBe(false);
  });
});

describe("validatePublishableKey", () => {
  it("is optional", () => {
    expect(validatePublishableKey("", "test")).toEqual({ ok: true, value: "" });
  });

  /*
   * The dangerous direction on this field: its value is DESIGNED to be sent to browsers, so a secret
   * key pasted here is a secret key published. Refusing is not enough — the message has to tell the
   * person to roll it, because by the time they see the error they may already have pasted it
   * somewhere else too.
   */
  it("refuses a secret key AND says to roll it", () => {
    const r = validatePublishableKey(SK_TEST, "test");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/SECRET key/);
      expect(r.error).toMatch(/roll/i);
    }
  });

  it("refuses a publishable key from the other mode", () => {
    const r = validatePublishableKey("pk_live_FAKE9999", "test");
    expect(r.ok).toBe(false);
  });

  it("accepts a matching publishable key", () => {
    expect(validatePublishableKey(PK_TEST, "test")).toEqual({ ok: true, value: PK_TEST });
  });
});

describe("validateWebhookSecret", () => {
  it("is optional, and otherwise must look like one", () => {
    expect(validateWebhookSecret("")).toEqual({ ok: true, value: "" });
    expect(validateWebhookSecret("whsec_abc").ok).toBe(true);
    expect(validateWebhookSecret(SK_TEST).ok).toBe(false);
  });
});

describe("stripeHint", () => {
  it("keeps the prefix and the last four, and nothing in between", () => {
    expect(stripeHint(SK_LIVE)).toBe("sk_live_••••9999");
    expect(stripeHint(PK_TEST)).toBe("pk_test_••••1234");
  });
});

describe("switchWarning", () => {
  it("says nothing when the mode is unchanged", () => {
    expect(switchWarning("test", "test")).toBeNull();
  });

  /*
   * Both directions warn, and both mention the stored ids. This is the failure that is hardest to
   * trace: a saved card silently stops resolving weeks after somebody changed a setting, because
   * Stripe ids do not exist across accounts.
   */
  it("warns in both directions, and names what stops working", () => {
    expect(switchWarning("test", "live")).toMatch(/real cards/i);
    expect(switchWarning("test", "live")).toMatch(/stored payment method|do not exist/i);
    expect(switchWarning("live", "test")).toMatch(/do not exist/i);
  });
});
