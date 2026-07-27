import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetRateLimits, checkHold, checkSearch, clientIp, hit, HOLD_PER_IP, HOLD_PER_PROPERTY, SEARCH_LIMIT,
} from "./rate-limit.js";

beforeEach(() => __resetRateLimits());

describe("hit", () => {
  it("allows up to the limit and then refuses", () => {
    const rule = { limit: 3, windowMs: 1000 };
    expect(hit("k", rule, 0).ok).toBe(true);
    expect(hit("k", rule, 0).ok).toBe(true);
    expect(hit("k", rule, 0).ok).toBe(true);
    expect(hit("k", rule, 0).ok).toBe(false);
  });

  it("reopens once the window passes", () => {
    const rule = { limit: 1, windowMs: 1000 };
    expect(hit("k", rule, 0).ok).toBe(true);
    expect(hit("k", rule, 500).ok).toBe(false);
    expect(hit("k", rule, 1001).ok).toBe(true);
  });

  it("keeps separate keys independent", () => {
    const rule = { limit: 1, windowMs: 1000 };
    expect(hit("a", rule, 0).ok).toBe(true);
    expect(hit("b", rule, 0).ok).toBe(true);
  });

  it("reports a reset time a caller can turn into Retry-After", () => {
    const r = hit("k", { limit: 1, windowMs: 5000 }, 1000);
    expect(r.resetAt).toBe(6000);
  });
});

describe("hold exhaustion — the attack this exists to stop", () => {
  it("cuts off one IP long before it can hold a hotel out", () => {
    let blocked = 0;
    for (let i = 0; i < 50; i++) {
      if (!checkHold("1.2.3.4", "prop-1").ok) blocked++;
    }
    expect(blocked).toBe(50 - HOLD_PER_IP.limit);
  });

  it("caps the whole property even when the attempt is spread across many IPs", () => {
    // A distributed script rotating IPs defeats a per-IP limit entirely; the property ceiling is
    // what actually protects the hotel's inventory.
    let allowed = 0;
    for (let i = 0; i < 200; i++) {
      if (checkHold(`10.0.0.${i}`, "prop-1").ok) allowed++;
    }
    expect(allowed).toBe(HOLD_PER_PROPERTY.limit);
  });

  it("says which limit was hit, so the response can differ", () => {
    for (let i = 0; i < HOLD_PER_IP.limit; i++) checkHold("9.9.9.9", "prop-x");
    expect(checkHold("9.9.9.9", "prop-x").scope).toBe("ip");
  });

  it("does not let one abusive IP burn the property allowance for everyone else", () => {
    // The per-IP check runs first and short-circuits, so a blocked IP stops consuming the
    // property budget — otherwise one script would lock out genuine guests.
    for (let i = 0; i < 100; i++) checkHold("6.6.6.6", "prop-2");
    let othersAllowed = 0;
    for (let i = 0; i < HOLD_PER_PROPERTY.limit; i++) {
      if (checkHold(`172.16.0.${i}`, "prop-2").ok) othersAllowed++;
    }
    expect(othersAllowed).toBeGreaterThan(HOLD_PER_PROPERTY.limit - HOLD_PER_IP.limit - 1);
  });

  it("isolates properties from each other", () => {
    for (let i = 0; i < 200; i++) checkHold(`10.0.0.${i}`, "prop-a");
    expect(checkHold("10.0.0.1", "prop-b").ok).toBe(true);
  });
});

describe("search limiting", () => {
  it("is generous enough for a guest changing their mind repeatedly", () => {
    let ok = 0;
    for (let i = 0; i < SEARCH_LIMIT.limit; i++) if (checkSearch("1.1.1.1", "hotel-sofia").ok) ok++;
    expect(ok).toBe(SEARCH_LIMIT.limit);
    expect(checkSearch("1.1.1.1", "hotel-sofia").ok).toBe(false);
  });
});

describe("clientIp", () => {
  it("takes the FIRST forwarded address, not the last", () => {
    // Taking the last would let a caller spoof its identity by sending its own header.
    const h = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" });
    expect(clientIp(h)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    // Unknown collapses everyone into one stricter bucket rather than skipping the limit.
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
