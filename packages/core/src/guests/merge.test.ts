import { describe, it, expect } from "vitest";
import {
  matchDuplicates, planMerge, suggestWinner, normalisePhone, normaliseName,
  MIN_PHONE_DIGITS, type MergeableGuest,
} from "./merge.js";

const g = (o: Partial<MergeableGuest> & { id: string }): MergeableGuest => ({
  firstName: "Ventsi", lastName: "Mukov", email: null, phone: null, company: null,
  mergedIntoId: null, ...o,
});

describe("matchDuplicates", () => {
  it("matches on email, the strongest signal", () => {
    const subject = g({ id: "1", email: "v@example.com" });
    const found = matchDuplicates(subject, [g({ id: "2", email: "V@Example.com ", lastName: "M" })]);
    expect(found).toHaveLength(1);
    expect(found[0]!.reason).toBe("email");
  });

  it("matches the same number written three different ways", () => {
    // The real duplicate case: booking engine, OTA and front desk each write it differently.
    const subject = g({ id: "1", phone: "+359 88 812 34 56", lastName: "A" });
    const found = matchDuplicates(subject, [
      g({ id: "intl00", phone: "00359888123456", lastName: "B" }),
      g({ id: "national", phone: "0888123456", lastName: "C" }),
    ]);
    expect(found.map((f) => f.id).sort()).toEqual(["intl00", "national"]);
    expect(found.every((f) => f.reason === "phone")).toBe(true);
  });

  it("refuses to match on a phone fragment", () => {
    // A wrong merge folds two people's histories together with no clean way back, so a short
    // number is treated as no signal at all.
    const short = "1".repeat(MIN_PHONE_DIGITS - 1);
    const found = matchDuplicates(g({ id: "1", phone: short, lastName: "A" }), [g({ id: "2", phone: short, lastName: "B" })]);
    expect(found).toHaveLength(0);
  });

  it("matches on a normalised name", () => {
    const found = matchDuplicates(g({ id: "1", firstName: " ventsi ", lastName: "MUKOV" }), [g({ id: "2" })]);
    expect(found[0]?.reason).toBe("name");
  });

  it("never matches two OTA relay addresses on email — the bug the PMS version had", () => {
    // abc@guest.booking.com and xyz@guest.booking.com are different people, and some channels
    // reuse a relay across bookings so even an exact match proves nothing.
    const subject = g({ id: "1", email: "abc@guest.booking.com", lastName: "A" });
    const other = g({ id: "2", email: "abc@guest.booking.com", lastName: "B" });
    expect(matchDuplicates(subject, [other])).toHaveLength(0);
  });

  it("respects the stored alias flag even when the domain is unknown to us", () => {
    const subject = g({ id: "1", email: "a@some-new-relay.example", emailIsOtaAlias: true, lastName: "A" });
    const other = g({ id: "2", email: "a@some-new-relay.example", emailIsOtaAlias: true, lastName: "B" });
    expect(matchDuplicates(subject, [other])).toHaveLength(0);
  });

  it("still matches an aliased guest by name or phone", () => {
    // The alias suppresses the EMAIL signal only. It is not a reason to stop looking.
    const subject = g({ id: "1", email: "abc@guest.booking.com", phone: "+359888123456" });
    const other = g({ id: "2", email: "xyz@guest.booking.com", phone: "0888123456" });
    expect(matchDuplicates(subject, [other])[0]?.reason).toBe("phone");
  });

  it("excludes itself and anything already merged", () => {
    const subject = g({ id: "1", email: "v@x.com" });
    const found = matchDuplicates(subject, [
      g({ id: "1", email: "v@x.com" }),
      g({ id: "2", email: "v@x.com", mergedIntoId: "9" }),
    ]);
    expect(found).toHaveLength(0);
  });

  it("orders email before phone before name", () => {
    const subject = g({ id: "1", email: "v@x.com", phone: "+359888123456" });
    const found = matchDuplicates(subject, [
      g({ id: "n", firstName: "Ventsi", lastName: "Mukov" }),
      g({ id: "p", phone: "0888123456", lastName: "Other" }),
      g({ id: "e", email: "v@x.com", lastName: "Other" }),
    ]);
    expect(found.map((f) => f.reason)).toEqual(["email", "phone", "name"]);
  });

  it("reports one reason per candidate — the strongest", () => {
    const subject = g({ id: "1", email: "v@x.com", phone: "+359888123456" });
    const found = matchDuplicates(subject, [g({ id: "2", email: "v@x.com", phone: "0888123456" })]);
    expect(found).toHaveLength(1);
    expect(found[0]!.reason).toBe("email");
  });
});

