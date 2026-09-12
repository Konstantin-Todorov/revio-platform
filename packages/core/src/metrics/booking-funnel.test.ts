import { describe, it, expect } from "vitest";
import {
  funnelByRoomType, funnelSessions, funnelStayComparison, funnelTotals, sessionLeadDays,
  sessionNights, type FunnelHold,
} from "./booking-funnel.js";

const T = (iso: string) => new Date(iso);

function hold(over: Partial<FunnelHold> = {}): FunnelHold {
  return {
    status: "converted",
    sessionId: null,
    roomTypeId: "deluxe",
    createdAt: T("2026-09-01T10:00:00Z"),
    checkIn: "2026-09-20",
    checkOut: "2026-09-23",
    ...over,
  };
}

describe("funnelSessions", () => {
  it("⚠️ one guest comparing two rooms and booking one is ONE session that converted", () => {
    // THE defect this module exists for. Counted by hold this is 1 booked + 1 abandoned, and the
    // conversion rate comes out at 50% when the truth is 100%.
    const sessions = funnelSessions([
      hold({ sessionId: "s1", roomTypeId: "deluxe", status: "expired", createdAt: T("2026-09-01T10:00:00Z") }),
      hold({ sessionId: "s1", roomTypeId: "standard", status: "converted", createdAt: T("2026-09-01T10:04:00Z") }),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.outcome).toBe("booked");
    expect(funnelTotals(sessions)).toMatchObject({ started: 1, booked: 1, stopped: 0, conversionRate: 1 });
  });

  it("credits the booking to the room that WON, not the one opened first", () => {
    const [s] = funnelSessions([
      hold({ sessionId: "s1", roomTypeId: "deluxe", status: "expired", createdAt: T("2026-09-01T10:00:00Z") }),
      hold({ sessionId: "s1", roomTypeId: "standard", status: "converted", createdAt: T("2026-09-01T10:04:00Z") }),
    ]);
    expect(s!.decidedRoomTypeId).toBe("standard");
    // …while still recording that both were seen, in the order they were opened.
    expect(s!.roomTypeIds).toEqual(["deluxe", "standard"]);
  });

  it("takes the session's start from the EARLIEST hold, whatever order they arrive in", () => {
    const [s] = funnelSessions([
      hold({ sessionId: "s1", createdAt: T("2026-09-01T10:09:00Z"), status: "converted" }),
      hold({ sessionId: "s1", createdAt: T("2026-09-01T10:00:00Z"), status: "expired" }),
    ]);
    expect(s!.createdAt.toISOString()).toBe("2026-09-01T10:00:00.000Z");
  });

  it("best outcome wins over every other ending", () => {
    const rank: [FunnelHold["status"], string][] = [
      ["converted", "booked"], ["active", "looking"], ["released", "left"], ["expired", "stopped"],
    ];
    for (const [better, label] of rank) {
      const [s] = funnelSessions([
        hold({ sessionId: "x", status: "expired", createdAt: T("2026-09-01T10:00:00Z") }),
        hold({ sessionId: "x", status: better, createdAt: T("2026-09-01T10:01:00Z") }),
      ]);
      expect(s!.outcome).toBe(label);
    }
  });

  it("a hold with no session id is its own session — correct for staff", () => {
    // A receptionist holding two rooms really is holding two rooms.
    const sessions = funnelSessions([
      hold({ sessionId: null, roomTypeId: "deluxe", createdAt: T("2026-09-01T10:00:00Z") }),
      hold({ sessionId: null, roomTypeId: "deluxe", createdAt: T("2026-09-01T10:00:00Z") }),
    ]);
    expect(sessions).toHaveLength(2);
  });
});

describe("funnelTotals", () => {
  const base = [
    hold({ sessionId: "a", status: "converted" }),
    hold({ sessionId: "b", status: "released" }),
    hold({ sessionId: "c", status: "expired" }),
    hold({ sessionId: "d", status: "active" }),
  ];

  it("keeps 'left' and 'stopped' apart — they need different fixes", () => {
    const t = funnelTotals(funnelSessions(base));
    expect(t).toMatchObject({ started: 4, booked: 1, left: 1, stopped: 1, looking: 1 });
  });

  it("⚠️ excludes sessions still in progress from the rate", () => {
    // 1 booked of 3 DECIDED = 33%, not 1 of 4 = 25%. A guest typing their name right now has not
    // abandoned anything, and counting them makes the figure depend on the minute you looked.
    const t = funnelTotals(funnelSessions(base));
    expect(t.decided).toBe(3);
    expect(t.conversionRate).toBeCloseTo(1 / 3, 10);
  });

  it("returns null rather than 0% when nobody has decided yet", () => {
    // "No conversions" and "nobody has finished" are different facts; 0% on a quiet week reads as
    // a catastrophe rather than as silence.
    const t = funnelTotals(funnelSessions([hold({ sessionId: "a", status: "active" })]));
    expect(t.conversionRate).toBeNull();
    expect(t.looking).toBe(1);
  });

  it("is all zeroes and null on no data at all", () => {
    expect(funnelTotals([])).toMatchObject({ started: 0, booked: 0, decided: 0, conversionRate: null });
  });
});

describe("funnelByRoomType", () => {
  it("⚠️ divides each room by its OWN sessions, not by the total", () => {
    // Deluxe: 1 of 1 decided = 100%. Standard: 1 of 3 = 33%. Against the total (4) deluxe would
    // read 25% — the room nobody opens would always look like the worst performer, when what it
    // has is a visibility problem. Opposite diagnosis, opposite fix.
    const rows = funnelByRoomType(funnelSessions([
      hold({ sessionId: "a", roomTypeId: "deluxe", status: "converted" }),
      hold({ sessionId: "b", roomTypeId: "standard", status: "converted" }),
      hold({ sessionId: "c", roomTypeId: "standard", status: "expired" }),
      hold({ sessionId: "d", roomTypeId: "standard", status: "released" }),
    ]));
    const deluxe = rows.find((r) => r.roomTypeId === "deluxe")!;
    const standard = rows.find((r) => r.roomTypeId === "standard")!;
    expect(deluxe.conversionRate).toBe(1);
    expect(standard.conversionRate).toBeCloseTo(1 / 3, 10);
  });

  it("orders by how much attention a room gets", () => {
    const rows = funnelByRoomType(funnelSessions([
      hold({ sessionId: "a", roomTypeId: "quiet", status: "converted" }),
      hold({ sessionId: "b", roomTypeId: "busy", status: "expired" }),
      hold({ sessionId: "c", roomTypeId: "busy", status: "expired" }),
    ]));
    expect(rows.map((r) => r.roomTypeId)).toEqual(["busy", "quiet"]);
  });

  it("reports null, not 0%, for a room whose only session is still open", () => {
    const [row] = funnelByRoomType(funnelSessions([hold({ sessionId: "a", status: "active" })]));
    expect(row!.sessions).toBe(1);
    expect(row!.conversionRate).toBeNull();
  });
});

describe("stay shape", () => {
  it("counts nights between the two dates", () => {
    expect(sessionNights(funnelSessions([hold({ sessionId: "a", checkIn: "2026-09-20", checkOut: "2026-09-23" })])[0]!)).toBe(3);
  });

  it("measures lead time from the day they looked", () => {
    const [s] = funnelSessions([hold({ sessionId: "a", createdAt: T("2026-09-01T10:00:00Z"), checkIn: "2026-09-20" })]);
    expect(sessionLeadDays(s!)).toBe(19);
  });

  it("clamps a same-day look-and-arrive to 0 rather than going negative", () => {
    const [s] = funnelSessions([hold({ sessionId: "a", createdAt: T("2026-09-20T22:00:00Z"), checkIn: "2026-09-20" })]);
    expect(sessionLeadDays(s!)).toBe(0);
  });

  it("compares what bookers wanted with what leavers wanted — the reservation table cannot", () => {
    // An abandoned stay has no reservation, so these dates exist nowhere else.
    const cmp = funnelStayComparison(funnelSessions([
      hold({ sessionId: "a", status: "converted", checkIn: "2026-09-20", checkOut: "2026-09-22" }),
      hold({ sessionId: "b", status: "expired", checkIn: "2026-09-20", checkOut: "2026-09-27" }),
      hold({ sessionId: "c", status: "released", checkIn: "2026-09-20", checkOut: "2026-09-27" }),
    ]));
    expect(cmp.nights.booked).toBe(2);
    expect(cmp.nights.abandoned).toBe(7);
  });

  it("uses the median so one long block cannot move the whole month", () => {
    const cmp = funnelStayComparison(funnelSessions([
      hold({ sessionId: "a", status: "converted", checkIn: "2026-09-20", checkOut: "2026-09-22" }),
      hold({ sessionId: "b", status: "converted", checkIn: "2026-09-20", checkOut: "2026-09-23" }),
      hold({ sessionId: "c", status: "converted", checkIn: "2026-09-20", checkOut: "2026-10-30" }),
    ]));
    expect(cmp.nights.booked).toBe(3); // median, not the 15-night mean
  });

  it("says null rather than guessing when a side has nobody in it", () => {
    const cmp = funnelStayComparison(funnelSessions([hold({ sessionId: "a", status: "converted" })]));
    expect(cmp.nights.abandoned).toBeNull();
  });
});
