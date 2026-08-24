import { describe, it, expect } from "vitest";
import { decideVat, applyVat, isEu, type VatContext } from "./vat";

/**
 * The branches here are the ones that cost money when they are wrong, so each test says what the
 * wrong answer would actually do rather than only asserting a number.
 */

/** Us: a VAT-registered Bulgarian company. */
const BG: VatContext = {
  issuerCountry: "BG",
  issuerVatId: "BG123456789",
  standardRatePct: 20,
  buyerCountry: "BG",
  buyerVatId: "BG987654321",
};

describe("decideVat", () => {
  it("charges domestic VAT to a hotel in our own country", () => {
    const d = decideVat(BG);
    expect(d.treatment).toBe("domestic");
    expect(d.ratePct).toBe(20);
    expect(d.needsReview).toBe(false);
  });

  it("domestic applies regardless of whether the local customer gave a VAT number", () => {
    // A Bulgarian hotel below the registration threshold is still a Bulgarian sale at 20%.
    expect(decideVat({ ...BG, buyerVatId: null }).ratePct).toBe(20);
  });

  it("reverse-charges an EU business that has a VAT number", () => {
    // Charging 20% here bills the customer a fifth more than they owe, and they cannot reclaim it.
    const d = decideVat({ ...BG, buyerCountry: "DE", buyerVatId: "DE811234567" });
    expect(d.treatment).toBe("eu_reverse_charge");
    expect(d.ratePct).toBe(0);
    expect(d.note).toMatch(/Art\. 196/);
    expect(d.needsReview).toBe(false);
  });

  it("a 0% line always carries the reason it is 0%", () => {
    // An unexplained zero is not a valid invoice — it reads as an error rather than a treatment.
    for (const c of ["DE", "FR", "US", "JP"]) {
      const d = decideVat({ ...BG, buyerCountry: c, buyerVatId: "XX123456789" });
      if (d.ratePct === 0) expect(d.note).toBeTruthy();
    }
  });

  it("treats a non-EU customer as outside the scope of EU VAT", () => {
    const d = decideVat({ ...BG, buyerCountry: "US", buyerVatId: null });
    expect(d.treatment).toBe("outside_eu");
    expect(d.ratePct).toBe(0);
    expect(d.needsReview).toBe(false);
  });

  it("the UK is not the EU", () => {
    // It shares the neighbourhood and the alphabet, and a stale country list is how it gets missed.
    expect(isEu("GB")).toBe(false);
    expect(decideVat({ ...BG, buyerCountry: "GB", buyerVatId: "GB123456789" }).treatment).toBe("outside_eu");
  });

  it("flags an EU customer with no VAT number instead of guessing", () => {
    // Destination-country VAT under OSS. Charging our own rate might be wrong, and silently being
    // wrong about someone else's tax authority is the worst available outcome.
    const d = decideVat({ ...BG, buyerCountry: "IT", buyerVatId: null });
    expect(d.treatment).toBe("eu_b2c");
    expect(d.needsReview).toBe(true);
    expect(d.note).toMatch(/OSS/);
  });

  it("charges nothing at all when we are not VAT registered", () => {
    // Invoicing VAT without a registration is collecting tax we have no right to collect.
    const d = decideVat({ ...BG, issuerVatId: null, buyerCountry: "DE", buyerVatId: "DE811234567" });
    expect(d.treatment).toBe("not_registered");
    expect(d.ratePct).toBe(0);
  });

  it("flags a missing buyer country rather than assuming it is ours", () => {
    // The commonest data gap. Defaulting to domestic would overcharge every foreign customer whose
    // address simply has not been filled in.
    const d = decideVat({ ...BG, buyerCountry: null });
    expect(d.needsReview).toBe(true);
  });

  it("is not fooled by lowercase or padded country codes", () => {
    expect(decideVat({ ...BG, buyerCountry: " de ", buyerVatId: "DE811234567" }).treatment).toBe("eu_reverse_charge");
  });

  it("does not accept whitespace as a VAT number", () => {
    // "   " in a text field must not reclassify a sale as reverse charge.
    expect(decideVat({ ...BG, buyerCountry: "DE", buyerVatId: "   " }).treatment).toBe("eu_b2c");
  });
});

describe("applyVat", () => {
  it("adds VAT to a net price rather than extracting it", () => {
    // The whole assumption in one test: €49.00 net at 20% is €58.80, not €49.00 gross.
    expect(applyVat(4900, 20)).toEqual({ netMinor: 4900, taxMinor: 980, grossMinor: 5880 });
  });

  it("leaves the amount untouched at 0%", () => {
    expect(applyVat(14160, 0)).toEqual({ netMinor: 14160, taxMinor: 0, grossMinor: 14160 });
  });

  it("always closes: net + tax === gross", () => {
    // An invoice whose arithmetic does not add up is rejected by the customer's AP system.
    for (const n of [1, 7, 33, 4900, 5900, 6900, 14160, 44160, 999999]) {
      for (const r of [0, 9, 20, 21, 23]) {
        const a = applyVat(n, r);
        expect(a.netMinor + a.taxMinor).toBe(a.grossMinor);
      }
    }
  });
});
