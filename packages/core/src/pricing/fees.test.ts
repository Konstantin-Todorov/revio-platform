import { describe, expect, it } from "vitest";
import { computeStayCharges, feeAmount, isCityTax, type StayFee, type StayShape } from "./fees.js";

/**
 * These lock the contract between the booking quote and the PMS folio. A failure here means a guest
 * could be quoted one number and billed another.
 */

const stay: StayShape = { accommodationMinor: 24000, nights: 2, rooms: 1, guests: 2 };

const vat: StayFee = { name: "VAT", type: "percent", pct: 9, basis: "per_stay" };
const cityTax: StayFee = { name: "City Tax", type: "fixed", amountMinor: 150, basis: "per_person" };
const cleaning: StayFee = { name: "Cleaning", type: "fixed", amountMinor: 2000, basis: "per_stay" };

describe("feeAmount", () => {
  it("charges a percentage of accommodation", () => {
    expect(feeAmount(vat, stay)).toBe(2160); // 9% of 240.00
  });

  it("multiplies a fixed fee by its basis", () => {
    expect(feeAmount({ ...cleaning, basis: "per_stay" }, stay)).toBe(2000);
    expect(feeAmount({ ...cleaning, basis: "per_night" }, stay)).toBe(4000);
    expect(feeAmount({ ...cleaning, basis: "per_room" }, stay)).toBe(2000);
    expect(feeAmount({ ...cleaning, basis: "per_person" }, stay)).toBe(4000);
  });

  it("treats an unknown basis as per-stay rather than throwing on a guest", () => {
    expect(feeAmount({ ...cleaning, basis: "per_wombat" }, stay)).toBe(2000);
  });

  it("rounds to whole minor units — money is never fractional", () => {
    // 7.5% of 100.05 = 7.50375 → must land on a real cent.
    const odd = feeAmount({ name: "X", type: "percent", pct: 7.5, basis: "per_stay" }, { ...stay, accommodationMinor: 10005 });
    expect(Number.isInteger(odd)).toBe(true);
    expect(odd).toBe(750);
  });

  it("returns 0 for a percentage fee with no percentage set", () => {
    expect(feeAmount({ name: "X", type: "percent", pct: null, basis: "per_stay" }, stay)).toBe(0);
  });
});

describe("computeStayCharges", () => {
  it("adds accommodation and every applicable fee", () => {
    const r = computeStayCharges({ stay, fees: [vat, cityTax] });
    expect(r.accommodationMinor).toBe(24000);
    expect(r.lines.map((l) => [l.name, l.amountMinor])).toEqual([["VAT", 2160], ["City Tax", 300]]);
    expect(r.totalMinor).toBe(24000 + 2160 + 300);
  });

  it("never charges tax on tax", () => {
    // VAT is 9% of ACCOMMODATION (240.00), not of accommodation-plus-cleaning.
    const r = computeStayCharges({ stay, fees: [cleaning, vat] });
    expect(r.lines.find((l) => l.name === "VAT")!.amountMinor).toBe(2160);
  });

  it("skips a fee already included in the rate", () => {
    const r = computeStayCharges({ stay, fees: [{ ...vat, inclusion: "included" }] });
    expect(r.lines).toHaveLength(0);
    expect(r.totalMinor).toBe(24000);
  });

  it("skips an inactive fee", () => {
    const r = computeStayCharges({ stay, fees: [{ ...vat, active: false }] });
    expect(r.lines).toHaveLength(0);
  });

  it("suppresses city tax when the property folds it into the rate", () => {
    // Charging it here as well would bill the guest twice for the same tax.
    const r = computeStayCharges({ stay, fees: [vat, cityTax], cityTaxIncluded: true });
    expect(r.lines.map((l) => l.name)).toEqual(["VAT"]);
    expect(r.totalMinor).toBe(24000 + 2160);
  });

  it("still charges city tax when the property does not include it", () => {
    const r = computeStayCharges({ stay, fees: [cityTax], cityTaxIncluded: false });
    expect(r.lines.map((l) => l.name)).toEqual(["City Tax"]);
  });

  it("omits zero-value fees rather than showing a 0.00 line", () => {
    const r = computeStayCharges({ stay, fees: [{ name: "Nothing", type: "fixed", amountMinor: 0, basis: "per_stay" }] });
    expect(r.lines).toHaveLength(0);
  });

  it("tags lines so the folio can post them with the right kind", () => {
    const r = computeStayCharges({ stay, fees: [vat, cityTax] });
    expect(r.lines.map((l) => l.kind)).toEqual(["tax", "fee"]);
  });

  it("includes chosen extras in the total", () => {
    const r = computeStayCharges({ stay, fees: [vat], extrasMinor: 5000 });
    expect(r.totalMinor).toBe(24000 + 2160 + 5000);
  });

  it("is stable — quoting twice gives the same number", () => {
    // The invariant the whole flow rests on: the price cannot move between screens.
    const a = computeStayCharges({ stay, fees: [vat, cityTax, cleaning] });
    const b = computeStayCharges({ stay, fees: [vat, cityTax, cleaning] });
    expect(a.totalMinor).toBe(b.totalMinor);
  });

  it("handles a stay with no fees at all", () => {
    const r = computeStayCharges({ stay, fees: [] });
    expect(r.totalMinor).toBe(24000);
    expect(r.lines).toEqual([]);
  });
});

describe("isCityTax", () => {
  it("matches the wordings a hotel actually types", () => {
    for (const n of ["City Tax", "city tax", "CITY TAX", "Citytax", "Sofia City Tax"]) {
      expect(isCityTax(n), n).toBe(true);
    }
  });

  it("does not match unrelated fees", () => {
    for (const n of ["VAT", "Cleaning", "Resort Fee", "Taxi"]) {
      expect(isCityTax(n), n).toBe(false);
    }
  });
});
