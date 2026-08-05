import { describe, expect, it } from "vitest";
import { ordinal, recogniseGuest } from "./recognition.js";

describe("recogniseGuest", () => {
  it("does not recognise a first-time guest", () => {
    const r = recogniseGuest({ priorStayCount: 0, lastStayDate: null, optedOut: false });
    expect(r.isReturning).toBe(false);
    expect(r.staffSummary).toBeNull();
  });

  it("recognises a returning guest and counts the CURRENT stay in the ordinal", () => {
    // Two prior stays makes this the third — off-by-one here would have a receptionist greeting a
    // third-time guest as a second-timer, which is worse than saying nothing.
    const r = recogniseGuest({ priorStayCount: 2, lastStayDate: "2026-03-14", optedOut: false });
    expect(r.isReturning).toBe(true);
    expect(r.staffSummary).toBe("Returning guest · 3rd stay · last stayed 2026-03-14");
  });

  it("suppresses everything on opt-out, however many stays there are", () => {
    // The point of the flag. Staff cannot know a guest opted out unless the screen stays silent,
    // so the summary must be null rather than merely unflagged.
    const r = recogniseGuest({ priorStayCount: 9, lastStayDate: "2026-01-01", optedOut: true });
    expect(r.isReturning).toBe(false);
    expect(r.staffSummary).toBeNull();
  });

  it("keeps the raw counts even when suppressed", () => {
    // Opting out of being greeted is not opting out of existing: the hotel still has to be able to
    // account for stays it is legally required to retain.
    const r = recogniseGuest({ priorStayCount: 9, lastStayDate: "2026-01-01", optedOut: true });
    expect(r.priorStayCount).toBe(9);
    expect(r.lastStayDate).toBe("2026-01-01");
  });

  it("handles a returning guest whose last stay date is unknown", () => {
    const r = recogniseGuest({ priorStayCount: 1, lastStayDate: null, optedOut: false });
    expect(r.staffSummary).toBe("Returning guest · 2nd stay");
  });
});

describe("ordinal", () => {
  it("uses st/nd/rd/th", () => {
    expect([1, 2, 3, 4, 5].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "5th"]);
  });

  it("handles the 11th-13th exceptions", () => {
    // "11st" is the classic bug and the one a guest would actually notice.
    expect([11, 12, 13].map(ordinal)).toEqual(["11th", "12th", "13th"]);
  });

  it("resumes after the exceptions", () => {
    expect([21, 22, 23, 101, 111, 112].map(ordinal)).toEqual(["21st", "22nd", "23rd", "101st", "111th", "112th"]);
  });
});
