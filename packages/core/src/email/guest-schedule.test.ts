import { describe, expect, it } from "vitest";
import { guestMailDue } from "./guest-schedule.js";

const base = { status: "confirmed", checkIn: "2026-10-04", checkOut: "2026-10-06", departed: false, preArrivalMailed: false, postStayMailed: false };
const morning = { today: "2026-10-01", localHour: 10 };

describe("guestMailDue", () => {
  it("before arrival: three days out, in the hotel's morning", () => {
    expect(guestMailDue(base, morning)).toBe("pre_arrival");
    expect(guestMailDue(base, { ...morning, localHour: 7 })).toBeNull();
    expect(guestMailDue({ ...base, checkIn: "2026-10-05" }, morning)).toBeNull();
  });
  it("a late booking still gets it — until arrival day", () => {
    expect(guestMailDue({ ...base, checkIn: "2026-10-02" }, morning)).toBe("pre_arrival");
    expect(guestMailDue({ ...base, checkIn: "2026-10-01" }, morning)).toBeNull();
  });
  it("once, and never for a cancelled stay", () => {
    expect(guestMailDue({ ...base, preArrivalMailed: true }, morning)).toBeNull();
    expect(guestMailDue({ ...base, status: "cancelled" }, morning)).toBeNull();
  });
  it("after departure: the morning after, one day of catch-up, never older stays", () => {
    const left = { ...base, checkIn: "2026-09-27", checkOut: "2026-09-30", departed: true };
    expect(guestMailDue(left, morning)).toBe("post_stay");
    expect(guestMailDue({ ...left, checkOut: "2026-09-29" }, morning)).toBe("post_stay");
    expect(guestMailDue({ ...left, checkOut: "2026-09-28" }, morning)).toBeNull();
    expect(guestMailDue({ ...left, status: "no_show" }, morning)).toBeNull();
    expect(guestMailDue({ ...left, postStayMailed: true }, morning)).toBeNull();
  });
});
