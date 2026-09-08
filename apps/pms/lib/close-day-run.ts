import "server-only";
import { forTenant, withTenantTransaction } from "@revio/db";
import { closeDayEscalation } from "@revio/core";
import { accrueStayExtras, folioBalance } from "./folio";
import { logAudit, recordSync } from "./mutation-helpers";
import { todayInTz, minutesOfDayInTz, addDaysYmd, utcDay, ymd } from "./format";

/*
 * DELIBERATELY NOT a "use server" module.
 *
 * `runCloseDay` takes tenantId and propertyId as arguments. Exported from an actions file, Next
 * would publish it as a POST endpoint — and an endpoint that closes whichever property it is handed
 * is a way to roll another hotel's business date. authz-lint caught exactly that when this first
 * landed in actions-closeday.ts.
 *
 * It lives here as an ordinary library function instead. The two callers each apply their own
 * authorisation before reaching it: the manual action gates on the `manage` capability and passes
 * the SESSION's tenant, and the cron route gates on CRON_SECRET and sweeps every property on the
 * system perimeter, which is the one context where crossing tenants is the point.
 */

/**
 * Close one business day. THE close — there is no second, lighter path.
 *
 * Both the manual "Close Day" button and the automatic escalation (§3) call this, deliberately: an
 * auto-close is a real financial close, not a date-roll, and giving it its own cheaper implementation
 * is how the two drift until the unattended one is the buggy one. The only difference is `actor`,
 * which is recorded rather than inferred.
 *
 * ATOMIC. No-shows, the extras accrual and the business-date roll commit together or not at all. A
 * close that marked half the no-shows and then failed would leave a day that is neither closed nor
 * safely re-closable, which is the accumulation problem arriving by another route.
 *
 * Readiness items — unsettled balances, guests still in house past their departure — do NOT block it
 * (§3.5). A manual close warns and lets a human decide; an automatic one has no human to read the
 * warning, and leaving the day open waiting for someone who is not there is the failure this exists
 * to prevent. They are carried forward and named on the record instead.
 *
 * Throws `DayAlreadyClosedError` when someone else closed this day first. Both callers treat that as
 * a normal outcome rather than a fault — because it is one.
 */
/**
 * Thrown when the business date moved between reading it and rolling it.
 *
 * Two paths reach `runCloseDay` — the manual button and the §3 cron — and only the cron takes a job
 * lease. A click landing while the automatic run is mid-property is therefore not exotic; 03:00 is
 * exactly when both want to act.
 *
 * A lease on the button would not have been enough on its own. A lease only serialises runs that
 * overlap in TIME, and the dangerous case here is SEQUENTIAL: close, roll D → D+1, and a second
 * close moments later reads D+1 and rolls to D+2. A day is skipped and nothing objects. The
 * caller's expected date refuses sequential stale submissions. The conditional roll additionally
 * serialises overlapping runs. Comparing only with a date read inside this invocation does NOT
 * protect the intent of a screen rendered before another close.
 */
export class DayAlreadyClosedError extends Error {
  constructor(readonly businessDate: string) {
    super(`Business day ${businessDate} was already closed by another run.`);
    this.name = "DayAlreadyClosedError";
  }
}

export class InvalidCloseDayError extends Error {
  constructor() {
    super("Reload Close Day and review the date before closing it.");
    this.name = "InvalidCloseDayError";
  }
}

export interface CloseDayOutcome {
  businessDate: string;
  next: string;
  noShows: number;
  accrued: number;
  /** Named on the record so an unattended close never silently swallows what was outstanding. */
  carriedForward: string[];
}

