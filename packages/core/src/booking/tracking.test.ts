import { describe, expect, it } from "vitest";
import { needsConsent, normaliseGa4Id, normaliseMetaPixelId } from "./tracking";

describe("the hotel's tags on its booking page", () => {
  it("accepts a GA4 measurement id, whatever the case and spacing", () => {
    expect(normaliseGa4Id(" g-abc123xyz ")).toBe("G-ABC123XYZ");
  });
  it("refuses what is not one — a Universal Analytics id, a GTM container, free text", () => {
    for (const v of ["UA-12345-1", "GTM-ABC123", "my analytics", "", null]) expect(normaliseGa4Id(v)).toBeNull();
  });
  it("accepts a Meta pixel id and refuses anything that is not its digits", () => {
    expect(normaliseMetaPixelId("1234 5678 9012 345")).toBe("123456789012345");
    for (const v of ["fb-123", "1234", "abcdefghij", null]) expect(normaliseMetaPixelId(v)).toBeNull();
  });
  it("asks the guest for consent only when there is something to consent to", () => {
    expect(needsConsent({ ga4Id: null, metaPixelId: null })).toBe(false);
    expect(needsConsent({ ga4Id: "G-ABCD1234", metaPixelId: null })).toBe(true);
  });
});
