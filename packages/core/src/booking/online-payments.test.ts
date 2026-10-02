import { describe, expect, it } from "vitest";
import { expectedOnlinePayments, missingOnlinePayments } from "./online-payments";

const base = { onlinePaidMinor: 3000, onlinePaymentRef: "pi_book", balanceChargeMinor: 7000, balanceChargedAt: null, balancePaymentRef: null };

describe("expectedOnlinePayments", () => {
  it("splits what was taken at booking from the balance charged later", () => {
    const charged = { ...base, onlinePaidMinor: 10000, balanceChargedAt: new Date(), balancePaymentRef: "pi_bal" };
    expect(expectedOnlinePayments(charged)).toEqual([
      { kind: "booking", ref: "pi_book", amountMinor: 3000 },
      { kind: "balance", ref: "pi_bal", amountMinor: 7000 },
    ]);
  });

  it("ignores a balance not yet charged", () => {
    expect(expectedOnlinePayments(base)).toEqual([{ kind: "booking", ref: "pi_book", amountMinor: 3000 }]);
  });

  it("adds paid payment links", () => {
    expect(expectedOnlinePayments({ ...base, onlinePaidMinor: 0 }, [{ paymentRef: "pi_link", amountMinor: 5000 }]))
      .toEqual([{ kind: "link", ref: "pi_link", amountMinor: 5000 }]);
  });
});

describe("missingOnlinePayments", () => {
  const expected = expectedOnlinePayments(
    { ...base, onlinePaidMinor: 10000, balanceChargedAt: new Date(), balancePaymentRef: "pi_bal" },
    [{ paymentRef: "pi_link", amountMinor: 2000 }],
  );

  it("posts everything on a folio that has none of it", () => {
    expect(missingOnlinePayments(expected, []).map((e) => e.amountMinor)).toEqual([3000, 7000, 2000]);
  });

  it("posts the balance that arrived after the folio was opened", () => {
    expect(missingOnlinePayments(expected, [{ ref: "pi_book", amountMinor: 3000 }]).map((e) => e.kind)).toEqual(["balance", "link"]);
  });

  it("never double-counts an old line that already included the balance", () => {
    // Opened under the old rule after the balance was charged: one line for the whole 10 000.
    const missing = missingOnlinePayments(expected, [{ ref: "pi_book", amountMinor: 10000 }]);
    expect(missing.reduce((s, m) => s + m.amountMinor, 0)).toBe(2000);
  });

  it("is idempotent once everything is posted", () => {
    const all = expected.map((e) => ({ ref: e.ref, amountMinor: e.amountMinor }));
    expect(missingOnlinePayments(expected, all)).toEqual([]);
  });
});
