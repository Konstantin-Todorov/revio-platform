import { describe, it, expect } from "vitest";
import {
  SUPPORT_KINDS,
  SUPPORT_MESSAGE_MAX,
  supportKind,
  supportReference,
  validateSupportMessage,
  supportRefusalMessage,
  isOverdue,
  hoursOverdue,
} from "./support";

const NOW = new Date("2026-09-08T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

describe("SUPPORT_KINDS — the promise and the clock must agree", () => {
  it("orders most urgent first, so nobody reads past their answer", () => {
    expect(SUPPORT_KINDS.map((k) => k.key)).toEqual(["urgent", "problem", "question"]);
  });

  it("gives every kind a promise the console can also count", () => {
    // Two renderings of one commitment: the hotel reads the sentence, the queue counts the hours.
    for (const k of SUPPORT_KINDS) {
      expect(k.promise.length).toBeGreaterThan(10);
      expect(k.targetHours).toBeGreaterThan(0);
    }
  });

  it("keeps the windows in increasing order of patience", () => {
    const hours = SUPPORT_KINDS.map((k) => k.targetHours);
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
  });
});

describe("supportKind — a bad value must not page anyone", () => {
  it("resolves the real kinds", () => {
    expect(supportKind("urgent").targetHours).toBe(2);
    expect(supportKind("question").key).toBe("question");
  });

  it("falls to the middle, never to urgent", () => {
    // A mis-typed or stale value must not create a 2-hour obligation nobody agreed to.
    expect(supportKind("nonsense").key).toBe("problem");
    expect(supportKind(null).key).toBe("problem");
    expect(supportKind(undefined).key).toBe("problem");
    expect(supportKind("").key).toBe("problem");
  });
});

describe("supportReference", () => {
  it("is short enough to say on the phone", () => {
    expect(supportReference("cmqxe5m4700017ad2amh0n6h8")).toBe("SR-H0N6H8");
  });

  it("needs no column and no sequence", () => {
    // Derived from the id, like a booking reference.
    expect(supportReference("abcdef123456")).toBe("SR-123456");
  });
});

describe("validateSupportMessage — the floor is low on purpose", () => {
  it("accepts a nine-word incident report", () => {
    // Somebody mid-incident should not be asked for a paragraph.
    expect(validateSupportMessage("Booking page 500s when I press save on rates")).toBeNull();
  });

  it("refuses an empty message", () => {
    expect(validateSupportMessage("")).toBe("no-message");
    expect(validateSupportMessage("    ")).toBe("no-message");
  });

  it("refuses something too short to act on", () => {
    expect(validateSupportMessage("broken")).toBe("too-short");
  });

  it("refuses a pasted log rather than silently truncating it", () => {
    expect(validateSupportMessage("x".repeat(SUPPORT_MESSAGE_MAX + 1))).toBe("too-long");
  });

  it("says what to do about each refusal", () => {
    for (const r of ["no-message", "too-short", "too-long"] as const) {
      expect(supportRefusalMessage(r).length).toBeGreaterThan(20);
    }
  });
});

describe("isOverdue — late against what we promised, not how loudly it was reported", () => {
  const req = (kind: string, ageHours: number, handled = false) => ({
    kind,
    createdAt: hoursAgo(ageHours),
    handledAt: handled ? hoursAgo(0) : null,
  });

  it("holds an urgent to two hours", () => {
    expect(isOverdue(req("urgent", 1), NOW)).toBe(false);
    expect(isOverdue(req("urgent", 3), NOW)).toBe(true);
  });

  it("does not call an urgent late ten minutes in, however it feels", () => {
    expect(isOverdue(req("urgent", 0.16), NOW)).toBe(false);
  });

  it("calls a three-day-old question overdue", () => {
    expect(isOverdue(req("question", 72), NOW)).toBe(true);
  });

  it("is never overdue once it has been answered", () => {
    expect(isOverdue(req("urgent", 500, true), NOW)).toBe(false);
  });

  it("measures how late, for ordering the queue", () => {
    expect(hoursOverdue(req("urgent", 5), NOW)).toBeCloseTo(3, 5);
    expect(hoursOverdue(req("urgent", 1), NOW)).toBe(0);
  });

  it("puts a long-overdue question ahead of a barely-late urgent", () => {
    // The queue sorts by lateness against the promise, which is the only fair comparison.
    const lateQuestion = hoursOverdue(req("question", 96), NOW);
    const barelyUrgent = hoursOverdue(req("urgent", 2.5), NOW);
    expect(lateQuestion).toBeGreaterThan(barelyUrgent);
  });
});
