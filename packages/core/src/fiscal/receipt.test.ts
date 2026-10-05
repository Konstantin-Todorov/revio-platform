import { describe, expect, it } from "vitest";
import { allocateExactly, buildFiscalReceipt, defaultFiscalTaxGroups, taxGroupNumber } from "./receipt";

const VAT = defaultFiscalTaxGroups(true);
const room = (amountMinor: number) => ({ amountMinor, taxCategory: "reduced", outlet: "room" });
const bar = (amountMinor: number) => ({ amountMinor, taxCategory: "standard", outlet: "bar" });
const cityTax = (amountMinor: number) => ({ amountMinor, taxCategory: "city_tax", outlet: "other" });

describe("allocateExactly", () => {
  it("always sums to the total, for awkward splits", () => {
    for (const total of [1, 7, 100, 9999, 123457]) {
      for (const w of [[1, 1, 1], [3, 7], [1, 2, 3, 4, 5], [100000, 1], [33, 33, 34]]) {
        expect(allocateExactly(total, w).reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });
  it("is proportional", () => {
    expect(allocateExactly(100, [1, 3])).toEqual([25, 75]);
  });
  it("gives the odd cent to the largest remainder, ties to the first", () => {
    expect(allocateExactly(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });
});

describe("buildFiscalReceipt", () => {
  it("pays the whole stay: one line per tax group, totals exact", () => {
    const r = buildFiscalReceipt({ amountMinor: 21500, method: "card", charges: [room(19200), bar(1700), cityTax(600)], groups: VAT });
    expect(r.items.map((i) => [i.text, i.taxGroup, i.amountMinor])).toEqual([
      ["Нощувки", taxGroupNumber("Г"), 19200],
      ["Храна и напитки", taxGroupNumber("Б"), 1700],
      ["Туристически данък", taxGroupNumber("А"), 600],
    ]);
    expect(r.paymentType).toBe("card");
    expect(r.totalMinor).toBe(21500);
  });

  it("a part payment is split the way the stay is split, and still adds up to the cent", () => {
    const r = buildFiscalReceipt({ amountMinor: 5000, method: "cash", charges: [room(19200), bar(1700), cityTax(600)], groups: VAT });
    expect(r.items.reduce((a, b) => a + b.amountMinor, 0)).toBe(5000);
    expect(r.items[0]!.amountMinor).toBeGreaterThan(r.items[1]!.amountMinor);
    expect(r.totalMinor).toBe(5000);
  });

  it("a deposit before any night is posted prints as an advance for accommodation", () => {
    const r = buildFiscalReceipt({ amountMinor: 10000, method: "card", charges: [], groups: VAT });
    expect(r.items).toEqual([{ text: "Аванс за нощувки", taxGroup: taxGroupNumber("Г"), amountMinor: 10000 }]);
  });

  it("a hotel not registered for VAT prints everything in group А", () => {
    const r = buildFiscalReceipt({ amountMinor: 21500, method: "cash", charges: [room(19200), bar(1700), cityTax(600)], groups: defaultFiscalTaxGroups(false) });
    expect(new Set(r.items.map((i) => i.taxGroup))).toEqual(new Set([1]));
  });

  it("a discount reduces its own group, and a group that nets to zero is not printed", () => {
    const r = buildFiscalReceipt({
      amountMinor: 19200,
      method: "card",
      charges: [room(20000), { amountMinor: -800, taxCategory: "reduced", outlet: "room" }, bar(500), { amountMinor: -500, taxCategory: "standard", outlet: "bar" }],
      groups: VAT,
    });
    expect(r.items.map((i) => [i.text, i.amountMinor])).toEqual([["Нощувки", 19200]]);
  });

  it("an unknown or missing tax category is never guessed into 20% — it prints as exempt (А)", () => {
    const r = buildFiscalReceipt({ amountMinor: 1000, method: "cash", charges: [{ amountMinor: 1000, taxCategory: null, outlet: "extra" }], groups: VAT });
    expect(r.items[0]!.taxGroup).toBe(taxGroupNumber("А"));
  });

  it("refuses a zero, negative or fractional amount", () => {
    for (const amountMinor of [0, -100, 10.5]) {
      expect(() => buildFiscalReceipt({ amountMinor, method: "cash", charges: [room(100)], groups: VAT })).toThrow();
    }
  });

  it("labels fit the narrowest common device line (Datecs DP-25: 22 characters)", () => {
    const r = buildFiscalReceipt({ amountMinor: 3000, method: "cash", charges: [room(1), bar(1), cityTax(1), { amountMinor: 1, taxCategory: "standard", outlet: "spa" }, { amountMinor: 1, taxCategory: "standard", outlet: "other" }], groups: VAT });
    for (const i of r.items) expect(i.text.length).toBeLessThanOrEqual(22);
  });
});
