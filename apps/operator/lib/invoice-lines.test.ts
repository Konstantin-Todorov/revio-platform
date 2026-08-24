import { describe, it, expect } from "vitest";
import { invoiceLines, formatAddress, vatLabel } from "./invoice-lines";
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
