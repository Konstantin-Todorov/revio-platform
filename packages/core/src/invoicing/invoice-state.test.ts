import { describe, it, expect } from "vitest";
import { canTransition, allowedTransitions, isIssued, amountBasis } from "./invoice-state.js";

const draft = { status: "draft", number: null, issuedAt: null };
const issued = { status: "sent", number: "1000000001", issuedAt: new Date("2026-08-01") };
const paid = { status: "paid", number: "1000000002", issuedAt: new Date("2026-08-01") };
const voided = { status: "void", number: "1000000003", issuedAt: new Date("2026-08-01") };

describe("isIssued — a number from the series is what 'issued' means", () => {
  it("is false for a draft with no number", () => expect(isIssued(draft)).toBe(false));
  it("is false for an empty-string number", () => {
    expect(isIssued({ ...draft, number: "   " })).toBe(false);
  });
  it("is true once a number is drawn", () => expect(isIssued(issued)).toBe(true));
});

describe("paying an unissued invoice — the exact production defect", () => {
  it("REFUSES draft → paid", () => {
    // `Hotel Sofia · 2026-07` is paid with no number and no issuedAt: a document settled without
    // ever having existed. Nothing could reconcile that payment to anything.
    const v = canTransition(draft, "paid");
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("not been issued");
  });

  it("says what to do instead, not just no", () => {
    expect(canTransition(draft, "paid").reason).toMatch(/issue it first/i);
  });

  it("allows paid once the invoice has a number", () => {
    expect(canTransition(issued, "paid").ok).toBe(true);
  });
});

describe("an issued document is immutable", () => {
  it("refuses any return to draft, and names the credit note", () => {
    const v = canTransition(issued, "draft");
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("credit note");
  });

  it("refuses to un-pay a paid invoice", () => {
    expect(canTransition(paid, "draft").ok).toBe(false);
    expect(canTransition(paid, "sent").ok).toBe(false);
  });

  it("refuses to void a paid invoice — that is a credit note too", () => {
    const v = canTransition(paid, "void");
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("credit note");
  });

  it("refuses to revive a void document", () => {
    for (const s of ["draft", "sent", "paid"] as const) {
      expect(canTransition(voided, s).ok, s).toBe(false);
    }
  });
});

describe("sending", () => {
  it("cannot send an unissued draft — sending needs a number", () => {
    expect(canTransition(draft, "sent").ok).toBe(false);
  });
  it("can send an issued invoice that is not yet paid", () => {
    expect(canTransition({ ...issued, status: "draft", number: "100" }, "sent").ok).toBe(true);
  });
  it("refuses a no-op", () => {
    expect(canTransition(issued, "sent").ok).toBe(false);
  });
});

describe("voiding", () => {
  it("refuses on an unissued draft — delete it instead of voiding a number that was never drawn", () => {
    expect(canTransition(draft, "void").reason).toContain("delete it");
  });
  it("allows an issued, unpaid invoice to be voided", () => {
    expect(canTransition(issued, "void").ok).toBe(true);
  });
});

describe("allowedTransitions — the buttons the screen may offer", () => {
  it("offers nothing on an unissued draft but issuing (which is a different action)", () => {
    expect(allowedTransitions(draft)).toEqual([]);
  });
  it("offers paid and void on an issued invoice", () => {
    expect(allowedTransitions(issued).sort()).toEqual(["paid", "void"]);
  });
  it("offers nothing on a paid invoice", () => {
    expect(allowedTransitions(paid)).toEqual([]);
  });
  it("offers nothing on a void invoice", () => {
    expect(allowedTransitions(voided)).toEqual([]);
  });
});

describe("amountBasis — the 'three pricing conventions' were two facts in one column", () => {
  it("reads a draft as NET, because VAT is computed at issue", () => {
    expect(amountBasis({ grossMinor: null, number: null })).toBe("net");
  });
  it("reads an issued invoice as GROSS", () => {
    expect(amountBasis({ grossMinor: 16992, number: "1000000001" })).toBe("gross");
  });
  it("does not call an unissued row gross just because a gross figure was computed", () => {
    expect(amountBasis({ grossMinor: 16992, number: null })).toBe("net");
  });
});
