import { describe, it, expect } from "vitest";
import { channexAddress } from "./channex-provision";

describe("channexAddress", () => {
  it("reads a Bulgarian line — post code before the town", () => {
    expect(channexAddress("бул. Приморски 10, 9000 Варна")).toEqual({ address: "бул. Приморски 10", city: "Варна", zip: "9000", country: "BG", state: "Варна" });
  });
  it("reads a western line — town before the post code", () => {
    expect(channexAddress("12 Main Street, Sofia 1000")).toMatchObject({ address: "12 Main Street", city: "Sofia", zip: "1000" });
  });
  it("takes the town from the last part when there is no post code, and the code from billing", () => {
    expect(channexAddress("ул. Морска 3, Созопол", { addressLine: null, city: "Бургас", postCode: "8130", country: "BG" }))
      .toMatchObject({ address: "ул. Морска 3", city: "Созопол", zip: "8130" });
  });
  it("uses the billing identity when the property has no address at all", () => {
    expect(channexAddress(null, { addressLine: "ул. Шипка 1", city: "Пловдив", postCode: "4000", country: "bg" }))
      .toEqual({ address: "ул. Шипка 1", city: "Пловдив", zip: "4000", country: "BG", state: "Пловдив" });
  });
  it("never sends Ruse for a hotel that told us its town", () => {
    expect(channexAddress("Main square 1, 5000 Велико Търново").city).toBe("Велико Търново");
  });

  it("finds a post code written as its own part, and keeps the town", () => {
    expect(channexAddress("Boyam Bachvarov str. 109, 9007, Chaika, Varna")).toEqual({
      address: "Boyam Bachvarov str. 109, Chaika", city: "Varna", zip: "9007", country: "BG", state: "Varna",
    });
  });

  it("does not mistake a lone post code for the town", () => {
    const a = channexAddress("ул. Морска 5, 8000");
    expect(a.zip).toBe("8000");
    expect(a.address).toBe("ул. Морска 5");
    expect(a.city).not.toBe("8000");
  });
});
