import { describe, expect, it } from "vitest";
import { reminderStage } from "./invoice-schedule";

const due = new Date("2026-10-15T00:00:00Z");
const at = (iso: string) => new Date(`${iso}T09:00:00Z`);
const stage = (now: string, sent = 0, last: string | null = null) =>
  reminderStage({ dueDate: due, remindersSent: sent, lastReminderAt: last ? at(last) : null, now: at(now) });

describe("reminderStage", () => {
  it("says nothing until three days before the due date", () => {
    expect(stage("2026-10-10")).toBeNull();
    expect(stage("2026-10-12")).toBe("soon");
  });

  it("follows a missed heads-up with 'overdue' a day after the due date", () => {
    expect(stage("2026-10-16", 1, "2026-10-12")).toBe("overdue");
  });

  it("sends the third a week after the due date, then stops for good", () => {
    expect(stage("2026-10-22", 2, "2026-10-16")).toBe("overdue");
    expect(stage("2026-11-30", 3, "2026-10-22")).toBeNull();
  });

  it("never sends two within two days, however late the run", () => {
    expect(stage("2026-10-23", 1, "2026-10-22")).toBeNull();
  });

  it("an invoice with no due date is never chased", () => {
    expect(reminderStage({ dueDate: null, remindersSent: 0, lastReminderAt: null, now: at("2026-10-20") })).toBeNull();
  });
});
