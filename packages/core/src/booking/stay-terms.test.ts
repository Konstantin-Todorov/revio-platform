import { describe, it, expect } from "vitest";
import { stayTerms, stayTermsProblems, stayTermsWords, withoutCard, type StayTermsPolicy, type StayFacts } from "./stay-terms";

const flexible: StayTermsPolicy = { payment: "guarantee", refundable: true, freeCancelDays: 1, lateFee: "first_night", noShowFee: "first_night" };
const facts: StayFacts = { totalMinor: 30000, firstNightMinor: 10000, arrival: "2026-10-20", today: "2026-10-01" };
const eur = (m: number) => `€${(m / 100).toFixed(2)}`;
const day = (iso: string) => iso;

describe("stayTerms", () => {
  it("a flexible rate takes nothing now and holds the card", () => {
    const t = stayTerms(flexible, facts);
    expect(t).toMatchObject({ payNowMinor: 0, scheduled: null, atHotelMinor: 30000, freeCancelUntil: "2026-10-19", lateCancelFeeMinor: 10000, noShowFeeMinor: 10000 });
  });

  it("a non-refundable rate is paid in full and cancelling costs the whole stay", () => {
    const t = stayTerms({ ...flexible, payment: "prepay", refundable: false, noShowFee: "full" }, facts);
    expect(t).toMatchObject({ payNowMinor: 30000, atHotelMinor: 0, freeCancelUntil: null, lateCancelFeeMinor: 30000 });
  });

  it("sizes a deposit three ways, never above the stay", () => {
    expect(stayTerms({ ...flexible, payment: "deposit", depositKind: "percent", depositValue: 30 }, facts).payNowMinor).toBe(9000);
    expect(stayTerms({ ...flexible, payment: "deposit", depositKind: "first_night" }, facts).payNowMinor).toBe(10000);
    expect(stayTerms({ ...flexible, payment: "deposit", depositKind: "fixed", depositValue: 99999 }, facts).payNowMinor).toBe(30000);
  });

  it("schedules the balance before arrival, and takes it now when that date is already here", () => {
    const p: StayTermsPolicy = { ...flexible, payment: "deposit", depositKind: "percent", depositValue: 30, balanceDaysBefore: 7 };
    expect(stayTerms(p, facts)).toMatchObject({ payNowMinor: 9000, scheduled: { amountMinor: 21000, on: "2026-10-13" }, atHotelMinor: 0 });
    // Booked five days out: "charged automatically in two days' past" is not a thing — it is today.
    expect(stayTerms(p, { ...facts, today: "2026-10-15" })).toMatchObject({ payNowMinor: 30000, scheduled: null });
  });

  it("the parts always add up to the stay", () => {
    for (const payment of ["guarantee", "deposit", "prepay"] as const) {
      for (const balanceDaysBefore of [null, 0, 3, 30]) {
        const t = stayTerms({ ...flexible, payment, depositKind: "percent", depositValue: 33, balanceDaysBefore: payment === "prepay" ? null : balanceDaysBefore }, facts);
        expect(t.payNowMinor + (t.scheduled?.amountMinor ?? 0) + t.atHotelMinor).toBe(facts.totalMinor);
      }
    }
  });

  it("a free window that has already closed is not offered", () => {
    const t = stayTerms({ ...flexible, freeCancelDays: 30 }, facts);
    expect(t.freeCancelUntil).toBeNull();
    expect(t.refundable).toBe(true);
  });
});

describe("stayTermsWords", () => {
  it("says what happens today first, and never calls a refundable rate non-refundable", () => {
    const late = stayTermsWords(stayTerms({ ...flexible, freeCancelDays: 30 }, facts), "en", eur, day);
    expect(late.cancellation).toBe("Cancelling now costs €100.00");
    const nr = stayTermsWords(stayTerms({ ...flexible, payment: "prepay", refundable: false }, facts), "bg", eur, day);
    expect(nr.payment).toBe("Платете €300.00 сега — целия престой");
    expect(nr.cancellation).toBe("Без възстановяване");
  });

  it("a guarantee says the card only guarantees", () => {
    const w = stayTermsWords(stayTerms(flexible, facts), "bg", eur, day);
    expect(w.payment).toBe("Без плащане сега");
    expect(w.details).toContain("Картата само гарантира резервацията");
    expect(w.details).toContain("Безплатно анулиране до 2026-10-19");
  });
});

describe("a page that takes no card", () => {
  it("never tells a guest their card guarantees a booking it never asked a card for", () => {
    const w = stayTermsWords(withoutCard(stayTerms(flexible, facts)), "bg", eur, day);
    expect(w.details).not.toContain("Картата само гарантира резервацията");
  });
});

describe("stayTermsProblems", () => {
  it("refuses what cannot be charged", () => {
    expect(stayTermsProblems({ ...flexible, payment: "deposit", depositKind: "percent", depositValue: 0 })).toContain("deposit_value_missing");
    expect(stayTermsProblems({ ...flexible, payment: "deposit", depositKind: "percent", depositValue: 150 })).toContain("deposit_percent_range");
    expect(stayTermsProblems({ ...flexible, payment: "prepay", balanceDaysBefore: 3 })).toContain("prepay_with_balance");
    expect(stayTermsProblems({ ...flexible, lateFee: "percent", lateFeePct: null })).toContain("late_fee_percent_range");
    expect(stayTermsProblems(flexible)).toEqual([]);
  });
});
