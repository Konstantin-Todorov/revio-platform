import { describe, it, expect } from "vitest";
import { summariseShifts, shiftTotals, formatMinutes, SUSPECT_HOURS, type ShiftRow } from "./shifts";

const NOW = new Date("2026-08-26T18:00:00Z");
const at = (iso: string) => new Date(iso);

const row = (o: Partial<ShiftRow> & Pick<ShiftRow, "id" | "userId" | "clockInAt">): ShiftRow => ({
  userName: "Maria",
  role: "housekeeper",
  clockOutAt: null,
  clockedInById: null,
  ...o,
});

describe("summariseShifts", () => {
  it("totals a closed shift", () => {
    const [p] = summariseShifts(
      [row({ id: "1", userId: "u1", clockInAt: at("2026-08-26T08:00:00Z"), clockOutAt: at("2026-08-26T15:30:00Z") })],
      NOW,
    );
    expect(p!.closedMinutes).toBe(450);
    expect(p!.sessions[0]!.minutes).toBe(450);
    expect(p!.openCount).toBe(0);
  });

  it("never counts an open shift as worked time", () => {
    // The rule this module exists for: an unclosed shift is unknown, not zero and not elapsed-so-far.
    const [p] = summariseShifts([row({ id: "1", userId: "u1", clockInAt: at("2026-08-26T09:00:00Z") })], NOW);
    expect(p!.closedMinutes).toBe(0);
    expect(p!.openCount).toBe(1);
    expect(p!.sessions[0]!.minutes).toBeNull();
    expect(p!.sessions[0]!.open).toBe(true);
  });

  it("flags an open shift past the suspect threshold as a missed clock-out", () => {
    const [p] = summariseShifts(
      [row({ id: "1", userId: "u1", clockInAt: new Date(NOW.getTime() - (SUSPECT_HOURS + 1) * 3600_000) })],
      NOW,
    );
    expect(p!.suspectCount).toBe(1);
    expect(p!.sessions[0]!.suspect).toBe(true);
  });

  it("does not flag a long but plausible double shift", () => {
    const [p] = summariseShifts(
      [row({ id: "1", userId: "u1", clockInAt: new Date(NOW.getTime() - 14 * 3600_000) })],
      NOW,
    );
    expect(p!.suspectCount).toBe(0);
  });

  it("a CLOSED shift is never suspect, however long", () => {
    // It has an end time somebody entered. Long is a fact, not a data-quality problem.
    const [p] = summariseShifts(
      [row({ id: "1", userId: "u1", clockInAt: at("2026-08-24T00:00:00Z"), clockOutAt: at("2026-08-25T00:00:00Z") })],
      NOW,
    );
    expect(p!.suspectCount).toBe(0);
    expect(p!.closedMinutes).toBe(1440);
  });

  it("clamps a clock-out before the clock-in instead of subtracting from the total", () => {
    const [p] = summariseShifts(
      [row({ id: "1", userId: "u1", clockInAt: at("2026-08-26T15:00:00Z"), clockOutAt: at("2026-08-26T09:00:00Z") })],
      NOW,
    );
    expect(p!.closedMinutes).toBe(0);
  });

  it("groups sessions per person and keeps every role they covered", () => {
    const people = summariseShifts(
      [
        row({ id: "1", userId: "u1", clockInAt: at("2026-08-25T08:00:00Z"), clockOutAt: at("2026-08-25T12:00:00Z") }),
        row({ id: "2", userId: "u1", role: "reception", clockInAt: at("2026-08-26T08:00:00Z"), clockOutAt: at("2026-08-26T12:00:00Z") }),
        row({ id: "3", userId: "u2", userName: "Ivan", clockInAt: at("2026-08-26T08:00:00Z"), clockOutAt: at("2026-08-26T09:00:00Z") }),
      ],
      NOW,
    );
    expect(people).toHaveLength(2);
    const maria = people.find((p) => p.userId === "u1")!;
    expect(maria.roles).toEqual(["housekeeper", "reception"]);
    expect(maria.closedMinutes).toBe(480);
    expect(maria.days).toBe(2);
  });

  it("counts distinct days, not sessions — two shifts in one day is one day", () => {
    const [p] = summariseShifts(
      [
        row({ id: "1", userId: "u1", clockInAt: at("2026-08-26T06:00:00Z"), clockOutAt: at("2026-08-26T10:00:00Z") }),
        row({ id: "2", userId: "u1", clockInAt: at("2026-08-26T16:00:00Z"), clockOutAt: at("2026-08-26T20:00:00Z") }),
      ],
      NOW,
    );
    expect(p!.days).toBe(1);
    expect(p!.sessions).toHaveLength(2);
  });

  it("records that a supervisor clocked someone in", () => {
    const [p] = summariseShifts(
      [row({ id: "1", userId: "u1", clockInAt: at("2026-08-26T08:00:00Z"), clockedInById: "sup1" })],
      NOW,
    );
    expect(p!.sessions[0]!.delegated).toBe(true);
  });

  it("lists newest session first", () => {
    const [p] = summariseShifts(
      [
        row({ id: "old", userId: "u1", clockInAt: at("2026-08-20T08:00:00Z"), clockOutAt: at("2026-08-20T09:00:00Z") }),
        row({ id: "new", userId: "u1", clockInAt: at("2026-08-26T08:00:00Z"), clockOutAt: at("2026-08-26T09:00:00Z") }),
      ],
      NOW,
    );
    expect(p!.sessions.map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("handles an empty window", () => {
    expect(summariseShifts([], NOW)).toEqual([]);
  });
});

describe("shiftTotals", () => {
  it("sums across people and carries the caveats, not just the number", () => {
    const people = summariseShifts(
      [
        row({ id: "1", userId: "u1", clockInAt: at("2026-08-26T08:00:00Z"), clockOutAt: at("2026-08-26T12:00:00Z") }),
        row({ id: "2", userId: "u2", userName: "Ivan", clockInAt: at("2026-08-26T08:00:00Z") }),
      ],
      NOW,
    );
    const t = shiftTotals(people);
    expect(t.people).toBe(2);
    expect(t.closedMinutes).toBe(240);
    // The open shift is surfaced beside the total rather than folded into it.
    expect(t.openCount).toBe(1);
  });
});

describe("formatMinutes", () => {
  it("formats hours and minutes", () => {
    expect(formatMinutes(450)).toBe("7h 30m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(45)).toBe("45m");
  });

  it("renders an open shift as a dash, never as a duration", () => {
    expect(formatMinutes(null)).toBe("—");
  });
});