describe("planMerge", () => {
  it("copies contact detail the winner is missing", () => {
    const plan = planMerge(g({ id: "w", email: "real@x.com" }), g({ id: "l", phone: "+359888", company: "Acme" }));
    expect(plan.ok && plan.fill).toEqual({ phone: "+359888", company: "Acme" });
  });

  it("never overwrites the winner", () => {
    const plan = planMerge(
      g({ id: "w", email: "real@x.com", phone: "+111" }),
      g({ id: "l", email: "other@x.com", phone: "+222" }),
    );
    expect(plan.ok && plan.fill).toEqual({});
  });

  it("carries the alias flag when the copied email is a relay", () => {
    // Without this the winner silently acquires a relay address presented as the guest's own.
    const plan = planMerge(g({ id: "w" }), g({ id: "l", email: "abc@guest.booking.com" }));
    expect(plan.ok && plan.fill).toEqual({ email: "abc@guest.booking.com", emailIsOtaAlias: true });
  });

  it("refuses to merge a record into itself", () => {
    expect(planMerge(g({ id: "x" }), g({ id: "x" }))).toEqual({ ok: false, refusal: "same-record" });
  });

  it("refuses to chain merges in either direction", () => {
    // a → b → c makes every reader walk a chain, and one loop hangs them.
    expect(planMerge(g({ id: "w", mergedIntoId: "z" }), g({ id: "l" })).ok).toBe(false);
    expect(planMerge(g({ id: "w" }), g({ id: "l", mergedIntoId: "z" }))).toEqual({
      ok: false, refusal: "loser-already-merged",
    });
  });

  it("captures both names before the write, for the audit line", () => {
    const plan = planMerge(g({ id: "w", firstName: "Ana", lastName: "B" }), g({ id: "l", firstName: "A", lastName: "B" }));
    expect(plan.ok && plan.describe).toEqual({ winner: "Ana B", loser: "A B" });
  });
});

describe("suggestWinner", () => {
  const at = (iso: string) => new Date(iso);
  const w = (o: Partial<MergeableGuest> & { id: string; createdAt: Date }) => ({ ...g(o), ...o });

  it("prefers a real address over an OTA relay", () => {
    const real = w({ id: "real", email: "ana@gmail.com", createdAt: at("2026-02-01") });
    const relay = w({ id: "relay", email: "x@guest.booking.com", createdAt: at("2026-01-01") });
    expect(suggestWinner(real, relay).id).toBe("real");
  });

  it("prefers the record with more contact detail", () => {
    const rich = w({ id: "rich", email: "a@x.com", phone: "+359", createdAt: at("2026-02-01") });
    const thin = w({ id: "thin", email: "a@x.com", createdAt: at("2026-01-01") });
    expect(suggestWinner(rich, thin).id).toBe("rich");
  });

  it("falls back to the older record, which is the one already referenced elsewhere", () => {
    const older = w({ id: "older", email: "a@x.com", createdAt: at("2026-01-01") });
    const newer = w({ id: "newer", email: "b@x.com", createdAt: at("2026-06-01") });
    expect(suggestWinner(older, newer).id).toBe("older");
    expect(suggestWinner(newer, older).id).toBe("older");
  });
});

describe("normalisers", () => {
  it("strips everything but digits from a phone", () => {
    expect(normalisePhone("+359 (88) 812-34-56")).toBe("888123456");
  });
  it("makes the three prefix conventions produce one key", () => {
    const key = normalisePhone("+359888123456");
    expect(normalisePhone("00359888123456")).toBe(key);
    expect(normalisePhone("0888123456")).toBe(key);
  });
  it("leaves a short number alone rather than padding it", () => {
    expect(normalisePhone("12345")).toBe("12345");
  });
  it("collapses whitespace and case in a name", () => {
    expect(normaliseName("  Ventsi   ", " MUKOV ")).toBe("ventsi mukov");
  });
  it("handles null and empty", () => {
    expect(normalisePhone(null)).toBe("");
    expect(normaliseName("", "")).toBe("");
  });
});
