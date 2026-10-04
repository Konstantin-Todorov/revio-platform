import { describe, expect, it } from "vitest";
import { childrenNightMinor, parseChildAges, partyOf } from "./party";

describe("partyOf", () => {
  it("splits ages into infants, children and adults by the hotel's bands", () => {
    const p = partyOf(2, [1, 5, 14]);
    expect(p).toMatchObject({ adults: 2, pricedAdults: 3, children: 1, infants: 1, occupancy: 4 });
  });

  it("does not count an infant against the room's capacity", () => {
    expect(partyOf(2, [0]).occupancy).toBe(2);
  });

  it("follows the hotel's own bands", () => {
    const p = partyOf(2, [3, 12], { infantMax: 3, childMax: 12 });
    expect(p).toMatchObject({ infants: 1, children: 1, pricedAdults: 2 });
  });

  it("is just the adults with no children", () => {
    expect(partyOf(2)).toMatchObject({ pricedAdults: 2, children: 0, infants: 0, occupancy: 2 });
  });
});

describe("childrenNightMinor", () => {
  it("adds the child fee per child and the infant fee per infant", () => {
    expect(childrenNightMinor(partyOf(2, [1, 5, 8]), { childrenFeeMinor: 1500, infantFeeMinor: 0 })).toBe(3000);
  });
});

describe("parseChildAges", () => {
  it("keeps whole ages 0–17 and drops the rest", () => {
    expect(parseChildAges("4, 7,x,18,-1,3.5,0")).toEqual([4, 7, 0]);
    expect(parseChildAges("")).toEqual([]);
  });
});
