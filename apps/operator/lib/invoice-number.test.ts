import { describe, it, expect } from "vitest";
import { formatInvoiceNumber } from "./invoice-lines";

/**
 * ЗДДС чл. 114, ал. 1, т. 2 — "пореден десетразряден номер, съдържащ само арабски цифри".
 *
 * Ten digits, Arabic numerals only, ascending, no duplication, no gaps. The first version of this
 * shipped as `REV-2026-0001`, which fails on letters, on separators, and on restarting each January.
 */
describe("formatInvoiceNumber", () => {
  it("is exactly ten digits and nothing but digits", () => {
    for (const n of [1n, 296n, 1000000000n, 9999999999n]) {
      expect(formatInvoiceNumber(n)).toMatch(/^\d{10}$/);
    }
  });

  it("pads a short number rather than emitting a short one", () => {
    // The user's existing books are at 0000000296 — that IS the format, not a display flourish.
    expect(formatInvoiceNumber(296n)).toBe("0000000296");
    expect(formatInvoiceNumber(1n)).toBe("0000000001");
  });

  it("renders the software's range unpadded, because it is already ten digits", () => {
    expect(formatInvoiceNumber(1000000000n)).toBe("1000000000");
    expect(formatInvoiceNumber(1000000001n)).toBe("1000000001");
  });

  it("carries no prefix, no year and no separator", () => {
    const s = formatInvoiceNumber(1000000000n);
    expect(s).not.toMatch(/[A-Za-z-]/);
  });

  it("sorts in the same order as it counts", () => {
    // An accountant reads these as a sorted list; zero-padding is what makes string order match
    // numeric order. Without it 1000000010 sorts before 100000002.
    const nums = [1000000000n, 1000000001n, 1000000010n, 1000000100n].map(formatInvoiceNumber);
    expect([...nums].sort()).toEqual(nums);
  });

  it("handles the top of the ten-digit space without overflowing", () => {
    // 9999999999 exceeds a 32-bit integer, which is why the column is BigInt.
    expect(formatInvoiceNumber(9999999999n)).toBe("9999999999");
    expect(Number.isSafeInteger(Number(9999999999n))).toBe(true);
  });

  it("never repeats across a year boundary", () => {
    // The whole point of dropping the year from the key: an annual reset guarantees a duplicate.
    const a = formatInvoiceNumber(1000000042n);
    const b = formatInvoiceNumber(1000000043n);
    expect(a).not.toBe(b);
  });
});
