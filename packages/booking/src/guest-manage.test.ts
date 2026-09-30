import { describe, expect, it } from "vitest";
import { manageAbility, manageTokenMatches, mintManageToken } from "./guest-manage.js";

const base = { status: "confirmed", checkIn: "2026-11-10", today: "2026-11-01", onlinePaidMinor: null, balanceChargedAt: null };

describe("manageAbility", () => {
  it("lets a guest cancel and move an unpaid stay before arrival", () => {
    expect(manageAbility(base)).toEqual({ canCancel: true, canChange: true, changeBlock: null });
  });

  it("allows cancelling on the arrival day but not moving it", () => {
    const a = manageAbility({ ...base, today: "2026-11-10" });
    expect(a.canCancel).toBe(true);
    expect(a.canChange).toBe(false);
    expect(a.changeBlock).toBe("started");
  });

  it("closes both once the arrival day has passed", () => {
    expect(manageAbility({ ...base, today: "2026-11-11" }).canCancel).toBe(false);
  });

  it("refuses a date change once money moved online — that is the hotel's conversation", () => {
    expect(manageAbility({ ...base, onlinePaidMinor: 6690 })).toMatchObject({ canCancel: true, canChange: false, changeBlock: "paid_online" });
    expect(manageAbility({ ...base, balanceChargedAt: new Date() })).toMatchObject({ canChange: false, changeBlock: "paid_online" });
  });

  it("lets a guest withdraw a request the hotel has not accepted, but not move it", () => {
    expect(manageAbility({ ...base, status: "requested" })).toMatchObject({ canCancel: true, canChange: false, changeBlock: "not_confirmed" });
  });

  it("offers nothing on a cancelled or departed stay", () => {
    expect(manageAbility({ ...base, status: "cancelled" })).toMatchObject({ canCancel: false, canChange: false });
    expect(manageAbility({ ...base, departedAt: new Date() })).toMatchObject({ canCancel: false, canChange: false });
  });
});

describe("manage token", () => {
  it("is long, URL-safe and unique", () => {
    const a = mintManageToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(mintManageToken()).not.toBe(a);
  });

  it("matches only the exact token, and never an empty one", () => {
    const t = mintManageToken();
    expect(manageTokenMatches(t, t)).toBe(true);
    expect(manageTokenMatches(t, t.slice(0, -1))).toBe(false);
    expect(manageTokenMatches(t, `${t}x`)).toBe(false);
    expect(manageTokenMatches(null, "")).toBe(false);
    expect(manageTokenMatches(t, null)).toBe(false);
    expect(manageTokenMatches("", "")).toBe(false);
  });
});
