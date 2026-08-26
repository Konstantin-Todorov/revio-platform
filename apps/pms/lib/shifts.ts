/**
 * Shift history — who worked, when, and for how long.
 *
 * ## What was already there, and what was missing
 *
 * `StaffShift` has recorded every clock-in since the workforce feature shipped: who, which role,
 * in, out, and whether a supervisor did it for them. `OpsEvent` records what happened during the
 * shift. **Both were write-only.** Every read in `workforce.ts` asks the same question — who is on
 * shift *right now* — so a manager could see the floor and could not see yesterday.
 *
 * That is the gap this closes, and it is a reading gap, not a recording one. Nothing new is
 * captured; the rows were always there.
 *
 * ## What this is NOT
 *
 * **Not payroll, not attendance, not HR** — stated in the schema when the table was designed, and
 * repeated here because a screen showing hours worked is exactly the thing that gets quietly
 * promoted into a timesheet. It is an operational record: who was available, when cover was thin,
 * whether the clock-in habit is real enough to trust the assignment engine that depends on it.
 *
 * A shift with no clock-out is **not** "0 hours" and must never be totalled as if it were. Somebody
 * forgot, and the honest output says so — see `openShifts`.
 *
 * Pure. Rows in, summary out.
 */

export interface ShiftRow {
  id: string;
  userId: string;
  userName: string;
  role: string;
  clockInAt: Date;
  clockOutAt: Date | null;
  /** Set when a supervisor clocked them in rather than the person doing it themselves. */
  clockedInById: string | null;
}

export interface ShiftSession {
  id: string;
  role: string;
  clockInAt: Date;
  clockOutAt: Date | null;
  minutes: number | null;
  delegated: boolean;
  /** Still running at the moment this was computed. */
  open: boolean;
  /** Open for longer than a plausible shift — almost certainly a missed clock-out. */
  suspect: boolean;
}

export interface PersonShifts {
  userId: string;
  userName: string;
  /** Every role they worked in the window — a person can cover more than one. */
  roles: string[];
  sessions: ShiftSession[];
  /** Total of CLOSED sessions only. Open ones are reported separately, never estimated. */
  closedMinutes: number;
  /** How many sessions are still open, so the total can be read with the right caveat. */
  openCount: number;
  /** Sessions that ran past `SUSPECT_HOURS` without a clock-out. */
  suspectCount: number;
  days: number;
}

/**
 * Past this, an open shift is a forgotten clock-out rather than a long day.
 *
 * A double shift in a hotel is real and can reach fourteen hours. Sixteen is the point where the
 * likelier explanation is that somebody went home without pressing the button — so it is flagged,
 * not corrected: the software does not know when they left and must not invent a time.
 */
export const SUSPECT_HOURS = 16;

export function summariseShifts(rows: readonly ShiftRow[], now: Date = new Date()): PersonShifts[] {
  const byPerson = new Map<string, PersonShifts>();

  for (const r of rows) {
    let p = byPerson.get(r.userId);
    if (!p) {
      p = {
        userId: r.userId,
        userName: r.userName,
        roles: [],
        sessions: [],
        closedMinutes: 0,
        openCount: 0,
        suspectCount: 0,
        days: 0,
      };
      byPerson.set(r.userId, p);
    }
    if (!p.roles.includes(r.role)) p.roles.push(r.role);

    const open = r.clockOutAt === null;
    const end = r.clockOutAt ?? now;
    const rawMinutes = Math.round((end.getTime() - r.clockInAt.getTime()) / 60000);
    // A clock-out before the clock-in is corrupt data, not negative time. Clamped rather than
    // propagated into a total that would then read as less work than actually happened.
    const minutes = Math.max(0, rawMinutes);
    const suspect = open && minutes > SUSPECT_HOURS * 60;

    p.sessions.push({
      id: r.id,
      role: r.role,
      clockInAt: r.clockInAt,
      clockOutAt: r.clockOutAt,
      // An open session has no duration yet. `minutes` on an open row is elapsed-so-far and is
      // deliberately not fed into `closedMinutes`.
      minutes: open ? null : minutes,
      delegated: r.clockedInById !== null,
      open,
      suspect,
    });

    if (open) {
      p.openCount += 1;
      if (suspect) p.suspectCount += 1;
    } else {
      p.closedMinutes += minutes;
    }
  }

  for (const p of byPerson.values()) {
    p.sessions.sort((a, b) => b.clockInAt.getTime() - a.clockInAt.getTime());
    // Distinct calendar days worked — the number that says "three long days" apart from "eight
    // short ones", which the total alone hides.
    p.days = new Set(p.sessions.map((s) => dayKey(s.clockInAt))).size;
  }

  // Most hours first, because the question this screen answers is usually about cover.
  return [...byPerson.values()].sort((a, b) => b.closedMinutes - a.closedMinutes);
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** `7h 20m`. Null (an open shift) is never rendered as a duration. */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export interface ShiftTotals {
  people: number;
  closedMinutes: number;
  openCount: number;
  suspectCount: number;
}

export function shiftTotals(people: readonly PersonShifts[]): ShiftTotals {
  return {
    people: people.length,
    closedMinutes: people.reduce((s, p) => s + p.closedMinutes, 0),
    openCount: people.reduce((s, p) => s + p.openCount, 0),
    suspectCount: people.reduce((s, p) => s + p.suspectCount, 0),
  };
}
