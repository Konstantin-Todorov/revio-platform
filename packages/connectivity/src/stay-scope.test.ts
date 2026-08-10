import { describe, it, expect } from "vitest";
import { stayScope } from "./sync.js";

/**
 * The scope a booking pushes with.
 *
 * This is the piece whose absence would have failed Channex certification test 9 outright: with no
 * scope, a push covers fourteen days from *today*, so a November reservation booked in August
 * produced a payload that never mentioned November. Channex would have read "expected an
 * availability update for 21 Nov, found none" — and a real hotel would have kept selling the room.
 */
describe("stayScope", () => {
  it("covers the nights slept in, and not the check-out day", () => {
    const s = stayScope([{ roomTypeId: "twin", checkIn: "2026-11-21", checkOut: "2026-11-24" }]);
    expect(s.dates).toEqual(["2026-11-21", "2026-11-22", "2026-11-23"]);
  });

  it("pushes availability only — a booking is not a price change or a restriction", () => {
    const s = stayScope([{ roomTypeId: "twin", checkIn: "2026-11-21", checkOut: "2026-11-22" }]);
    expect(s.fields).toEqual(["availability"]);
  });

  it("names only the room types that moved", () => {
    const s = stayScope([{ roomTypeId: "twin", checkIn: "2026-11-21", checkOut: "2026-11-22" }]);
    expect(s.roomTypeIds).toEqual(["twin"]);
  });

  it("keeps a one-night stay to a single date", () => {
    const s = stayScope([{ roomTypeId: "dbl", checkIn: "2026-11-25", checkOut: "2026-11-26" }]);
    expect(s.dates).toEqual(["2026-11-25"]);
  });

  it("takes Date objects as readily as strings — reservation lines carry Dates", () => {
    const s = stayScope([{
      roomTypeId: "twin",
      checkIn: new Date("2026-11-21T00:00:00Z"),
      checkOut: new Date("2026-11-23T00:00:00Z"),
    }]);
    expect(s.dates).toEqual(["2026-11-21", "2026-11-22"]);
  });

  it("unions a modification's old and new stay, so the nights given up go back on sale", () => {
    const s = stayScope([
      { roomTypeId: "twin", checkIn: "2026-11-21", checkOut: "2026-11-23" }, // was
      { roomTypeId: "twin", checkIn: "2026-11-22", checkOut: "2026-11-25" }, // is
    ]);
    expect(s.dates).toEqual(["2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24"]);
  });

  it("de-duplicates overlapping nights instead of pushing a date twice", () => {
    const s = stayScope([
      { roomTypeId: "twin", checkIn: "2026-11-21", checkOut: "2026-11-23" },
      { roomTypeId: "twin", checkIn: "2026-11-21", checkOut: "2026-11-23" },
    ]);
    expect(s.dates).toEqual(["2026-11-21", "2026-11-22"]);
    expect(s.roomTypeIds).toEqual(["twin"]);
  });

  it("carries every room type a multi-room booking touches", () => {
    const s = stayScope([
      { roomTypeId: "twin", checkIn: "2026-11-21", checkOut: "2026-11-22" },
      { roomTypeId: "dbl", checkIn: "2026-11-21", checkOut: "2026-11-22" },
    ]);
    expect([...s.roomTypeIds!].sort()).toEqual(["dbl", "twin"]);
  });

  it("returns dates sorted, so a merged date range is contiguous rather than shuffled", () => {
    const s = stayScope([
      { roomTypeId: "twin", checkIn: "2026-12-01", checkOut: "2026-12-03" },
      { roomTypeId: "twin", checkIn: "2026-11-28", checkOut: "2026-11-30" },
    ]);
    expect(s.dates).toEqual([...s.dates!].sort());
    expect(s.dates).toEqual(["2026-11-28", "2026-11-29", "2026-12-01", "2026-12-02"]);
  });

  it("crosses a month boundary without losing a night", () => {
    const s = stayScope([{ roomTypeId: "twin", checkIn: "2026-11-30", checkOut: "2026-12-02" }]);
    expect(s.dates).toEqual(["2026-11-30", "2026-12-01"]);
  });

  it("yields an EMPTY date list for a zero-night stay, never a silent full horizon", () => {
    // syncChannel distinguishes an absent scope ("do not narrow") from a present-but-empty one
    // ("narrowed to nothing"). Getting that backwards turns a no-op into a 14-day re-push.
    const s = stayScope([{ roomTypeId: "twin", checkIn: "2026-11-21", checkOut: "2026-11-21" }]);
    expect(s.dates).toEqual([]);
  });

  it("yields an empty scope for no stays at all", () => {
    const s = stayScope([]);
    expect(s.dates).toEqual([]);
    expect(s.roomTypeIds).toEqual([]);
  });
});
