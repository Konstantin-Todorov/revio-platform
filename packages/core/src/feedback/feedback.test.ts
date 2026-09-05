import { describe, it, expect } from "vitest";
import {
  routeFeedback,
  isValidRating,
  canAskForFeedback,
  isPermanentRefusal,
  askDueAt,
  addMonths,
  averageRating,
  summariseFeedback,
  DEFAULT_ASK_AFTER_DAYS,
  DEFAULT_ASK_AT_MOST_EVERY_MONTHS,
  type FeedbackAskFacts,
  type FeedbackAskConfig,
} from "./feedback";

const NOW = new Date("2026-09-10T12:00:00.000Z");
const daysBefore = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const CONFIG: FeedbackAskConfig = {
  askAfterDays: DEFAULT_ASK_AFTER_DAYS,
  askAtMostEveryMonths: DEFAULT_ASK_AT_MOST_EVERY_MONTHS,
};

/** A guest we would ask: departed two days ago, settled, opted in, never asked. */
function facts(over: Partial<FeedbackAskFacts> = {}): FeedbackAskFacts {
  return {
    guestEmail: "guest@example.com",
    reservationStatus: "confirmed",
    departedAt: daysBefore(2),
    balanceMinor: 0,
    recognitionOptOut: false,
    lastAskedAt: null,
    ...over,
  };
}

describe("routeFeedback — the public prompt is never gated", () => {
  it("shows the public review links for EVERY rating", () => {
    /*
     * The rule the whole module exists to protect. Competing tools show these links only to guests
     * who rated well; that is review gating, it breaches Google's policies, and the risk lands on
     * the hotel. Anyone introducing it has to delete this test.
     */
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(routeFeedback(rating).showPublicLinks).toBe(true);
    }
  });

  it("alerts a person for one and two stars", () => {
    expect(routeFeedback(1).urgency).toBe("alert");
    expect(routeFeedback(2).urgency).toBe("alert");
  });

  it("puts three stars in the digest, not the alert", () => {
    expect(routeFeedback(3).urgency).toBe("digest");
  });

  it("logs four and five", () => {
    expect(routeFeedback(4).urgency).toBe("logged");
    expect(routeFeedback(5).urgency).toBe("logged");
  });

  it("refuses a value that is not a rating rather than clamping it", () => {
    // Clamping would turn a bug upstream into a silent 1-star alert, or a silent 5-star average.
    expect(() => routeFeedback(0)).toThrow();
    expect(() => routeFeedback(6)).toThrow();
    expect(() => routeFeedback(3.5)).toThrow();
    expect(() => routeFeedback(Number.NaN)).toThrow();
  });

  it("agrees with isValidRating", () => {
    expect([1, 2, 3, 4, 5].every(isValidRating)).toBe(true);
    expect([0, 6, -1, 2.5, Number.NaN, Infinity].some(isValidRating)).toBe(false);
  });
});

describe("canAskForFeedback — asking the wrong guest is worse than not asking", () => {
  it("asks a departed, settled, opted-in guest", () => {
    expect(canAskForFeedback(facts(), CONFIG, NOW)).toBeNull();
  });

  it("does not ask without an email", () => {
    expect(canAskForFeedback(facts({ guestEmail: null }), CONFIG, NOW)).toBe("no-email");
    expect(canAskForFeedback(facts({ guestEmail: "   " }), CONFIG, NOW)).toBe("no-email");
  });

  it("does not ask about a stay that never happened", () => {
    expect(canAskForFeedback(facts({ reservationStatus: "cancelled" }), CONFIG, NOW))
      .toBe("stay-did-not-happen");
    expect(canAskForFeedback(facts({ reservationStatus: "no_show" }), CONFIG, NOW))
      .toBe("stay-did-not-happen");
  });

  it("respects the opt-out", () => {
    expect(canAskForFeedback(facts({ recognitionOptOut: true }), CONFIG, NOW)).toBe("opted-out");
  });

  it("does not chase the money and the review in the same week", () => {
    expect(canAskForFeedback(facts({ balanceMinor: 4_500 }), CONFIG, NOW)).toBe("unpaid-balance");
  });

  it("still asks a guest the hotel owes money to", () => {
    // A credit balance is the hotel's problem to resolve, not a reason to go quiet on the guest.
    expect(canAskForFeedback(facts({ balanceMinor: -4_500 }), CONFIG, NOW)).toBeNull();
  });

  it("does not ask a guest who has not left", () => {
    expect(canAskForFeedback(facts({ departedAt: null }), CONFIG, NOW)).toBe("not-departed");
  });

  it("waits the configured number of days after departure", () => {
    expect(canAskForFeedback(facts({ departedAt: daysBefore(0) }), CONFIG, NOW)).toBe("too-soon");
    expect(canAskForFeedback(facts({ departedAt: daysBefore(1) }), CONFIG, NOW)).toBeNull();
  });

  it("does not ask a regular guest again inside the window", () => {
    const monthly = facts({ lastAskedAt: daysBefore(30) });
    expect(canAskForFeedback(monthly, CONFIG, NOW)).toBe("asked-recently");
  });

  it("asks again once the window has passed", () => {
    const longAgo = facts({ lastAskedAt: daysBefore(400) });
    expect(canAskForFeedback(longAgo, CONFIG, NOW)).toBeNull();
  });

  it("reports the reason that will still be true next week", () => {
    /*
     * A guest who opted out AND owes money AND has not departed is reported as opted out. Ordering
     * the checks by permanence means the answer is the one a person can act on, rather than
     * whichever condition happened to be tested first.
     */
    const everything = facts({
      recognitionOptOut: true,
      balanceMinor: 9_000,
      departedAt: null,
      lastAskedAt: daysBefore(1),
    });
    expect(canAskForFeedback(everything, CONFIG, NOW)).toBe("opted-out");
  });

  it("honours a hotel that wants to ask the same day", () => {
    const sameDay = { ...CONFIG, askAfterDays: 0 };
    expect(canAskForFeedback(facts({ departedAt: daysBefore(0) }), sameDay, NOW)).toBeNull();
  });
});

