import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * ⚠️ The product entitlement is a WRITE gate, not a layout gate.
 *
 * `(protected)/layout.tsx` renders `ProductLocked` when RevioCRS is off — but Next runs a server
 * action FIRST and re-renders the page afterwards, so that redirect lands after the mutation has
 * committed. Until this was added, a hotel whose trial had ended could keep re-pricing a season for
 * as long as its session lived. RevioPMS had asked since it was built; RevioLink and RevioCRS had
 * not, and this pins all three to the same answer.
 *
 * RLS is untouched by any of it: a hotel only ever reaches its own rows. This is the billing
 * boundary, which is the difference between a trial that ends and a trial that ends on paper.
 */
vi.mock("server-only", () => ({}));

const redirected: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: (to: string) => { redirected.push(to); throw new Error(`REDIRECT ${to}`); },
}));

const session = { role: "owner", entitlements: { channelManager: true, reservation: true, pms: false } };
const state = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("./session", () => ({ getSession: async () => state.value }));

import { guard, requireCapability } from "./authz";

beforeEach(() => { redirected.length = 0; state.value = { ...session, entitlements: { ...session.entitlements } }; });

describe("the RevioCRS entitlement gate", () => {
  it("lets an entitled owner through", async () => {
    const r = await guard("manageRates");
    expect(r.ok).toBe(true);
  });

  it("⚠️ refuses the write when RevioCRS is switched off", async () => {
    state.value = { ...session, entitlements: { ...session.entitlements, reservation: false } };
    const r = await guard("manageRates");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("switched off");
    // Never "you have not subscribed" — false for a hotel whose trial just ended, and the exact
    // sentence ProductLocked exists to stop us saying.
    expect(r.ok === false && r.error.toLowerCase()).not.toContain("subscrib");
  });

  it("⚠️ sends a void action to the screen that explains it, not to /login", async () => {
    state.value = { ...session, entitlements: { ...session.entitlements, reservation: false } };
    await expect(requireCapability("manageRates")).rejects.toThrow(/REDIRECT/);
    // /login would be a lie: they ARE signed in. /dashboard is where ProductLocked renders, with the
    // trial's end date, "nothing has been deleted" and the "I want to keep it" button.
    expect(redirected).toEqual(["/dashboard"]);
  });

  it("still refuses an unauthenticated caller first", async () => {
    state.value = null;
    const r = await guard("manageRates");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("session has expired");
  });
});
