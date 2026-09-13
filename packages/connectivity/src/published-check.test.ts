import { describe, it, expect } from "vitest";
import { comparePublished, summarisePublished, type ExpectedRate, type PublishedRate } from "./published-check.js";

const ours = (over: Partial<ExpectedRate> = {}): ExpectedRate => ({
  externalRateId: "ae6b1ed1", date: "2026-09-20", priceMinor: 66600,
  roomTypeName: "Apartment, 1 Bedroom", ratePlanName: "BB Flex", ...over,
});
const theirs = (over: Partial<PublishedRate> = {}): PublishedRate => ({
  externalRateId: "ae6b1ed1", date: "2026-09-20", priceMinor: 66600, ...over,
});

describe("comparePublished", () => {
  it("says match when the channel holds what we sent", () => {
    const [r] = comparePublished([ours()], [theirs()]);
    expect(r!.kind).toBe("match");
  });

  it("⚠️ reproduces the €666 fault from the destination end", () => {
    /*
     * 13 Sept: €666 was set on the 1-Bedroom. The 1-Bedroom's Channex plan still held €150 (it
     * never received it) and the 2-Bedroom's held 666 (it was never sent it). Read from our side
     * both pushes succeeded. Read from the destination, it is two findings that name each other.
     */
    const rows = comparePublished(
      [ours({ externalRateId: "1br-bar", priceMinor: 66600 })],
      [theirs({ externalRateId: "1br-bar", priceMinor: 15000 }),
       theirs({ externalRateId: "2br-bar", priceMinor: 66600 })],
    );
    const mismatch = rows.find((r) => r.kind === "mismatch")!;
    expect(mismatch.ours).toBe(66600);
    expect(mismatch.theirs).toBe(15000);
    expect(mismatch.roomTypeName).toBe("Apartment, 1 Bedroom");

    // And the other end: a price the channel publishes that we never sent to that plan.
    const stray = rows.find((r) => r.kind === "unexpected")!;
    expect(stray.externalRateId).toBe("2br-bar");
    expect(stray.theirs).toBe(66600);
  });

  it("⚠️ keeps 'missing' and 'mismatch' apart — different causes, different fixes", () => {
    // Never arrived = a mapping or a push that did not happen. Differs = it landed somewhere
    // unexpected or was overwritten. One count covering both sends somebody to the wrong screen.
    const rows = comparePublished(
      [ours({ date: "2026-09-20" }), ours({ date: "2026-09-21", priceMinor: 12278 })],
      [theirs({ date: "2026-09-20", priceMinor: 9900 })],
    );
    expect(rows.find((r) => r.date === "2026-09-20")!.kind).toBe("mismatch");
    expect(rows.find((r) => r.date === "2026-09-21")!.kind).toBe("missing");
  });

  it("does not call it missing when we never had a price either", () => {
    // An unpriced date is not a fault. Reporting it would bury the real findings in noise.
    expect(comparePublished([ours({ priceMinor: null })], [])).toEqual([]);
  });

  it("treats a published null as nothing published", () => {
    const [r] = comparePublished([ours()], [theirs({ priceMinor: null })]);
    expect(r!.kind).toBe("missing");
  });

  it("matches on the date as well as the plan", () => {
    const rows = comparePublished([ours({ date: "2026-09-20" })], [theirs({ date: "2026-09-21" })]);
    expect(rows.find((r) => r.kind === "missing")).toBeTruthy();
    expect(rows.find((r) => r.kind === "unexpected")).toBeTruthy();
  });
});

describe("summarisePublished", () => {
  it("says plainly when everything agrees", () => {
    const s = summarisePublished(comparePublished([ours()], [theirs()]));
    expect(s.headline).toMatch(/publishing exactly what we sent/);
    expect(s.matched).toBe(1);
  });

  it("⚠️ leads with what is wrong, counted by kind", () => {
    const s = summarisePublished(comparePublished(
      [ours({ date: "2026-09-20" }), ours({ date: "2026-09-21" })],
      [theirs({ date: "2026-09-20", priceMinor: 9900 }), theirs({ externalRateId: "2br-bar", date: "2026-09-22" })],
    ));
    expect(s.headline).toContain("1 published at a different price");
    expect(s.headline).toContain("1 never arrived");
    expect(s.headline).toContain("1 published that we did not send");
  });

  it("says there is nothing to check rather than implying all is well", () => {
    // "0 problems" on an empty check reads as a clean bill of health. It is not one.
    expect(summarisePublished([]).headline).toMatch(/Nothing to check/);
  });

  it("carries a handful of examples so the line is actionable on its own", () => {
    const many = Array.from({ length: 9 }, (_, i) => ours({ date: `2026-09-2${i}` }));
    const s = summarisePublished(comparePublished(many, []));
    expect(s.missing).toBe(9);
    expect(s.examples).toHaveLength(5);
  });
});
