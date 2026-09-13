import { describe, it, expect } from "vitest";
import { loginDestination, openProducts, productLabel, refusalMessageFor } from "./login-destination.js";

const ALL = { cm: true, crs: true, pms: true };
const NONE = { cm: false, crs: false, pms: false };
const at = (over: Partial<Parameters<typeof loginDestination>[0]> = {}) =>
  loginDestination({ tenantStatus: "active", entitlements: ALL, requested: null, ...over });

describe("a correct password on a healthy account", () => {
  it("opens the product they asked for", () => {
    expect(at({ requested: "pms" })).toEqual({ kind: "open", product: "pms" });
  });

  it("opens the first product they own when they asked for none", () => {
    expect(at({ entitlements: { cm: false, crs: true, pms: true } })).toEqual({ kind: "open", product: "crs" });
  });

  it("keeps the house order — RevioLink, then RevioCRS, then RevioPMS", () => {
    expect(openProducts(ALL)).toEqual(["cm", "crs", "pms"]);
  });
});

describe("⚠️ locked is NOT refused — the whole of the Day 31 promise", () => {
  it("signs in a hotel whose trial ended and sends them to the screen that explains it", () => {
    /*
     * Until 13 September RevioLink and RevioCRS refused the sign-in outright here, which made the
     * ended-trial screen — end date, nothing deleted, "I want to keep it" — reachable only by a
     * hotel still holding a cookie from before the sweep ran. Everyone who came back after the
     * trial-end email, which is exactly who it is for, was stopped at the door.
     */
    const d = at({ entitlements: { cm: false, crs: true, pms: false }, requested: "cm", everTrialled: true });
    expect(d).toEqual({ kind: "locked", product: "cm", alsoOpen: ["crs"] });
    expect(refusalMessageFor(d)).toBeNull();
  });

  it("is still locked, not refused, when they own nothing else at all", () => {
    const d = at({ entitlements: NONE, requested: "pms", everTrialled: true });
    expect(d).toEqual({ kind: "locked", product: "pms", alsoOpen: [] });
  });

  it("names what they can still open, so the screen is never a dead end", () => {
    const d = at({ entitlements: { cm: false, crs: true, pms: true }, requested: "cm", everTrialled: true });
    expect(d.kind === "locked" && d.alsoOpen).toEqual(["crs", "pms"]);
  });
});

describe("⚠️ a product they never had is not worth interrupting for", () => {
  it("sends them where they were going instead of onto a sales screen", () => {
    // They were trying to open the software they pay for. An offer for something else, in the way,
    // is an advert rather than help.
    expect(at({ entitlements: { cm: true, crs: false, pms: false }, requested: "pms" }))
      .toEqual({ kind: "elsewhere", product: "pms", instead: "cm" });
  });

  it("but DOES show the locked screen when they own nothing else", () => {
    // Now there is nowhere else to send them, and the offer is the only useful thing on the screen.
    expect(at({ entitlements: NONE, requested: "pms", everTrialled: true }).kind).toBe("locked");
  });
});

describe("⚠️ suspension is about the ACCOUNT, so it stops at the door", () => {
  it("refuses every status that is not active, whatever they own", () => {
    for (const status of ["suspended", "cancelled", "pending_signup", ""]) {
      const d = loginDestination({ tenantStatus: status, entitlements: ALL, requested: "cm" });
      expect(d).toMatchObject({ kind: "refused", reason: "suspended" });
      expect(refusalMessageFor(d)).toContain("suspended");
    }
  });

  it("says what to do, because contacting us is the only next step that exists", () => {
    expect(refusalMessageFor(loginDestination({ tenantStatus: "suspended", entitlements: ALL, requested: null })))
      .toBe("This account is suspended — contact Revio.");
  });
});

describe("an account with nothing switched on", () => {
  it("⚠️ refuses rather than opening an app with no screens in it", () => {
    // Every screen lives behind a product. A session here is a blank application.
    const d = at({ entitlements: NONE, requested: null });
    expect(d).toMatchObject({ kind: "refused", reason: "no-products" });
    expect(refusalMessageFor(d)).toMatch(/contact Revio/);
  });

  it("but lets a former trial in, because that one has a screen to land on", () => {
    expect(at({ entitlements: NONE, requested: null, everTrialled: true })).toMatchObject({ kind: "locked" });
  });
});

describe("productLabel", () => {
  it("gives the market name, which is what a message must say", () => {
    expect(productLabel("cm")).toBe("RevioLink");
    expect(productLabel("crs")).toBe("RevioCRS");
    expect(productLabel("pms")).toBe("RevioPMS");
  });
});

describe("⚠️ the three apps must not be able to disagree again", () => {
  it("gives one answer for every combination of status, entitlements and request", () => {
    /*
     * The drift this replaces was real: two apps refused where the third let them in. Walking the
     * whole space here is what makes "one front door" possible — a central login cannot be built on
     * three different opinions about what a correct password means.
     */
    const combos = [true, false].flatMap((cm) =>
      [true, false].flatMap((crs) =>
        [true, false].flatMap((pms) =>
          ([null, "cm", "crs", "pms"] as const).flatMap((requested) =>
            [true, false].map((everTrialled) => ({ cm, crs, pms, requested, everTrialled })),
          ),
        ),
      ),
    );
    for (const c of combos) {
      const d = loginDestination({
        tenantStatus: "active",
        entitlements: { cm: c.cm, crs: c.crs, pms: c.pms },
        requested: c.requested,
        everTrialled: c.everTrialled,
      });
      expect(["open", "locked", "elsewhere", "refused"]).toContain(d.kind);
      // An `open` answer is only ever given for a product they actually hold — the one invariant
      // that, if it broke, would let somebody into a product nobody is paying for.
      if (d.kind === "open") {
        expect({ cm: c.cm, crs: c.crs, pms: c.pms }[d.product]).toBe(true);
      }
    }
    expect(combos).toHaveLength(64);
  });
});
