import { describe, it, expect } from "vitest";
import { invoiceLines, formatAddress, vatLabel, chooseIdentity } from "./invoice-lines";
import { monthlyPriceMinor, PRODUCT_KEYS, type Entitlements } from "./pricing";

const ALL_COMBINATIONS: Entitlements[] = [];
for (let mask = 1; mask < 8; mask++) {
  ALL_COMBINATIONS.push({
    channelManager: !!(mask & 1),
    reservation: !!(mask & 2),
    pms: !!(mask & 4),
  });
}
const PLANS = ["starter", "growth", "scale", "enterprise"];

describe("invoiceLines", () => {
  /**
   * The invariant the whole document rests on. An invoice whose lines do not sum to its total is
   * rejected by the customer's accounts-payable system, and the reader has no way to tell which of
   * the two numbers is the real one. `issueInvoice` refuses to issue when this fails, so proving it
   * across every plan and product combination is what stops that refusal from being reachable.
   */
  it("lines always sum to the price we quote everywhere else", () => {
    for (const plan of PLANS) {
      for (const ent of ALL_COMBINATIONS) {
        const total = invoiceLines(plan, ent).reduce((s, l) => s + l.netMinor, 0);
        expect(total, `${plan} / ${JSON.stringify(ent)}`).toBe(monthlyPriceMinor(plan, ent));
      }
    }
  });

  it("names each product the customer bought, in their own vocabulary", () => {
    // A finance team reconciles against what they think they purchased. "RevioPMS" is checkable;
    // "monthly subscription" is a thing to query by email.
    const lines = invoiceLines("growth", { channelManager: true, reservation: false, pms: true });
    const text = lines.map((l) => l.description).join(" | ");
    expect(text).toContain("RevioLink");
    expect(text).toContain("RevioPMS");
    expect(text).not.toContain("RevioCRS");
  });

  it("shows the bundle discount as its own negative line", () => {
    // Silently netting it off makes the module prices look wrong against the price list.
    const lines = invoiceLines("starter", { channelManager: true, reservation: true, pms: true });
    const discount = lines.find((l) => l.netMinor < 0);
    expect(discount).toBeDefined();
    expect(discount!.description).toMatch(/discount/i);
  });

  it("omits a zero platform fee rather than printing '€0.00'", () => {
    const lines = invoiceLines("starter", { channelManager: true, reservation: false, pms: false });
    expect(lines.every((l) => l.netMinor !== 0)).toBe(true);
  });

  it("has a line for every product and never invents one", () => {
    for (const ent of ALL_COMBINATIONS) {
      const lines = invoiceLines("starter", ent);
      const bought = PRODUCT_KEYS.filter((k) => ent[k]).length;
      const productLines = lines.filter((l) => l.netMinor > 0 && !/^Platform fee/.test(l.description));
      expect(productLines).toHaveLength(bought);
    }
  });
});

describe("formatAddress", () => {
  it("joins the parts that exist", () => {
    expect(formatAddress({ addressLine: "12 Vitosha Blvd", postCode: "1000", city: "Sofia", country: "BG" }))
      .toBe("12 Vitosha Blvd, 1000 Sofia, BG");
  });

  it("skips missing parts without leaving stray punctuation", () => {
    // A half-filled address must not render as "Sofia, , BG" on a document being sent to a customer.
    expect(formatAddress({ addressLine: null, postCode: null, city: "Sofia", country: "BG" })).toBe("Sofia, BG");
    expect(formatAddress({ addressLine: "12 Vitosha Blvd", city: null, postCode: null, country: null }))
      .toBe("12 Vitosha Blvd");
  });

  it("returns null when there is no address at all, rather than an empty string", () => {
    // Null renders as nothing; "" renders as a blank line where an address should be.
    expect(formatAddress({})).toBeNull();
    expect(formatAddress({ addressLine: "  ", city: " " })).toBeNull();
  });
});

describe("vatLabel", () => {
  it("says why a zero-rated line is zero", () => {
    expect(vatLabel({ treatment: "eu_reverse_charge", ratePct: 0 })).toMatch(/reverse charge/i);
    expect(vatLabel({ treatment: "outside_eu", ratePct: 0 })).toMatch(/outside scope/i);
    expect(vatLabel({ treatment: "not_registered", ratePct: 0 })).toMatch(/not registered/i);
  });

  it("states the rate for an ordinary domestic sale", () => {
    expect(vatLabel({ treatment: "domestic", ratePct: 20 })).toBe("VAT 20%");
  });
});

describe("chooseIdentity — which rendering of our name goes on the invoice", () => {
  const company = {
    legalName: "Уебър БГ ЕООД",
    legalNameLatin: "WEBER BG EOOD",
    addressLine: "ул. Преслав 6",
    addressLineLatin: "6 Preslav St",
    city: "Русе",
    cityLatin: "Ruse",
    postCode: "7002",
    country: "BG",
  };

  it("gives a Bulgarian customer the Cyrillic name their accountant reconciles against", () => {
    const c = chooseIdentity(company, "BG");
    expect(c.legalName).toBe("Уебър БГ ЕООД");
    expect(c.addressLine).toBe("ул. Преслав 6");
    expect(c.script).toBe("cyrillic");
  });

  it("gives a foreign customer a document they can actually read", () => {
    const c = chooseIdentity(company, "DE");
    expect(c.legalName).toBe("WEBER BG EOOD");
    expect(c.addressLine).toBe("6 Preslav St");
    expect(c.city).toBe("Ruse");
    expect(c.script).toBe("latin");
  });

  it("never mixes the two scripts on one document", () => {
    // "WEBER BG EOOD" above "ул. Преслав 6, Русе" reads as two different companies — exactly the
    // doubt an invoice exists to remove. Name and address are chosen together or not at all.
    for (const country of ["BG", "DE", "US", null]) {
      const c = chooseIdentity(company, country);
      const cyrillic = /[Ѐ-ӿ]/;
      const nameIsCyrillic = cyrillic.test(c.legalName);
      expect(cyrillic.test(c.addressLine ?? "")).toBe(nameIsCyrillic);
      expect(cyrillic.test(c.city ?? "")).toBe(nameIsCyrillic);
    }
  });

  it("falls back to the only name we have rather than leaving the issuer blank", () => {
    const oneName = { ...company, legalNameLatin: null, addressLineLatin: null, cityLatin: null };
    const c = chooseIdentity(oneName, "DE");
    expect(c.legalName).toBe("Уебър БГ ЕООД");
    expect(c.script).toBe("cyrillic");
  });

  it("treats a blank Latin name as absent, not as a name", () => {
    expect(chooseIdentity({ ...company, legalNameLatin: "   " }, "DE").legalName).toBe("Уебър БГ ЕООД");
  });

  it("uses the international rendering when the buyer's country is unknown", () => {
    // We cannot claim an unknown customer reads Cyrillic. Handing a foreign buyer an unreadable
    // document is the worse of the two mistakes.
    expect(chooseIdentity(company, null).script).toBe("latin");
  });

  it("falls back part by part when only some Latin fields exist", () => {
    const partial = { ...company, cityLatin: null };
    const c = chooseIdentity(partial, "DE");
    expect(c.legalName).toBe("WEBER BG EOOD");
    expect(c.addressLine).toBe("6 Preslav St");
    expect(c.city).toBe("Русе"); // better than blank
  });

  it("is not fooled by case or padding on the country", () => {
    expect(chooseIdentity(company, " bg ").script).toBe("cyrillic");
  });
});
