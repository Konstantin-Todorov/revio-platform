import { describe, expect, it } from "vitest";

/**
 * `getAdoption` reads the database, so what is tested here is the ARITHMETIC it performs, lifted
 * out as the same expressions. The value of the test is the two rules that are easy to get wrong
 * and impossible to see once they are wrong.
 */
const from7 = new Date("2026-09-16T00:00:00.000Z");

const tenants = [
  { id: "a", name: "Cabacum", isDemo: false, hasPms: true },
  { id: "b", name: "Chervena Vila", isDemo: false, hasPms: true },
  { id: "c", name: "Hotel Sofia", isDemo: true, hasPms: true },
  { id: "d", name: "No PMS here", isDemo: false, hasPms: false },
];
const usage = [
  { tenantId: "a", product: "pms", route: "/front-desk", day: new Date("2026-09-20T00:00:00.000Z") },
  { tenantId: "a", product: "pms", route: "/housekeeping", day: new Date("2026-09-20T00:00:00.000Z") },
  { tenantId: "c", product: "pms", route: "/front-desk", day: new Date("2026-09-02T00:00:00.000Z") },
  { tenantId: "d", product: "pms", route: "/front-desk", day: new Date("2026-09-20T00:00:00.000Z") },
];

const entitled = tenants.filter((t) => t.hasPms);
const forProduct = usage.filter((u) => u.product === "pms");
const opened30 = new Set(forProduct.map((u) => u.tenantId));
const opened7 = new Set(forProduct.filter((u) => u.day >= from7).map((u) => u.tenantId));

describe("adoption arithmetic", () => {
  it("counts only ENTITLED hotels, even when an unentitled one has usage rows", () => {
    // Tenant "d" opened a PMS screen but has no entitlement — a stale row, or a flag turned off
    // since. It must not inflate the denominator or the numerator.
    expect(entitled.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(entitled.filter((t) => opened30.has(t.id)).map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("separates 'ever opened' from 'opened this week' — the gap IS the signal", () => {
    // "c" last came in on the 2nd: inside 30 days, outside 7. A hotel that used to come in and
    // stopped is the thing this screen exists to surface, and collapsing the two windows hides it.
    expect(entitled.filter((t) => opened30.has(t.id)).length).toBe(2);
    expect(entitled.filter((t) => opened7.has(t.id)).length).toBe(1);
  });

  it("lists the entitled hotel with no usage at all, which is the renewal call", () => {
    expect(entitled.filter((t) => !opened30.has(t.id)).map((t) => t.name)).toEqual(["Chervena Vila"]);
  });

  it("keeps demo tenants in, per the standing rule that operations include them", () => {
    expect(entitled.some((t) => t.isDemo)).toBe(true);
  });
});
