import { describe, it, expect } from "vitest";
import {
  fiscalRequirement,
  needsFiscalDevice,
  isFiscalJurisdiction,
  type PaymentMethod,
} from "./receipt-requirement.js";

describe("fiscalRequirement — Bulgaria, Наредба Н-18 чл. 3 ал. 1", () => {
  it("requires a receipt for cash", () => {
    expect(fiscalRequirement("bg", "cash")?.required).toBe(true);
  });

  it("requires a receipt for card — a card is NOT a credit transfer", () => {
    // The error this whole module exists to prevent. Card feels electronic and is not exempt.
    const r = fiscalRequirement("bg", "card");
    expect(r?.required).toBe(true);
    expect(r?.reason).toMatch(/not a credit transfer/i);
  });

  it("exempts bank transfer — the word the earlier research pass got wrong", () => {
    expect(fiscalRequirement("bg", "bank_transfer")?.required).toBe(false);
  });

  it("exempts a company account", () => {
    expect(fiscalRequirement("bg", "company_account")?.required).toBe(false);
  });

  it("exempts an OTA prepayment", () => {
    expect(fiscalRequirement("bg", "prepaid_ota")?.required).toBe(false);
  });

  it("always gives a reason, in both directions", () => {
    const methods: PaymentMethod[] = ["cash", "card", "bank_transfer", "company_account", "prepaid_ota"];
    for (const m of methods) {
      expect(fiscalRequirement("bg", m)?.reason.length).toBeGreaterThan(10);
    }
  });

  it("returns null for an unresearched jurisdiction rather than guessing 'exempt'", () => {
    // A country we have not read the law for must not read as a country with no law.
    expect(fiscalRequirement("de", "cash")).toBeNull();
    expect(fiscalRequirement("generic", "cash")).toBeNull();
    expect(isFiscalJurisdiction("de")).toBe(false);
    expect(isFiscalJurisdiction("bg")).toBe(true);
  });
});

describe("needsFiscalDevice", () => {
  it("is false for a hotel selling only through OTAs and companies", () => {
    // The commercially important case: this hotel can go live on Revio with no fiscal hardware.
    const r = needsFiscalDevice("bg", ["prepaid_ota", "bank_transfer", "company_account"]);
    expect(r.needed).toBe(false);
    expect(r.triggeredBy).toEqual([]);
  });

  it("is true as soon as a front desk takes cards", () => {
    const r = needsFiscalDevice("bg", ["prepaid_ota", "bank_transfer", "card"]);
    expect(r.needed).toBe(true);
    expect(r.triggeredBy).toEqual(["card"]);
  });

  it("names every method that triggers it, not just the first", () => {
    const r = needsFiscalDevice("bg", ["cash", "bank_transfer", "card"]);
    expect(r.triggeredBy).toEqual(["cash", "card"]);
  });

  it("accepts nothing → needs nothing", () => {
    expect(needsFiscalDevice("bg", []).needed).toBe(false);
  });

  it("an unresearched jurisdiction reports no requirement — the caller must gate on jurisdiction", () => {
    // Documented rather than hidden: needsFiscalDevice is only meaningful where fiscalRequirement is.
    expect(needsFiscalDevice("de", ["cash"]).needed).toBe(false);
  });
});
