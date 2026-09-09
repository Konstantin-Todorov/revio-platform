import { describe, it, expect } from "vitest";

/**
 * Which rate plans a bulk price change actually reaches — and what it must say about the rest.
 *
 * ## The incident this is written from
 *
 * The first real hotel, 2026-09-09. They opened Bulk update, ticked their rate plans, typed prices,
 * were told the update had applied — and the prices were not there. Checked against production:
 * two of three plans had prices, the third had none, and the audit entry agreed with the screen.
 *
 * Three things lined up, and each on its own was survivable:
 *
 * 1. `getRoomsAndRates` has no `active` filter, so the picker offered **Standard Rate**, which was
 *    inactive.
 * 2. The writer filters `active: true`, so it **silently dropped** that plan.
 * 3. `affected` counted room × date rather than rows written, so the count it reported was the count
 *    it would have written if nothing had been dropped.
 *
 * The result was a confident "done" over a partial apply. These tests pin the rules that stop that,
 * as pure functions mirroring the writer — the writer itself needs a database, and the property that
 * broke is a decision, not a query.
 */

type Plan = { id: string; name: string; active: boolean; priceLogic: "manual" | "derived" };

/** What the picker is allowed to offer. Mirrors `BulkUpdatePanel`. */
function offerable(plans: Plan[]): Plan[] {
  return plans.filter((p) => p.priceLogic === "manual" && p.active !== false);
}

/** What the writer will actually price, and why it refused the rest. Mirrors `writeBulk`. */
function resolveTargets(plans: Plan[], requestedIds: string[]) {
  const priceable = plans.filter((p) => p.active && p.priceLogic === "manual" && requestedIds.includes(p.id));
  const dropped = plans
    .filter((p) => requestedIds.includes(p.id) && !priceable.some((q) => q.id === p.id))
    .map((p) => ({ name: p.name, why: !p.active ? "inactive" : "derived — it follows its parent" }));
  return { targets: priceable.map((p) => p.id), dropped };
}

const PLANS: Plan[] = [
  { id: "std", name: "Standard Rate", active: false, priceLogic: "manual" },
  { id: "bb", name: "BB Flex", active: true, priceLogic: "manual" },
  { id: "nr", name: "BB Non-Refundable", active: true, priceLogic: "manual" },
  { id: "der", name: "Mobile -10%", active: true, priceLogic: "derived" },
];

describe("what the picker may offer", () => {
  /*
   * THE fix. Offering a plan the writer will throw away is how an operator ends up confidently
   * pricing nothing — and the best error message is the one nobody has to read.
   */
  it("never offers a plan that cannot hold a price", () => {
    expect(offerable(PLANS).map((p) => p.id)).toEqual(["bb", "nr"]);
  });

  it("excludes derived plans, which follow their parent", () => {
    expect(offerable(PLANS).some((p) => p.id === "der")).toBe(false);
  });
});

describe("what the writer does with a plan it cannot price", () => {
  /*
   * The exact shape of the incident: an inactive plan was requested, and the apply reported success
   * without mentioning it.
   */
  it("NAMES an inactive plan it dropped, rather than discarding it in silence", () => {
    const { targets, dropped } = resolveTargets(PLANS, ["std", "bb"]);
    expect(targets).toEqual(["bb"]);
    expect(dropped).toEqual([{ name: "Standard Rate", why: "inactive" }]);
  });

  it("still writes the plans it CAN price — a partial apply is legitimate, silence is not", () => {
    // Refusing the whole thing would be its own failure: the plans that can hold a price should.
    expect(resolveTargets(PLANS, ["std", "bb", "nr"]).targets).toEqual(["bb", "nr"]);
  });

  it("explains a derived plan differently from an inactive one", () => {
    // Two different things to do about it. One message for both sends somebody to the wrong screen.
    expect(resolveTargets(PLANS, ["der"]).dropped).toEqual([
      { name: "Mobile -10%", why: "derived — it follows its parent" },
    ]);
  });

  it("says nothing when everything requested was priced", () => {
    // A warning that fires on the happy path is a warning people learn to ignore.
    expect(resolveTargets(PLANS, ["bb", "nr"]).dropped).toEqual([]);
  });

  it("leaves nothing to write when every requested plan was dropped", () => {
    // This is the case that must become a refusal with a reason, never a green "applied".
    const { targets, dropped } = resolveTargets(PLANS, ["std", "der"]);
    expect(targets).toEqual([]);
    expect(dropped).toHaveLength(2);
  });
});

describe("what a room with no matching plan means", () => {
  /**
   * `affected` counted room × date whether or not a price was written, so a rate run over a room
   * that no selected plan is sold on reported cells it had not touched.
   */
  const countWrites = (rooms: string[], plansForRoom: Record<string, string[]>, dates: number) => {
    let written = 0;
    const unreached: string[] = [];
    for (const r of rooms) {
      const plans = plansForRoom[r] ?? [];
      if (plans.length === 0) unreached.push(r);
      written += plans.length * dates;
    }
    return { written, unreached };
  };

  it("counts rows written, not rooms iterated", () => {
    const r = countWrites(["a", "b"], { a: ["bb"], b: [] }, 30);
    expect(r.written).toBe(30); // not 60
    expect(r.unreached).toEqual(["b"]);
  });

  it("names the room that got nothing, so the operator can see why", () => {
    expect(countWrites(["a"], {}, 30).unreached).toEqual(["a"]);
  });
});
