import { describe, expect, it } from "vitest";
import { computeWaterfall, expandInventoryPeriods, SOLD_STATUSES, ROOM_OCCUPYING_STATUSES } from "./waterfall.js";

describe("availability waterfall", () => {
  it("computes the spec's worked example (50 total, 2 OOO, 1 hold, 35 confirmed → 12 remaining)", () => {
    const w = computeWaterfall({ physical: 50, outOfOrder: 2, closed: 0, holds: 1, confirmed: 35 });
    expect(w.available).toBe(48);
    expect(w.remaining).toBe(12);
  });

  it("defaults every layer to zero", () => {
    const w = computeWaterfall({ physical: 10 });
    expect(w).toMatchObject({ available: 10, remaining: 10, outOfOrder: 0, holds: 0 });
  });

  it("manual rooms-to-sell override replaces the physical base, not the holds/confirmed layers", () => {
    const w = computeWaterfall({ physical: 50, outOfOrder: 5, manualSellLimit: 20, holds: 2, confirmed: 10 });
    expect(w.available).toBe(20);
    expect(w.remaining).toBe(8);
  });

  it("a null override falls through to physical − ooo − closed", () => {
    const w = computeWaterfall({ physical: 30, outOfOrder: 3, closed: 7, manualSellLimit: null });
    expect(w.available).toBe(20);
  });

  it("closures and OOO can never push available below zero", () => {
    expect(computeWaterfall({ physical: 4, outOfOrder: 3, closed: 3 }).available).toBe(0);
  });

  it("remaining goes negative — that IS the overbooking signal", () => {
    expect(computeWaterfall({ physical: 5, confirmed: 6 }).remaining).toBe(-1);
  });
});

describe("expandInventoryPeriods", () => {
  const dates = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"];

  it("applies each period only inside its inclusive range", () => {
    const map = expandInventoryPeriods(
      [{ kind: "out_of_order", dateFrom: "2026-07-02", dateTo: "2026-07-03", rooms: 2 }],
      dates,
    );
    expect(map.get("2026-07-01")).toEqual({ outOfOrder: 0, closed: 0 });
    expect(map.get("2026-07-02")).toEqual({ outOfOrder: 2, closed: 0 });
    expect(map.get("2026-07-03")).toEqual({ outOfOrder: 2, closed: 0 });
    expect(map.get("2026-07-04")).toEqual({ outOfOrder: 0, closed: 0 });
  });

  it("stacks overlapping periods and separates OOO from closures", () => {
    const map = expandInventoryPeriods(
      [
        { kind: "out_of_order", dateFrom: "2026-07-01", dateTo: "2026-07-04", rooms: 1 },
        { kind: "out_of_order", dateFrom: "2026-07-02", dateTo: "2026-07-02", rooms: 2 },
        { kind: "closure", dateFrom: "2026-07-02", dateTo: "2026-07-03", rooms: 5 },
      ],
      dates,
    );
    expect(map.get("2026-07-02")).toEqual({ outOfOrder: 3, closed: 5 });
    expect(map.get("2026-07-03")).toEqual({ outOfOrder: 1, closed: 5 });
  });
});

describe("ROOM_OCCUPYING_STATUSES vs SOLD_STATUSES", () => {
  /**
   * These two lists were one list until request-to-book arrived. Keeping them apart is the whole
   * safety property: a request must take the room off sale everywhere (or an OTA sells it too) while
   * never counting as revenue the hotel has agreed to.
   */
  it("counts a request as occupying a room", () => {
    expect(ROOM_OCCUPYING_STATUSES).toContain("requested");
  });

  it("does NOT count a request as sold", () => {
    expect(SOLD_STATUSES).not.toContain("requested");
  });

  it("keeps every sold status occupying — a sale always holds its room", () => {
    for (const s of SOLD_STATUSES) expect(ROOM_OCCUPYING_STATUSES).toContain(s);
  });

  it("differs by exactly the request state, so nothing else drifted in", () => {
    const extra = ROOM_OCCUPYING_STATUSES.filter((s) => !SOLD_STATUSES.includes(s as never));
    expect(extra).toEqual(["requested"]);
  });
});

