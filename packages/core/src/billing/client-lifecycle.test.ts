import { describe, expect, it } from "vitest";
import {
  ACCOUNT_TYPES, RETENTION_DAYS, defaultBillingFor, isBillable, isOurs, nextStatuses, retentionEndsAt, statusView,
} from "./client-lifecycle.js";

describe("account types", () => {
  it("demo and test are ours; live and pilot are business", () => {
    expect(ACCOUNT_TYPES.filter((t) => isOurs(t.key)).map((t) => t.key)).toEqual(["demo", "test"]);
  });

  it("a pilot starts free, ours start unbilled, a live client pays", () => {
    expect(defaultBillingFor("live")).toBe("paying");
    expect(defaultBillingFor("pilot")).toBe("free");
    expect(defaultBillingFor("demo")).toBe("none");
    expect(defaultBillingFor("test")).toBe("none");
  });
});

describe("isBillable", () => {
  const dec = new Date("2026-12-01T00:00:00Z");
  const jan = new Date("2027-01-01T00:00:00Z");
  const pilot = { accountType: "pilot" as const, billingMode: "free" as const, freeUntil: new Date("2026-12-28T00:00:00Z"), status: "active" };

  it("a free pilot is not billed for the month its free period ends in, and is billed after", () => {
    expect(isBillable(pilot, dec)).toBe(false);
    expect(isBillable(pilot, jan)).toBe(true);
  });

  it("free with no end date is never billed", () => {
    expect(isBillable({ ...pilot, freeUntil: null }, jan)).toBe(false);
  });

  it("nothing is billed while suspended or closed", () => {
    for (const status of ["suspended", "closed", "pending_signup"]) {
      expect(isBillable({ ...pilot, billingMode: "paying", status }, jan)).toBe(false);
    }
  });

  it("an account of ours is billed only when set to paying on purpose", () => {
    expect(isBillable({ accountType: "demo", billingMode: "none", freeUntil: null, status: "active" }, jan)).toBe(false);
    expect(isBillable({ accountType: "demo", billingMode: "paying", freeUntil: null, status: "active" }, jan)).toBe(true);
  });
});

describe("status", () => {
  it("suspension is always one step back, closing is always reachable, and closed can only reopen", () => {
    expect(nextStatuses("active").map((n) => n.action)).toEqual(["suspend", "close"]);
    expect(nextStatuses("suspended").map((n) => n.action)).toEqual(["reinstate", "close"]);
    expect(nextStatuses("closed").map((n) => n.action)).toEqual(["reopen"]);
    expect(nextStatuses("pending_signup")).toEqual([]);
  });

  it("keeps a closed client for the retention window and says until when", () => {
    const closedAt = new Date("2026-09-28T00:00:00Z");
    expect(retentionEndsAt(closedAt).toISOString().slice(0, 10)).toBe("2026-12-27");
    expect(RETENTION_DAYS).toBe(90);
    expect(statusView("closed", closedAt).detail).toContain("2026-12-27");
  });
});
