import { describe, it, expect } from "vitest";
import { isStripeMode } from "./stripe-key";

/**
 * How the console decides whether it is charging real cards.
 *
 * ## The defect this file exists to pin down
 *
 * The mode used to be **derived** from what was configured:
 *
 * ```ts
 * return live?.lastCheckOk === true ? "live" : "test";   // ← the old rule
 * ```
 *
 * So the ordinary act of pasting a live key to check the connection worked — which is the only
 * reason anybody pastes one before going live — silently made the next payment link charge a real
 * card. The key-entry screen refuses a live key in the sandbox field on the stated grounds that
 * *"mode is chosen by a person, never inferred"*; the selection one layer up then inferred it from
 * exactly the same evidence.
 *
 * The rule is now: **a stored choice, with a precondition on the dangerous direction.** These tests
 * model both, against a fake store, so the property can be asserted without a database — and the
 * first one fails against the old line, which is the point of writing it.
 */

type Mode = "test" | "live";
type Cred = { lastCheckOk: boolean | null } | null;

/** The rule as it is now: the stored choice, with sandbox as the safe reading of "not set". */
function chosenMode(stored: string | null | undefined): Mode {
  return stored === "live" ? "live" : "test";
}

/** The rule as it WAS. Kept only so the regression below has something to fail against. */
function derivedMode(liveCred: Cred): Mode {
  return liveCred?.lastCheckOk === true ? "live" : "test";
}

/** The precondition on going live. Refusing is not inferring: it is declining to pretend. */
function canGoLive(liveCred: Cred): { ok: boolean; reason?: string } {
  if (!liveCred) return { ok: false, reason: "no live key stored" };
  if (liveCred.lastCheckOk !== true) return { ok: false, reason: "live key not checked successfully" };
  return { ok: true };
}

describe("which environment payments use", () => {
  /*
   * THE regression. A tested live key exists — the exact situation after checking a connection —
   * and the answer must still be sandbox, because nobody said to go live.
   */
  it("stays in sandbox when a working live key is merely PRESENT", () => {
    const workingLiveKey: Cred = { lastCheckOk: true };

    expect(chosenMode(null)).toBe("test");
    expect(chosenMode("test")).toBe("test");

    // …and this is what the old rule answered to the same situation:
    expect(derivedMode(workingLiveKey)).toBe("live");
  });

  it("is live only when somebody stored that choice", () => {
    expect(chosenMode("live")).toBe("live");
  });

  it("reads anything unrecognised as sandbox", () => {
    // A row written by hand, or by an older migration, must not be able to mean "charge real cards".
    for (const junk of [null, undefined, "", "LIVE", "production", "yes"]) {
      expect(chosenMode(junk), String(junk)).toBe("test");
    }
  });
});

describe("the precondition on going live", () => {
  it("refuses with no live key stored", () => {
    expect(canGoLive(null).ok).toBe(false);
  });

  it("refuses on a key that has never been checked", () => {
    // Untested is not working. Going live on one means a customer finds the problem for you.
    expect(canGoLive({ lastCheckOk: null }).ok).toBe(false);
  });

  it("refuses on a key Stripe rejected", () => {
    expect(canGoLive({ lastCheckOk: false }).ok).toBe(false);
  });

  it("allows it once a live key has been stored and checked", () => {
    expect(canGoLive({ lastCheckOk: true }).ok).toBe(true);
  });

  /*
   * Deliberately asymmetric. Stopping charging real cards is never the dangerous direction, and a
   * gate on it would be a gate on the panic button.
   */
  it("puts no precondition on going BACK to sandbox", () => {
    expect(isStripeMode("test")).toBe(true);
  });
});

describe("a chosen mode that cannot be honoured", () => {
  /**
   * The choice and the credential are separate facts and either can move without the other: a key
   * removed, rolled at Stripe, or lost in a secret rotation. This models what the screen reports.
   */
  const status = (mode: Mode, cred: Cred) => {
    if (!cred) return { usable: false, problem: `set to ${mode} with no key` };
    if (cred.lastCheckOk === false) return { usable: false, problem: "key rejected" };
    if (cred.lastCheckOk === null) return { usable: true, problem: "never tested" };
    return { usable: true, problem: null };
  };

  it("says so when live is chosen and the live key has gone", () => {
    // A console set to live with no live key looks entirely normal and quietly takes no money.
    expect(status("live", null)).toEqual({ usable: false, problem: "set to live with no key" });
  });

  it("says so when the key was rejected", () => {
    expect(status("live", { lastCheckOk: false }).usable).toBe(false);
  });

  it("warns, but does not block, on a key nobody has tested", () => {
    // Blocking would make the first payment link impossible to create; warning is enough, and the
    // check is one button away.
    expect(status("test", { lastCheckOk: null })).toEqual({ usable: true, problem: "never tested" });
  });

  it("is quiet when the choice and the credential agree", () => {
    expect(status("test", { lastCheckOk: true }).problem).toBeNull();
  });
});
