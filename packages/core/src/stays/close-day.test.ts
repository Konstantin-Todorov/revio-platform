import { describe, it, expect } from "vitest";
import { closeDayEscalation } from "./close-day.js";

/** 00:30 deadline, 22h window — the shipped defaults, so these tests pin the real behaviour. */
const base = { closeDeadlineMinutes: 30, reminderWindowHours: 22, autoCloseEnabled: true };

describe("closeDayEscalation — nothing is late yet", () => {
  it("the day the property is on is current", () => {
    const e = closeDayEscalation({ ...base, businessDate: "2026-08-23", today: "2026-08-23", nowMinutes: 23 * 60 });
    expect(e.stage).toBe("current");
    expect(e.daysBehind).toBe(0);
  });

  it("a business date in the future is still current, never negative", () => {
    const e = closeDayEscalation({ ...base, businessDate: "2026-08-24", today: "2026-08-23", nowMinutes: 600 });
    expect(e.stage).toBe("current");
    expect(e.daysBehind).toBe(0);
  });

  it("one day behind but before 00:30 is not yet due", () => {
    const e = closeDayEscalation({ ...base, businessDate: "2026-08-22", today: "2026-08-23", nowMinutes: 20 });
    expect(e.stage).toBe("current");
    expect(e.minutesOverdue).toBe(0);
  });

  it("exactly at the deadline is due — the boundary counts as reached", () => {
    const e = closeDayEscalation({ ...base, businessDate: "2026-08-22", today: "2026-08-23", nowMinutes: 30 });
    expect(e.stage).toBe("reminder");
    expect(e.minutesOverdue).toBe(0);
  });
});

describe("closeDayEscalation — stage 1, the nudge", () => {
  it("past the deadline reminds, and the reminder can be dismissed", () => {
    const e = closeDayEscalation({ ...base, businessDate: "2026-08-22", today: "2026-08-23", nowMinutes: 9 * 60 });
    expect(e.stage).toBe("reminder");
    expect(e.dismissable).toBe(true);
    expect(e.minutesOverdue).toBe(9 * 60 - 30);
  });

  it("still reminding one minute before the window closes", () => {
    // 00:30 + 22h = 22:30. One minute earlier is the last moment a human still owns the decision.
    const e = closeDayEscalation({ ...base, businessDate: "2026-08-22", today: "2026-08-23", nowMinutes: 22 * 60 + 29 });
    expect(e.stage).toBe("reminder");
  });
});

describe("closeDayEscalation — stage 2, the system acts", () => {
  it("auto-closes once the reminder window has run out", () => {
    const e = closeDayEscalation({ ...base, businessDate: "2026-08-22", today: "2026-08-23", nowMinutes: 22 * 60 + 30 });
    expect(e.stage).toBe("auto_close");
    expect(e.dismissable).toBe(false);
  });

  it("a property that opted out is told, and nothing closes it", () => {
    const e = closeDayEscalation({
      ...base, autoCloseEnabled: false,
      businessDate: "2026-08-22", today: "2026-08-23", nowMinutes: 23 * 60,
    });
    expect(e.stage).toBe("overdue_no_auto");
    expect(e.dismissable).toBe(false);
  });

  it("a day two behind is already past the window at any hour", () => {
    // This is the accumulation case. Two days behind means the deadline passed over a day ago, so
    // there is no hour of the morning at which it is merely a reminder.
    const e = closeDayEscalation({ ...base, businessDate: "2026-08-21", today: "2026-08-23", nowMinutes: 1 });
    expect(e.stage).toBe("auto_close");
    expect(e.daysBehind).toBe(2);
  });

  it("counts how far behind it is, so a pile-up is visible rather than inferred", () => {
    const e = closeDayEscalation({ ...base, businessDate: "2026-08-16", today: "2026-08-23", nowMinutes: 12 * 60 });
    expect(e.daysBehind).toBe(7);
    expect(e.stage).toBe("auto_close");
  });
});

describe("closeDayEscalation — the timings are the property's", () => {
  it("honours a 03:00 business-day boundary", () => {
    const e = closeDayEscalation({
      ...base, closeDeadlineMinutes: 3 * 60,
      businessDate: "2026-08-22", today: "2026-08-23", nowMinutes: 2 * 60,
    });
    expect(e.stage).toBe("current"); // 02:00 is before this property's 03:00 deadline
  });

  it("honours a short reminder window", () => {
    const e = closeDayEscalation({
      ...base, reminderWindowHours: 2,
      businessDate: "2026-08-22", today: "2026-08-23", nowMinutes: 3 * 60,
    });
    expect(e.stage).toBe("auto_close"); // 00:30 + 2h = 02:30, and it is 03:00
  });
});
