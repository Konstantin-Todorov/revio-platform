import { describe, it, expect } from "vitest";

/**
 * `DailyCell.ratePlanId` split one row per (room, date) into potentially several — one room-wide row
 * plus one per rate plan that names itself. Every reader written before that change keyed its map on
 * (room, date), which had been a unique key and silently stopped being one.
 *
 * A `Map` keyed that way does not error on a duplicate: it keeps whichever row the database returned
 * last, and Postgres makes no promise about that order. So a screen could show the Bed & Breakfast
 * plan's min-stay on the room row today and the room's own value tomorrow, from identical data.
 *
 * The fix is a filter, not a merge — `where: { ratePlanId: null }` at every ROOM-LEVEL read. This
 * file pins the collapse itself, because the mistake is not in any one query: it is the shape.
 *
 * Plan-aware readers (the Channex push in `sync.ts`) keep both maps deliberately and are covered by
 * `push-scope.test.ts`.
 */

interface Cell {
  roomTypeId: string;
  ratePlanId: string | null;
  date: string;
  minLos: number | null;
  inventory: number | null;
}

/** Twin on 25 Nov: the room says min-stay 2 and 1 room to sell; B&B alone says min-stay 10. */
const CELLS: Cell[] = [
  { roomTypeId: "twin", ratePlanId: null, date: "2026-11-25", minLos: 2, inventory: 1 },
  { roomTypeId: "twin", ratePlanId: "twin-bnb", date: "2026-11-25", minLos: 10, inventory: null },
];

/** What a room-level query returns once the filter is in place. */
const roomLevel = (cells: Cell[]) => cells.filter((c) => c.ratePlanId === null);

const byRoomAndDate = (cells: Cell[]) => new Map(cells.map((c) => [`${c.roomTypeId}|${c.date}`, c]));

describe("room-level DailyCell reads", () => {
  it("collapses to one row per (room, date) once plan cells are filtered out", () => {
    expect(byRoomAndDate(roomLevel(CELLS)).size).toBe(1);
  });

  it("keeps the room's own values, not a rate plan's", () => {
    const cell = byRoomAndDate(roomLevel(CELLS)).get("twin|2026-11-25");
    expect(cell?.minLos).toBe(2);
    expect(cell?.inventory).toBe(1);
  });

  it("is order-independent — the same answer whichever row the database returns first", () => {
    const forward = byRoomAndDate(roomLevel(CELLS)).get("twin|2026-11-25");
    const reversed = byRoomAndDate(roomLevel([...CELLS].reverse())).get("twin|2026-11-25");
    expect(forward).toEqual(reversed);
  });

  it("without the filter, row order decides the answer — the bug this guards", () => {
    const forward = byRoomAndDate(CELLS).get("twin|2026-11-25");
    const reversed = byRoomAndDate([...CELLS].reverse()).get("twin|2026-11-25");
    expect(forward!.minLos).not.toBe(reversed!.minLos);
    // And the manual sell limit disappears entirely, which reads as "no limit" to the waterfall.
    expect(forward!.inventory).toBeNull();
  });

  it("leaves a room with no plan-scoped cells completely unchanged", () => {
    const plain: Cell[] = [{ roomTypeId: "dbl", ratePlanId: null, date: "2026-11-25", minLos: 3, inventory: 4 }];
    expect(roomLevel(plain)).toEqual(plain);
  });
});
