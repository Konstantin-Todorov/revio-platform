import { describe, it, expect } from "vitest";
import { summariseFault } from "./fault-summary.js";

/** The exact message found in production on 2026-09-02, abbreviated. */
const PRISMA_NAN = `
Invalid \`prisma.ratePrice.upsert()\` invocation:

{
  where: { roomTypeId_ratePlanId_date_occupancy: { roomTypeId: "cmr5tqxgk00051f7moviw11fi" } },
  update: { priceMinor: NaN, source: "calendar" }
}
`;

describe("summariseFault — a stack trace routes a fault nowhere", () => {
  it("turns the production Prisma NaN dump into a sentence", () => {
    const s = summariseFault(PRISMA_NAN, "/calendar");
    expect(s.headline).toBe("A rate price was saved with a value that isn't a number on /calendar");
    expect(s.kind).toBe("invalid_value");
    expect(s.ourBug).toBe(true);
  });

  it("never leaks internal ids into the headline", () => {
    expect(summariseFault(PRISMA_NAN, "/calendar").headline).not.toContain("cmr5tqxgk");
  });

  it("makes a camelCase model readable", () => {
    expect(summariseFault("Invalid `prisma.roomTypePhoto.create()` invocation:\nboom").headline)
      .toContain("room type photo");
  });

  it("names a unique-constraint clash as a clash", () => {
    const s = summariseFault("Invalid `prisma.channel.create()` invocation:\nUnique constraint failed on the fields: (`code`)");
    expect(s.kind).toBe("conflict");
    expect(s.headline).toContain("already exists");
  });

  it("names a missing required value", () => {
    const s = summariseFault("Invalid `prisma.invoice.create()` invocation:\nArgument `period` is missing.");
    expect(s.kind).toBe("invalid_value");
    expect(s.headline).toContain("without a required value");
  });

  it("separates OUR defects from the environment's", () => {
    expect(summariseFault(PRISMA_NAN).ourBug).toBe(true);
    expect(summariseFault("fetch failed: ENOTFOUND app.channex.io").ourBug).toBe(false);
  });

  it("recognises an upstream refusal and a timeout", () => {
    expect(summariseFault("Channex GET /properties → 401: unauthorized").kind).toBe("permission");
    expect(summariseFault("socket hang up").kind).toBe("timeout");
  });

  it("falls back to the first line rather than guessing", () => {
    // Better a short true thing than a confident wrong one on a fault we have not seen.
    expect(summariseFault("Something odd happened\nand then more detail").headline)
      .toBe("Something odd happened");
  });

  it("truncates a very long first line instead of filling the row", () => {
    const s = summariseFault("x".repeat(400));
    expect(s.headline.length).toBeLessThanOrEqual(140);
    expect(s.headline.endsWith("…")).toBe(true);
  });

  it("survives an empty message", () => {
    expect(summariseFault("").headline).toBe("Unknown error");
  });

  it("omits the route when there isn't one", () => {
    expect(summariseFault(PRISMA_NAN).headline).not.toContain(" on ");
  });
});