export async function runCloseDay(
  tenantId: string,
  propertyId: string,
  actor: { kind: "user"; userId: string } | { kind: "system" },
  expectedBusinessDate: string,
): Promise<CloseDayOutcome | null> {
  /*
   * Its OWN tenant-scoped client, not the request proxy.
   *
   * `apps/pms/lib/db.ts` resolves the tenant from the session cookie, and the automatic close runs
   * from cron for properties nobody is logged into. It already knows the tenant — it is an argument
   * — so it scopes itself directly. RLS is intact either way: `forTenant` sets the same GUC the
   * proxy would have.
   */
  const prisma = forTenant(tenantId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedBusinessDate) ||
      Number.isNaN(utcDay(expectedBusinessDate).getTime()) ||
      ymd(utcDay(expectedBusinessDate)) !== expectedBusinessDate) {
    throw new InvalidCloseDayError();
  }

  const outcome = await withTenantTransaction(tenantId, async (tx) => {
    const property = await tx.property.findUnique({ where: { id: propertyId } });
    if (!property) return null;
    const today = todayInTz(property.timezone);
    const businessDate = property.businessDate ? ymd(property.businessDate) : today;
    if (businessDate !== expectedBusinessDate) throw new DayAlreadyClosedError(expectedBusinessDate);
    const next = addDaysYmd(businessDate, 1);

    if (actor.kind === "system") {
      const defaults = await tx.propertyDefaults.findUnique({ where: { propertyId } });
      const escalation = closeDayEscalation({
        businessDate, today, nowMinutes: minutesOfDayInTz(property.timezone),
        closeDeadlineMinutes: defaults?.closeDeadlineMinutes ?? 30,
        reminderWindowHours: defaults?.closeReminderWindowHours ?? 22,
        autoCloseEnabled: defaults?.autoCloseEnabled ?? true,
      });
      if (escalation.stage !== "auto_close") return null;
    }

    // Claim the date before posting anything. PostgreSQL holds the property row lock until commit;
    // an overlapping close waits, then its old-date predicate fails. This roll is not visible until
    // accrual AND audit succeed; any failure, including a timeout, rolls all of them back.
    const { count } = await tx.property.updateMany({
      where: { id: propertyId, businessDate: property.businessDate },
      data: {
        businessDate: utcDay(next), lastClosedAt: new Date(),
        lastCloseWasAutomatic: actor.kind === "system",
      },
    });
    if (count !== 1) throw new DayAlreadyClosedError(expectedBusinessDate);

    // Snapshot the outstanding items before no-shows and accrual, for the day being closed.
    const carriedForward: string[] = [];
    const openWithBalance = await tx.folio.findMany({
      where: { propertyId, status: "open" },
      include: { lines: { select: { kind: true, amountMinor: true, voided: true } } },
    });
    const unsettled = openWithBalance.filter((f) => folioBalance(f.lines).balance !== 0).length;
    if (unsettled > 0) carriedForward.push(`${unsettled} unsettled balance${unsettled === 1 ? "" : "s"}`);

    const stillIn = await tx.roomAssignment.count({
      where: {
        propertyId, status: "active", checkedOutAt: null,
        checkOut: { lte: utcDay(businessDate) },
        reservation: { departedAt: null },
      },
    });
    if (stillIn > 0) carriedForward.push(`${stillIn} guest${stillIn === 1 ? "" : "s"} past departure and still in house`);

    const candidates = await tx.reservation.findMany({
      where: { propertyId, status: { in: ["confirmed", "modified"] } },
      include: { lines: true, assignments: true },
    });

    let noShows = 0;
    for (const r of candidates) {
      if (r.assignments.length > 0 || r.lines.length === 0) continue; // arrived, or no stay
      const ci = ymd(r.lines.map((l) => l.checkIn).sort((a, b) => a.getTime() - b.getTime())[0]!);
      if (ci <= businessDate) {
        await tx.reservation.update({ where: { id: r.id }, data: { status: "no_show" } });
        noShows++;
      }
    }

    // Idempotency alone cannot rescue a stranded night after its date has advanced. Every helper
    // receives this transaction client, including initial folio seeding and the shared posting service.
    const accrued = await accrueStayExtras(tenantId, propertyId, businessDate, tx);

    const carried = carriedForward.length > 0 ? ` · carried forward: ${carriedForward.join(", ")}` : "";
    await logAudit(propertyId, tenantId, {
      entity: "close_day",
      field: businessDate,
      oldValue: actor.kind === "system" ? "closed automatically by system" : "closed by staff",
      newValue: `${noShows} no-show(s) · ${accrued} extra(s) accrued · rolled to ${next}${carried}`,
      ...(actor.kind === "user" ? { userId: actor.userId } : {}),
    }, tx);

    return { businessDate, next, noShows, accrued, carriedForward };
  });

  // Boundary rule: the close itself is operational (audit above). Only its availability effect
  // (no-show rooms released back to sale) is channel-facing.
  if (outcome && outcome.noShows > 0) {
    // External delivery remains best-effort and outside financial locks. A delivery/event failure
    // must not report the committed financial close as failed and invite a retry of the next day.
    try {
      await recordSync(propertyId, tenantId, "Availability restored — no-show rooms released", `${outcome.noShows} room(s) returned to sale`, undefined, prisma);
    } catch (error) {
      console.warn("Close Day committed; availability sync failed", { propertyId, businessDate: outcome.businessDate, error });
    }
  }

  return outcome;
}
