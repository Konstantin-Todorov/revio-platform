import { describe, expect, it } from "vitest";
import { epcPayload } from "./epc-qr";

const base = { name: "Weber BG EOOD", iban: "BG80 BNBG 9661 1020 3456 78", bic: "BNBGBGSF", amountMinor: 14160, currency: "EUR", reference: "0000001042" };

describe("epcPayload — the SEPA transfer QR", () => {
  it("lays out the eleven lines of EPC069-12 v002", () => {
    expect(epcPayload(base)!.split("\n")).toEqual([
      "BCD", "002", "1", "SCT", "BNBGBGSF", "Weber BG EOOD", "BG80BNBG96611020345678", "EUR141.60", "", "", "0000001042",
    ]);
  });

  it("writes the amount in euros with exactly two decimals, never a float", () => {
    expect(epcPayload({ ...base, amountMinor: 5 })!.split("\n")[7]).toBe("EUR0.05");
    expect(epcPayload({ ...base, amountMinor: 100000 })!.split("\n")[7]).toBe("EUR1000.00");
  });

  it("refuses rather than pre-fill something wrong", () => {
    expect(epcPayload({ ...base, currency: "BGN" })).toBeNull();
    expect(epcPayload({ ...base, amountMinor: 0 })).toBeNull();
    expect(epcPayload({ ...base, iban: "not an iban" })).toBeNull();
    expect(epcPayload({ ...base, name: "  " })).toBeNull();
  });

  it("leaves a malformed BIC out (it is optional) and caps the free text", () => {
    expect(epcPayload({ ...base, bic: "XX" })!.split("\n")[4]).toBe("");
    expect(epcPayload({ ...base, reference: "x".repeat(300) })!.split("\n")[10]).toHaveLength(140);
  });
});
