import { describe, expect, it } from "vitest";
import { rateSourceNote } from "@revio/core";
import { inventory } from "./inventory";

/**
 * The calendar's price hovers are worded in RevioCRS (so they can be Bulgarian) while RevioLink still
 * reads core's `rateSourceNote`. The English here must stay word for word what core says, or the two
 * products explain the same price two ways.
 */
describe("Inventory Calendar English matches core", () => {
  const en = inventory.en.rateSource;
  it("default", () => expect(en.default("BB Flex")).toBe(rateSourceNote("default", "BB Flex")));
  it("derived", () => expect(en.derived("BB Flex")).toBe(rateSourceNote("derived", "NR", "BB Flex")));
  it("none", () => expect(en.none("BB Flex")).toBe(rateSourceNote("none", "BB Flex")));
});
