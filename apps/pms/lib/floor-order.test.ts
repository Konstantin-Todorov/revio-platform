import { describe, expect, it } from "vitest";
import { moveFloorInOrder, orderFloors } from "./floor-order";

describe("orderFloors", () => {
  it("by number when the hotel has chosen nothing — 2 before 10, named floors last", () => {
    expect(orderFloors(["10", "Annex", "2", "Floor 1", "Ground"])).toEqual(["Floor 1", "2", "10", "Annex", "Ground"]);
  });
  it("the hotel's order wins, and floors it does not name follow", () => {
    expect(orderFloors(["1", "2", "5", "Мансарда"], ["5", "1"])).toEqual(["5", "1", "2", "Мансарда"]);
  });
  it("a saved floor with no rooms left is not shown", () => {
    expect(orderFloors(["1", "2"], ["3", "2", "1"])).toEqual(["2", "1"]);
  });
  it("ignores blanks and duplicates", () => {
    expect(orderFloors([" 1", "1", "", "  "])).toEqual(["1"]);
  });
});

describe("moveFloorInOrder", () => {
  it("swaps with the neighbour, and does nothing past either end", () => {
    expect(moveFloorInOrder(["1", "2", "3"], "3", -1)).toEqual(["1", "3", "2"]);
    expect(moveFloorInOrder(["1", "2", "3"], "1", -1)).toEqual(["1", "2", "3"]);
    expect(moveFloorInOrder(["1", "2", "3"], "3", 1)).toEqual(["1", "2", "3"]);
  });
});
