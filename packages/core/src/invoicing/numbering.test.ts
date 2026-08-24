import { describe, it, expect } from "vitest";
import {
  formatDocumentNumber, seriesKeyFor, seriesStartFor, isTaxDocument,
  type IssuedDocType,
} from "./numbering.js";

/**
 * ЗДДС чл. 114, ал. 1, т. 2 / ППЗДДС чл. 78 — "пореден десетразряден номер, съдържащ само арабски
 * цифри", ascending, no duplication, no gaps.
 *
 * What shipped first was `INV-2026-0001`: letters, separators, four digits, and a reset each
 * January. Each of those is independently disqualifying, so each has a test.
 */

const bg = (docType: IssuedDocType, claimed: bigint, year = 2026) =>
  formatDocumentNumber({ scheme: "bg_10digit", docType, claimed, year });

describe("bg_10digit", () => {
  it("gives a tax document ten digits and nothing else", () => {
    for (const d of ["invoice", "credit_note"] as const) {
      expect(bg(d, 1000000000n)).toMatch(/^\d{10}$/);
    }
  });

  it("carries no prefix, no year and no separator", () => {
    expect(bg("invoice", 1000000000n)).toBe("1000000000");
    expect(bg("invoice", 1000000000n)).not.toMatch(/[A-Za-z-]/);
  });

  it("does not restart at a year boundary", () => {
    // The defect that guaranteed a duplicate: the year was part of the printed number, so 2027
    // would have reissued every number from 2026.
    expect(bg("invoice", 1000000042n, 2026)).toBe(bg("invoice", 1000000042n, 2027));
    expect(bg("invoice", 1000000042n)).not.toBe(bg("invoice", 1000000043n));
  });

  it("pads a low number to ten digits", () => {
    expect(bg("invoice", 296n)).toBe("0000000296");
  });

  it("sorts in the order it counts", () => {
    const n = [1000000000n, 1000000001n, 1000000010n, 1000000100n].map((c) => bg("invoice", c));
    expect([...n].sort()).toEqual(n);
  });

  it("draws invoices and credit notes from ONE range", () => {
    // "Без дублиране" applies across all of a taxable person's documents. Two independent counters
    // would hand the same number to a фактура and an известие on the same day.
    expect(seriesKeyFor("bg_10digit", "invoice")).toBe(seriesKeyFor("bg_10digit", "credit_note"));
    expect(seriesKeyFor("bg_10digit", "invoice")).toBe("tax");
  });

  it("keeps a proforma out of the tax range entirely", () => {
    // Not a данъчен документ. It must neither consume a legal number nor look like one.
    expect(isTaxDocument("proforma")).toBe(false);
    expect(seriesKeyFor("bg_10digit", "proforma")).toBe("proforma");
    expect(bg("proforma", 1n)).toBe("PRO-2026-0001");
    expect(bg("proforma", 1n)).not.toMatch(/^\d{10}$/);
  });

  it("starts the tax range where the property says, and the proforma range at 1", () => {
    // A hotel already invoicing on paper needs its software range clear of its books.
    expect(seriesStartFor("bg_10digit", "invoice", 1000000000n)).toBe(1000000000n);
    expect(seriesStartFor("bg_10digit", "credit_note", 5000n)).toBe(5000n);
    expect(seriesStartFor("bg_10digit", "proforma", 1000000000n)).toBe(1n);
  });

  it("reaches the top of the ten-digit space", () => {
    expect(bg("invoice", 9999999999n)).toBe("9999999999");
  });
});

describe("prefixed", () => {
  const px = (docType: IssuedDocType, claimed: bigint, year = 2026) =>
    formatDocumentNumber({ scheme: "prefixed", docType, claimed, year });

  it("keeps the readable form for a jurisdiction that permits it", () => {
    expect(px("invoice", 1n)).toBe("INV-2026-0001");
    expect(px("credit_note", 7n)).toBe("CN-2026-0007");
    expect(px("proforma", 3n)).toBe("PRO-2026-0003");
  });

  it("keeps each document type on its own counter", () => {
    // Unlike the BG scheme: here the type is part of the printed number, so the ranges cannot
    // collide and separate counters are the natural fit.
    expect(seriesKeyFor("prefixed", "invoice")).toBe("invoice");
    expect(seriesKeyFor("prefixed", "credit_note")).toBe("credit_note");
  });

  it("starts every counter at 1 — there are no books to work around", () => {
    expect(seriesStartFor("prefixed", "invoice", 1000000000n)).toBe(1n);
  });
});
