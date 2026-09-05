import "server-only";
import { forSystem } from "@revio/db";
import { closeDayEscalation } from "@revio/core";
import { DayAlreadyClosedError, runCloseDay } from "./close-day-run";
import { ymd, todayInTz, minutesOfDayInTz } from "./format";

/**
 * Close every business day that is past its reminder window (round-2 §3.2).
 *
 * The escalation this completes: past the deadline the people who can act are reminded, and past the
 * reminder window the system closes the day itself. The result is that **at most one day is ever
 * open past its deadline** and it resolves without anyone — "eight days behind, close it eight
 * times" stops being a state the product can reach.
 *
 * It calls the SAME `runCloseDay` the button calls. An auto-close is a real financial close: it
 * marks no-shows, accrues the night's recurring extras and rolls the business date, atomically. The
 * only thing that differs is that the actor is the system, and that is recorded rather than left to
 * be inferred from an empty `userId`.
 *
 * Readiness items do not stop it (§3.5). A manual close warns a human and lets them decide; there is
 * no human here, and leaving the day open waiting for one is precisely the failure. What was
 * outstanding is carried forward and named on the record instead.
 *
 * @param db a SYSTEM-perimeter client. This runs with no session, for tenants no request arrived
 *           for, so it cannot be tenant-scoped at the top the way a request can.
 */
export async function autoCloseOverdueDays(
  db: ReturnType<typeof forSystem>,
): Promise<{ closed: number; skipped: number; details: string[] }> {
  const properties = await db.property.findMany({
    where: { businessDate: { not: null } },
    select: { id: true, tenantId: true, name: true, timezone: true, businessDate: true },
  });

  if (properties.length === 0) return { closed: 0, skipped: 0, details: [] };

  const defaults = await db.propertyDefaults.findMany({
    where: { propertyId: { in: properties.map((p) => p.id) } },
    select: { propertyId: true, closeDeadlineMinutes: true, closeReminderWindowHours: true, autoCloseEnabled: true },
  });
  const byProperty = new Map(defaults.map((d) => [d.propertyId, d]));

  let closed = 0;
  let skipped = 0;
  const details: string[] = [];

  for (const p of properties) {
    const d = byProperty.get(p.id);
    const escalation = closeDayEscalation({
      businessDate: ymd(p.businessDate!),
      today: todayInTz(p.timezone),
      nowMinutes: minutesOfDayInTz(p.timezone),
      closeDeadlineMinutes: d?.closeDeadlineMinutes ?? 30,
      reminderWindowHours: d?.closeReminderWindowHours ?? 22,
      autoCloseEnabled: d?.autoCloseEnabled ?? true,
    });

    if (escalation.stage !== "auto_close") {
      skipped++;
      continue;
    }

    /*
     * ONE day per run, not a catch-up loop.
     *
     * A property that is genuinely several days behind gets one day closed per tick, and the next
     * tick takes the next. Closing five days in a row inside one request would post five nights of
     * extras and roll the date five times against a house whose occupancy nobody re-read in between
     * — a lot of money written on an assumption. Draining it one day at a time keeps every close a
     * close, and the backlog still disappears without anyone touching it.
     */
    let outcome;
    try {
      outcome = await runCloseDay(p.tenantId, p.id, { kind: "system" });
    } catch (err) {
      // Somebody pressed Close Day while we were working through the list. Their close is a real
      // close; ours would have been a second one. Counted as skipped, and one property's race must
      // never abandon the rest of the sweep.
      if (err instanceof DayAlreadyClosedError) {
        skipped++;
        details.push(`${p.name}: already closed by staff during this run`);
        continue;
      }
      throw err;
    }
    if (outcome) {
      closed++;
      details.push(
        `${p.name}: closed ${outcome.businessDate} → ${outcome.next}` +
          (outcome.carriedForward.length ? ` (carried: ${outcome.carriedForward.join(", ")})` : ""),
      );
    }
  }

  return { closed, skipped, details };
}
