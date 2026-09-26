import { describe, expect, it } from "vitest";
import { rateSourceNote } from "@revio/core";
import { calendar } from "./calendar";

/** RevioLink words core's price-source hover itself; the English must stay core's, word for word. */
describe("Calendar English matches core", () => {
  const en = calendar.en.rateSource;
  it("default", () => expect(en.default("BB Flex")).toBe(rateSourceNote("default", "BB Flex")));
  it("derived", () => expect(en.derived("BB Flex")).toBe(rateSourceNote("derived", "NR", "BB Flex")));
  it("none", () => expect(en.none("BB Flex")).toBe(rateSourceNote("none", "BB Flex")));
});
