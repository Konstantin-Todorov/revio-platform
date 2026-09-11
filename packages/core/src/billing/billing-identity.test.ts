import { describe, expect, it } from "vitest";
import {
  billingIdentityPrompt,
  canBeInvoiced,
  normaliseVatId,
  validateBillingIdentity,
  type BillingIdentity,
} from "./billing-identity.js";

/**
 * The details that decide whether a tax document can be issued at all.
 *
 * A refusal here costs a hotel thirty seconds. A field let through costs a defective invoice, which
 * costs a credit note and a conversation with somebody's accountant.
 */

const good = (o: Partial<BillingIdentity> = {}): BillingIdentity => ({
  legalName: "Кабакум Бийч Резиденс ЕООД",
  country: "BG",
  companyId: "203456789",
  vatId: "BG203456789",
  addressLine: "ул. Христо Ботев 14",
  city: "Варна",
  postCode: "9000",
  billingEmail: "accounts@cabacum.bg",
  attention: "Accounts payable",
  ...o,
});

describe("what an invoice cannot be issued without", () => {
  it("accepts a complete set", () => {
    expect(validateBillingIdentity(good())).toEqual([]);
    expect(canBeInvoiced(good())).toBe(true);
  });

  it("requires the registered name, the country, the address and the city", () => {
    for (const field of ["legalName", "country", "addressLine", "city"] as const) {
      const problems = validateBillingIdentity(good({ [field]: "  " }));
      expect(problems.map((p) => p.field), field).toContain(field);
    }
  });

  /*
   * The country is the one that is not merely paperwork. `decideVat` refuses to guess without it,
   * because defaulting to domestic quietly overcharges every foreign customer whose address nobody
   * has filled in — and the message on screen has to say that is why we are asking.
   */
  it("explains that the country is what decides the tax, not just a form field", () => {
    const p = validateBillingIdentity(good({ country: "" }))[0]!;
    expect(p.message).toMatch(/decides whether VAT applies/i);
  });

  it("reports every problem at once, not one per submit", () => {
    // A form that reveals one fault at a time is the reason people abandon them.
    const problems = validateBillingIdentity(good({ legalName: "", city: "", addressLine: "" }));
    expect(problems).toHaveLength(3);
  });

  it("does NOT require a VAT number", () => {
    // Plenty of small hotels are not VAT registered, and refusing them would be refusing a customer.
    expect(canBeInvoiced(good({ vatId: "" }))).toBe(true);
  });
});

describe("the VAT number, checked for shape and never for existence", () => {
  it("tidies up what people paste", () => {
    expect(normaliseVatId(" bg 203 456 789 ")).toBe("BG203456789");
  });

  it("catches the ordinary mistakes for a country whose shape we know", () => {
    for (const bad of ["203456789", "BG2034567", "BGX03456789"]) {
      const problems = validateBillingIdentity(good({ vatId: bad }));
      expect(problems.map((p) => p.field), bad).toContain("vatId");
    }
  });

  it("names the prefix the number should start with", () => {
    const p = validateBillingIdentity(good({ vatId: "203456789" }))[0]!;
    expect(p.message).toMatch(/should start with BG/);
  });

  it("knows Greece uses EL and not GR", () => {
    expect(canBeInvoiced(good({ country: "GR", vatId: "EL123456789" }))).toBe(true);
    expect(canBeInvoiced(good({ country: "GR", vatId: "GR123456789" }))).toBe(false);
  });

  /*
   * We sell to whoever turns up. Refusing a perfectly good Swiss or British VAT number because it is
   * not in the EU list would be a bug that looks like diligence.
   */
  it("accepts a number from a country whose shape we do not know", () => {
    expect(canBeInvoiced(good({ country: "CH", vatId: "CHE-123.456.789" }))).toBe(true);
  });

  it("accepts every EU shape it claims to know", () => {
    const samples: [string, string][] = [
      ["DE", "DE123456789"], ["FR", "FRXX123456789"], ["IT", "IT12345678901"],
      ["NL", "NL123456789B01"], ["AT", "ATU12345678"], ["PL", "PL1234567890"],
      ["RO", "RO1234567890"], ["ES", "ESA1234567A"], ["BE", "BE0123456789"],
    ];
    for (const [country, vatId] of samples) {
      expect(canBeInvoiced(good({ country, vatId })), `${country} ${vatId}`).toBe(true);
    }
  });
});

describe("what a hotel is told when it is missing", () => {
  it("says we cannot invoice them, and never that their software will stop", () => {
    /*
     * ⚠️ The consequence must stay honest. A hotel that has not typed its VAT number is not a hotel
     * whose front desk should stop working — holding a check-in hostage over a form is not a thing
     * we do. The real consequence is the only one worth stating.
     */
    const prompt = billingIdentityPrompt(null)!;
    expect(prompt).toMatch(/cannot issue you an invoice/i);
    expect(prompt).not.toMatch(/suspend|disable|lose access|stop working/i);
  });

  it("names what is missing, so it can be finished rather than hunted for", () => {
    const prompt = billingIdentityPrompt(good({ city: "", country: "" }))!;
    expect(prompt).toMatch(/country/i);
    expect(prompt).toMatch(/city/i);
  });

  it("says nothing at all once it is complete", () => {
    expect(billingIdentityPrompt(good())).toBeNull();
  });
});
