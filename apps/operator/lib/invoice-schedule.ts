/**
 * When to remind a customer about an unpaid invoice — three letters at most, spaced, never nagging.
 *
 *   1st  — 3 days BEFORE the due date: a friendly heads-up ("soon").
 *   2nd  — 1 day AFTER it: "we have not received it" ("overdue").
 *   3rd  — 7 days after it: the same, once more ("overdue").
 *
 * After that a person takes over (the Operator's attention feed already flags overdue invoices) —
 * an automatic fourth mail is where a reminder becomes a dunning campaign, and a hotel that forgot
 * is a customer to call, not a debtor to chase.
 *
 * At least two days between any two letters, so a late run never sends two in a row.
 */
const DAY = 86_400_000;

export function reminderStage(input: {
  dueDate: Date | null;
  remindersSent: number;
  lastReminderAt: Date | null;
  now: Date;
}): "soon" | "overdue" | null {
  const { dueDate, remindersSent, lastReminderAt, now } = input;
  if (!dueDate) return null;
  if (lastReminderAt && now.getTime() - lastReminderAt.getTime() < 2 * DAY) return null;
  const t = now.getTime();
  const due = dueDate.getTime();
  if (remindersSent === 0 && t >= due - 3 * DAY && t < due + DAY) return "soon";
  if (remindersSent <= 1 && t >= due + DAY && t < due + 7 * DAY) return "overdue";
  if (remindersSent <= 2 && t >= due + 7 * DAY) return "overdue";
  return null;
}