describe("isPermanentRefusal — so a sweep can stop reconsidering", () => {
  it("treats the unchangeable reasons as permanent", () => {
    expect(isPermanentRefusal("no-email")).toBe(true);
    expect(isPermanentRefusal("stay-did-not-happen")).toBe(true);
    expect(isPermanentRefusal("opted-out")).toBe(true);
  });

  it("treats the reasons that time or a payment will resolve as temporary", () => {
    expect(isPermanentRefusal("unpaid-balance")).toBe(false);
    expect(isPermanentRefusal("not-departed")).toBe(false);
    expect(isPermanentRefusal("too-soon")).toBe(false);
    expect(isPermanentRefusal("asked-recently")).toBe(false);
  });
});

describe("askDueAt", () => {
  it("adds the configured days to the departure", () => {
    expect(askDueAt(new Date("2026-09-01T10:00:00.000Z"), 3))
      .toEqual(new Date("2026-09-04T10:00:00.000Z"));
  });

  it("treats zero days as due immediately", () => {
    const d = new Date("2026-09-01T10:00:00.000Z");
    expect(askDueAt(d, 0)).toEqual(d);
  });

  it("never travels backwards on a negative setting", () => {
    const d = new Date("2026-09-01T10:00:00.000Z");
    expect(askDueAt(d, -5)).toEqual(d);
  });
});

describe("addMonths — clamps instead of overflowing", () => {
  it("does not turn 31 January into 3 March", () => {
    // The naive setMonth rolls over, which would ask a guest EARLIER than the hotel's minimum.
    expect(addMonths(new Date("2026-01-31T00:00:00.000Z"), 1))
      .toEqual(new Date("2026-02-28T00:00:00.000Z"));
  });

  it("lands on 29 February in a leap year", () => {
    expect(addMonths(new Date("2028-01-31T00:00:00.000Z"), 1))
      .toEqual(new Date("2028-02-29T00:00:00.000Z"));
  });

  it("crosses a year boundary", () => {
    expect(addMonths(new Date("2026-11-15T08:00:00.000Z"), 3))
      .toEqual(new Date("2027-02-15T08:00:00.000Z"));
  });

  it("keeps the time of day", () => {
    expect(addMonths(new Date("2026-03-10T13:45:12.000Z"), 6).toISOString())
      .toBe("2026-09-10T13:45:12.000Z");
  });

  it("is a no-op for zero", () => {
    const d = new Date("2026-03-10T13:45:12.000Z");
    expect(addMonths(d, 0)).toEqual(d);
  });
});

describe("averageRating", () => {
  it("is null when nobody has answered, never 0", () => {
    // A 0.0 on a dashboard reads as "everyone rated zero", which is a different and alarming fact.
    expect(averageRating([])).toBeNull();
  });

  it("averages what it is given", () => {
    expect(averageRating([4, 5, 3])).toBe(4);
  });

  it("ignores values that are not ratings rather than letting them drag the average", () => {
    expect(averageRating([5, 5, Number.NaN, 0, 9])).toBe(5);
  });
});

describe("summariseFeedback", () => {
  it("counts asked, answered and the response rate", () => {
    const s = summariseFeedback([{ rating: 5 }, { rating: null }, { rating: 4 }, { rating: null }]);
    expect(s.asked).toBe(4);
    expect(s.answered).toBe(2);
    expect(s.responseRate).toBe(0.5);
    expect(s.averageRating).toBe(4.5);
  });

  it("counts the answers that need a person", () => {
    const s = summariseFeedback([{ rating: 1 }, { rating: 2 }, { rating: 3 }, { rating: 5 }]);
    expect(s.alerts).toBe(2);
  });

  it("returns null rates for an empty list rather than zeroes", () => {
    const s = summariseFeedback([]);
    expect(s.responseRate).toBeNull();
    expect(s.averageRating).toBeNull();
    expect(s.alerts).toBe(0);
  });

  it("does not count an unanswered request as a rating", () => {
    const s = summariseFeedback([{ rating: null }, { rating: null }]);
    expect(s.answered).toBe(0);
    expect(s.responseRate).toBe(0);
    expect(s.averageRating).toBeNull();
  });
});
