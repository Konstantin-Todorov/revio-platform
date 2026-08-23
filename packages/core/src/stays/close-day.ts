/**
 * When is a business day overdue, and when does the system close it itself?
 *
 * The problem this solves is accumulation. A day that is not closed stays open and still due, so
 * missing seven in a row means the eighth requires closing seven times — and by then the property's
 * daily record is a work of fiction. It is the same failure as the round-2 deadlock in different
 * clothes: a required process that can silently get stuck, with nothing guaranteeing it resolves.
 *
 * So there are two stages and a hard floor:
 *   1. Past the close deadline → REMIND the people who can act. Dismissable, but it comes back.
 *   2. Past the reminder window → the system CLOSES the day. Not a date-roll: the same financial
 *      close a human would run, recorded as having had no human in it.
 *
 * The consequence is that **at most one day is ever open past its deadline**, and it resolves
 * itself. "Eight days behind" stops being reachable.
 */

export interface CloseDayEscalationInput {
  /** The business day the property is still on, `YYYY-MM-DD` in its own timezone. */
  businessDate: string;
  /** Today in the property's timezone, `YYYY-MM-DD`. */
  today: string;
  /** Minutes past midnight, now, in the property's timezone. */
  nowMinutes: number;
  /** Minutes past midnight of the day AFTER `businessDate` at which the reminder starts. */
  closeDeadlineMinutes: number;
  /** Hours the reminder may be dismissed before the system closes the day. */
  reminderWindowHours: number;
  /** A property may opt out of the automatic close; it still gets the reminder. */
  autoCloseEnabled: boolean;
}

export type CloseDayStage =
  /** The day is current, or not yet past its deadline. Nothing to say. */
  | "current"
  /** Past the deadline: nudge whoever can close it. */
  | "reminder"
  /** Past the reminder window: the system closes it. */
  | "auto_close"
  /** Past the window but the property switched auto-close off. Keeps nagging, never acts. */
  | "overdue_no_auto";

export interface CloseDayEscalation {
  stage: CloseDayStage;
  /** Whole days between the business date and today. 0 = same day, 1 = one behind, … */
  daysBehind: number;
  /** Minutes since the close deadline passed; 0 before it. */
  minutesOverdue: number;
  /** True while the reminder may still be dismissed — i.e. before auto-close is due. */
  dismissable: boolean;
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function closeDayEscalation(input: CloseDayEscalationInput): CloseDayEscalation {
  const {
    businessDate, today, nowMinutes,
    closeDeadlineMinutes, reminderWindowHours, autoCloseEnabled,
  } = input;

  const daysBehind = daysBetween(businessDate, today);

  // The day the property is on has not ended yet. Nothing is late.
  if (daysBehind <= 0) {
    return { stage: "current", daysBehind: Math.max(0, daysBehind), minutesOverdue: 0, dismissable: true };
  }

  // Minutes from the deadline (which sits on the day AFTER the business date) to now. A day two
  // behind is a whole extra 1440 minutes overdue, which is what makes the escalation bite harder
  // the longer it is left — without needing a separate rule for it.
  const minutesSinceDeadline = (daysBehind - 1) * 1440 + (nowMinutes - closeDeadlineMinutes);

  if (minutesSinceDeadline < 0) {
    // Same calendar day as the deadline, but the clock has not reached it. Not yet due.
    return { stage: "current", daysBehind, minutesOverdue: 0, dismissable: true };
  }

  const windowMinutes = reminderWindowHours * 60;
  if (minutesSinceDeadline < windowMinutes) {
    return { stage: "reminder", daysBehind, minutesOverdue: minutesSinceDeadline, dismissable: true };
  }

  return {
    stage: autoCloseEnabled ? "auto_close" : "overdue_no_auto",
    daysBehind,
    minutesOverdue: minutesSinceDeadline,
    // Past the window there is nothing left to dismiss: either the system is about to act, or the
    // property has chosen that nothing will, and hiding that would be the wrong kindness.
    dismissable: false,
  };
}
