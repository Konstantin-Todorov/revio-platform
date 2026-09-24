import { describe, expect, it } from "vitest";
import { hasArrived } from "./arrived";

describe("hasArrived", () => {
  it("a room placed by auto-assign is not an arrival", () => {
    expect(hasArrived([{ checkedInAt: null }])).toBe(false);
  });
  it("a check-in stamp on any of the rooms is", () => {
    expect(hasArrived([{ checkedInAt: null }, { checkedInAt: new Date() }])).toBe(true);
  });
  it("no rooms at all is not an arrival", () => {
    expect(hasArrived([])).toBe(false);
  });
});
