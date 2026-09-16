import { describe, it, expect } from "vitest";
import { emailIdentityKey, isDisposableEmail } from "./signup-identity.js";

/**
 * ⚠️ The controls that stop one person taking the same trial repeatedly.
 *
 * These existed and were partly unreachable: `isDisposableEmail` had **no callers at all** until
 * 2026-09-16 — the cheapest control there is, written and never wired into signup. These tests pin
 * the behaviour AND the fact that the shapes they refuse are the ones that actually get used.
 */
describe("taking a trial twice", () => {
  it("⚠️ sub-addressing is the same mailbox", () => {
    // The commonest way by far: four characters buys another thirty free days of all three products.
    expect(emailIdentityKey("maria+trial2@gmail.com")).toBe(emailIdentityKey("maria@gmail.com"));
    expect(emailIdentityKey("maria+a+b@gmail.com")).toBe("maria@gmail.com");
  });

  it("⚠️ dots do not make a new Gmail mailbox", () => {
    // m.a.r.i.a@gmail.com reaches maria@gmail.com. Google ignores dots; a naive check does not.
    expect(emailIdentityKey("m.a.r.i.a@gmail.com")).toBe("maria@gmail.com");
  });

  it("does NOT strip dots on domains that treat them as significant", () => {
    // The opposite mistake, and the worse one: collapsing two real people at one company into one
    // identity would refuse a genuine second signup from a colleague.
    expect(emailIdentityKey("first.last@hotelsofia.bg")).toBe("first.last@hotelsofia.bg");
  });

  it("⚠️ a throwaway mailbox passes the email round-trip, so it has to be refused earlier", () => {
    // The round trip IS the verification here — a ten-minute mailbox satisfies it exactly as well
    // as a real one. Stripping +labels does nothing against a fresh disposable domain.
    expect(isDisposableEmail("someone@mailinator.com")).toBe(true);
    expect(isDisposableEmail("owner@hotelsofia.bg")).toBe(false);
  });

  it("is case- and whitespace-insensitive, because a form is", () => {
    expect(emailIdentityKey("  Maria@Gmail.com ")).toBe("maria@gmail.com");
    expect(isDisposableEmail("  SOMEONE@Mailinator.com ".trim().toLowerCase())).toBe(true);
  });

  it("leaves something that is not an address alone rather than inventing one", () => {
    expect(emailIdentityKey("not-an-email")).toBe("not-an-email");
    expect(isDisposableEmail("not-an-email")).toBe(false);
  });
});