describe("the allocation is a cap, never a licence to oversell", () => {
  it("⚠️ an allocation can no longer out-sell the rooms that physically work", () => {
    /*
     * Found on 13 Sept while answering BUG-018, and in neither bug log.
     *
     * `available = manualSellLimit ?? base` replaced the base outright, so the allocation ignored
     * out-of-order units entirely. Ten rooms, three out of order, an allocation of eight: eight
     * went to the channel and seven existed.
     *
     * RevioPMS writes a RoomInventoryPeriod whenever a housekeeper or a maintenance job takes a
     * unit out of order — so a burst pipe on Tuesday left the OTA selling a room nobody could
     * sleep in, silently, because the number typed last month still looked reasonable.
     */
    const w = computeWaterfall({ physical: 10, outOfOrder: 3, manualSellLimit: 8 });
    expect(w.available).toBe(7);
    expect(w.cappedBy).toBe(1);
    expect(w.requested).toBe(8);
  });

  it("caps an allocation above the physical count (BUG-018)", () => {
    // 11 typed against 10 rooms. The grid already warned; the number still went out as 11.
    const w = computeWaterfall({ physical: 10, manualSellLimit: 11 });
    expect(w.available).toBe(10);
    expect(w.cappedBy).toBe(1);
  });

  it("⚠️ holding inventory back still works — that is what the override is FOR", () => {
    // The common, legitimate case must be untouched: sell only 5 of 10 through the channels.
    const w = computeWaterfall({ physical: 10, manualSellLimit: 5 });
    expect(w.available).toBe(5);
    expect(w.cappedBy).toBe(0);
  });

  it("says nothing was capped when nothing was", () => {
    expect(computeWaterfall({ physical: 10, outOfOrder: 2, manualSellLimit: 8 }).cappedBy).toBe(0);
    expect(computeWaterfall({ physical: 10 }).requested).toBeNull();
    expect(computeWaterfall({ physical: 10 }).cappedBy).toBe(0);
  });

  it("closures and OOO taking everything leaves nothing sellable, whatever was typed", () => {
    const w = computeWaterfall({ physical: 4, outOfOrder: 3, closed: 3, manualSellLimit: 4 });
    expect(w.available).toBe(0);
    expect(w.cappedBy).toBe(4);
  });

  it("⚠️ still reports a real overbooking as negative rather than absorbing it", () => {
    // remaining may go below zero — that IS the signal, and capping `available` must not hide it.
    const w = computeWaterfall({ physical: 10, outOfOrder: 8, manualSellLimit: 5, confirmed: 3 });
    expect(w.available).toBe(2);
    expect(w.remaining).toBe(-1);
  });
});

describe("§6 acceptance test — book, then cancel (BUG-015 / BUG-016)", () => {
  /*
   * The sequence Ventsislav's 13 Sept log asks for, at the level this function owns.
   *
   * Steps 4 and 8 of §6 are the two that were never verified, and they are the two that matter:
   * a system that decrements but never restores is WORSE than one that does neither — inventory
   * bleeds away with every cancellation and the hotel loses sellable nights without knowing.
   *
   * The push wiring either side of this is verified separately: `syncRealChannels` sends
   * `.remaining` (sync.ts), the pull calls it after importing, and both products' cancel paths go
   * through `recordPush`, which calls it with an unscoped — therefore total — push.
   */
  const APA2 = { physical: 10, outOfOrder: 0, closed: 0, manualSellLimit: 1 };

  it("step 2 — one room allocated, nothing sold, one bookable", () => {
    const w = computeWaterfall({ ...APA2, holds: 0, confirmed: 0 });
    expect(w.available).toBe(1);
    expect(w.remaining).toBe(1);
  });

  it("step 4 — the booking lands and the night becomes unsellable", () => {
    const w = computeWaterfall({ ...APA2, holds: 0, confirmed: 1 });
    expect(w.confirmed).toBe(1);
    // This is the number the channel is sent. "Rooms to sell" staying at 1 is the ALLOCATION, and
    // was never the figure in question — see BUG-017.
    expect(w.remaining).toBe(0);
  });

  it("⚠️ step 8 — cancelling gives the night back", () => {
    // Cancelling drops the line out of ROOM_OCCUPYING_STATUSES, so `confirmed` falls to 0 and the
    // night returns on its own. There is no separate "restore" path that could be forgotten.
    const w = computeWaterfall({ ...APA2, holds: 0, confirmed: 0 });
    expect(w.remaining).toBe(1);
  });

  it("a hold taken mid-booking also blocks the night, and releases it", () => {
    expect(computeWaterfall({ ...APA2, holds: 1, confirmed: 0 }).remaining).toBe(0);
    expect(computeWaterfall({ ...APA2, holds: 0, confirmed: 0 }).remaining).toBe(1);
  });

  it("⚠️ a cancellation arriving out of order cannot push the count above the allocation", () => {
    // §6's ordering case: a cancellation processed before its own booking. `confirmed` is derived by
    // counting live lines, never by incrementing and decrementing a stored total — so an
    // out-of-order arrival cannot drift the number. It is always a fresh count.
    expect(computeWaterfall({ ...APA2, holds: 0, confirmed: 0 }).remaining).toBe(1);
    expect(computeWaterfall({ ...APA2, holds: 0, confirmed: 0 }).available).toBe(1);
  });

  it("a modified reservation releases its old nights by counting the new ones", () => {
    // Same reason: the move rewrites the line's dates, and every date is recounted from the lines.
    const oldNight = computeWaterfall({ ...APA2, confirmed: 0 });
    const newNight = computeWaterfall({ ...APA2, confirmed: 1 });
    expect(oldNight.remaining).toBe(1);
    expect(newNight.remaining).toBe(0);
  });
});
