import { describe, it, expect } from "vitest";
import { canDeleteClient, type ClientDeletionFacts } from "./client-deletion.js";

const base: ClientDeletionFacts = {
  issuedInvoices: 0, reservations: 0, isDemo: false, isPendingSignup: false, isSuspended: false,
};

describe("canDeleteClient", () => {
  it("⚠️ REFUSES a client with an issued invoice, and says what to do instead", () => {
    // An invoice that has been sent or paid exists in the customer's accounts and their auditor's.
    // Deleting our copy does not delete theirs — it only means we cannot answer about it.
    const v = canDeleteClient({ ...base, issuedInvoices: 2 });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.reason).toMatch(/tax document/i);
    expect(v.instead).toMatch(/suspend/i);
  });

  it("has no override for the invoice rule — not even for a demo or a suspended account", () => {
    // A rule about accounting records with an escape hatch is a rule that gets escaped.
    for (const extra of [{ isDemo: true }, { isSuspended: true }, { isPendingSignup: true }]) {
      expect(canDeleteClient({ ...base, ...extra, issuedInvoices: 1 }).ok).toBe(false);
    }
  });

  it("draft invoices do not block — a number nobody has seen is not a record", () => {
    // `issuedInvoices` counts sent/paid only; the caller is responsible for not counting drafts.
    expect(canDeleteClient({ ...base, issuedInvoices: 0 }).ok).toBe(true);
  });

  it("an unconfirmed signup is harmless to remove", () => {
    // No entitlement granted, no trial started, nothing ever shown to a human. Tidying, not deleting.
    const v = canDeleteClient({ ...base, isPendingSignup: true });
    expect(v).toEqual({ ok: true, severity: "harmless" });
  });

  it("warns that a demo tenant is a thing we deliberately keep", () => {
    const v = canDeleteClient({ ...base, isDemo: true });
    expect(v.ok && v.severity).toBe("destructive");
    expect(v.ok && v.warning).toMatch(/demo/i);
  });

  it("⚠️ names the guests that go with it, and offers suspension instead", () => {
    // The founder's rule: a client who left is not a deletion. They can come back at any time.
    const v = canDeleteClient({ ...base, reservations: 43 });
    expect(v.ok && v.severity).toBe("destructive");
    expect(v.ok && v.warning).toMatch(/43 reservations/);
    expect(v.ok && v.warning).toMatch(/suspend/i);
  });

  it("still warns when an active account has no reservations", () => {
    const v = canDeleteClient({ ...base });
    expect(v.ok && v.severity).toBe("destructive");
    expect(v.ok && v.warning).toMatch(/suspend/i);
  });

  it("says least about a suspended, empty account — the case where deleting is genuinely fine", () => {
    const v = canDeleteClient({ ...base, isSuspended: true });
    expect(v).toEqual({ ok: true, severity: "destructive" });
  });

  it("pluralises so the warning reads like a sentence", () => {
    expect(canDeleteClient({ ...base, reservations: 1 }).ok && canDeleteClient({ ...base, reservations: 1 })).toBeTruthy();
    const one = canDeleteClient({ ...base, reservations: 1 });
    expect(one.ok && one.warning).toMatch(/1 reservation\b/);
    const two = canDeleteClient({ ...base, issuedInvoices: 1 });
    expect(!two.ok && two.reason).toMatch(/1 invoice that has been/);
  });
});
