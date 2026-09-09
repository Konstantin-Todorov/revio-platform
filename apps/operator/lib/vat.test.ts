import { describe, it, expect } from "vitest";
import { decideVat, applyVat, isEu, suppressesVatLine, type VatContext } from "./vat";

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

/*
 * ---------------------------------------------------------------------------------------------
 * чл. 97а — the registration that is neither "registered" nor "not", added 2026-09-09.
 *
 * Every test below fails against the old two-state code, which is the point of writing them: the
 * old code had no way to express this state and answered "domestic, 20%" to the first one.
 * ---------------------------------------------------------------------------------------------
 */

/** Us as we actually are: a BG number valid only for supplies outside Bulgaria. */
const BG_97A: VatContext = { ...BG, registration: "art97a" };

describe("decideVat — чл. 97а registration", () => {
  /*
   * THE test. Under чл. 113, ал. 9 a person registered only under чл. 97а may not state VAT in an
   * invoice at all. The old code held a VAT number, concluded "registered", and put 20% on this
   * invoice — collecting tax from a Bulgarian customer that we are prohibited from charging.
   */
  it("charges a Bulgarian customer NOTHING, and cites the ground", () => {
    const d = decideVat(BG_97A);
    expect(d.treatment).toBe("art97a_domestic");
    expect(d.ratePct).toBe(0);
    expect(d.note).toMatch(/чл\. 113, ал\. 9/);
    expect(d.needsReview).toBe(false);
  });

  /*
   * A zero-rated supply and a supply on which VAT may not be STATED are different things, and an
   * invoice printing "VAT 0%" where the law wants the чл. 113, ал. 9 ground is a defective document.
   * The rate alone cannot carry that difference, which is why the flag exists.
   */
  it("suppresses the VAT line entirely rather than printing 0%", () => {
    expect(decideVat(BG_97A).suppressVatLine).toBe(true);
    // Reverse charge is the contrast: also 0%, but the line MUST appear, with its legal note.
    expect(decideVat({ ...BG_97A, buyerCountry: "DE", buyerVatId: "DE811234567" }).suppressVatLine).toBe(false);
  });

  it("still counts toward the чл. 96 threshold — no VAT charged is not no turnover", () => {
    // The trap: a supply that carries no tax is still domestic turnover, and it is what eventually
    // forces full registration. Excluding it would let us cross the threshold without noticing.
    expect(decideVat(BG_97A).countsTowardThreshold).toBe(true);
  });

  it("treats an EU business exactly as full registration does — that is the point of holding it", () => {
    const a = decideVat({ ...BG_97A, buyerCountry: "DE", buyerVatId: "DE811234567" });
    const b = decideVat({ ...BG, registration: "full", buyerCountry: "DE", buyerVatId: "DE811234567" });
    expect(a.treatment).toBe("eu_reverse_charge");
    expect(a.treatment).toBe(b.treatment);
    expect(a.ratePct).toBe(0);
    expect(a.note).toMatch(/чл\. 21, ал\. 2/);
    expect(a.note).toMatch(/196/);
  });

  it("never counts an EU B2B sale toward the domestic threshold", () => {
    // Supplied where the customer is (чл. 21, ал. 2), so it is not Bulgarian turnover. Counting it
    // would have us registering years early, and full registration cannot be undone for a year.
    const d = decideVat({ ...BG_97A, buyerCountry: "DE", buyerVatId: "DE811234567" });
    expect(d.countsTowardThreshold).toBe(false);
  });

  it("blocks an EU customer with no VAT number instead of guessing a rate it cannot charge", () => {
    const d = decideVat({ ...BG_97A, buyerCountry: "DE", buyerVatId: null });
    expect(d.needsReview).toBe(true);
    expect(d.ratePct).toBe(0); // a чл. 97а registration permits no rate at all
    expect(d.note).toMatch(/97а|OSS/);
  });

  it("leaves a non-EU customer outside the scope, as before", () => {
    const d = decideVat({ ...BG_97A, buyerCountry: "US", buyerVatId: null });
    expect(d.treatment).toBe("outside_eu");
    expect(d.ratePct).toBe(0);
  });
});

describe("decideVat — registration overrides the number's mere presence", () => {
  it("charges nothing at all when not registered, VAT number or not", () => {
    const d = decideVat({ ...BG, registration: "none" });
    expect(d.treatment).toBe("not_registered");
    expect(d.ratePct).toBe(0);
    expect(d.suppressVatLine).toBe(true);
  });

  it("charges the domestic rate only under full registration", () => {
    expect(decideVat({ ...BG, registration: "full" }).ratePct).toBe(20);
    expect(decideVat({ ...BG, registration: "art97a" }).ratePct).toBe(0);
    expect(decideVat({ ...BG, registration: "none" }).ratePct).toBe(0);
  });

  /*
   * The compatibility path, asserted rather than assumed: a caller that has not been updated still
   * gets the OLD behaviour rather than silently switching treatment. It is also the behaviour we
   * consider wrong, which is why every real call site passes `registration` explicitly.
   */
  it("falls back to the old inference when no registration is supplied", () => {
    expect(decideVat({ ...BG, registration: undefined }).ratePct).toBe(20);
    expect(decideVat({ ...BG, registration: undefined, issuerVatId: null }).treatment).toBe("not_registered");
  });
});

describe("suppressesVatLine — answerable from the stored treatment alone", () => {
  it("matches what decideVat decided, for every treatment it can produce", () => {
    // An invoice is rendered from what was decided when it was ISSUED, so the renderer only has the
    // treatment string. If these two ever disagreed, a document would print a line the law forbids.
    const cases: VatContext[] = [
      BG_97A,
      { ...BG, registration: "full" },
      { ...BG, registration: "none" },
      { ...BG_97A, buyerCountry: "DE", buyerVatId: "DE811234567" },
      { ...BG_97A, buyerCountry: "US", buyerVatId: null },
    ];
    for (const c of cases) {
      const d = decideVat(c);
      expect(suppressesVatLine(d.treatment)).toBe(d.suppressVatLine);
    }
  });
});
