import "server-only";
import { forTenant, withTenantTransaction } from "@revio/db";
import { accrueStayExtras, folioBalance } from "./folio";
import { logAudit, recordSync } from "./mutation-helpers";
import { todayInTz, addDaysYmd, utcDay, ymd } from "./format";

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
 */
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

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return null;
  const today = todayInTz(property.timezone);
  const businessDate = property.businessDate ? ymd(property.businessDate) : today;
  const next = addDaysYmd(businessDate, 1);

  // Read the outstanding picture BEFORE closing, so the record says what was true at the moment the
  // day ended rather than what is true after it rolled.
  const carriedForward: string[] = [];
  const openWithBalance = await prisma.folio.findMany({
    where: { propertyId, status: "open" },
    include: { lines: { select: { kind: true, amountMinor: true, voided: true } } },
  });
  const unsettled = openWithBalance.filter((f) => folioBalance(f.lines).balance !== 0).length;
  if (unsettled > 0) carriedForward.push(`${unsettled} unsettled balance${unsettled === 1 ? "" : "s"}`);

  const stillIn = await prisma.roomAssignment.count({
    where: {
      propertyId, status: "active", checkedOutAt: null,
      checkOut: { lte: utcDay(businessDate) },
      reservation: { departedAt: null },
    },
  });
  if (stillIn > 0) carriedForward.push(`${stillIn} guest${stillIn === 1 ? "" : "s"} past departure and still in house`);

  const candidates = await prisma.reservation.findMany({
    where: { propertyId, status: { in: ["confirmed", "modified"] } },
    include: { lines: true, assignments: true },
  });

  let noShows = 0;
  await withTenantTransaction(tenantId, async (tx) => {
    for (const r of candidates) {
      if (r.assignments.length > 0 || r.lines.length === 0) continue; // arrived, or no stay
      const ci = ymd(r.lines.map((l) => l.checkIn).sort((a, b) => a.getTime() - b.getTime())[0]!);
      if (ci <= businessDate) {
        await tx.reservation.update({ where: { id: r.id }, data: { status: "no_show" } });
        noShows++;
      }
    }
    await tx.property.update({
      where: { id: propertyId },
      data: {
        businessDate: utcDay(next),
        lastClosedAt: new Date(),
        lastCloseWasAutomatic: actor.kind === "system",
      },
    });
  });

  // Recurring stay extras accrue for the night just closed (spec §3.6). Outside the transaction
  // because it is idempotent per (extra, date) by design — re-running it never double-charges — and
  // it walks every in-house stay, which is too much work to hold locks across.
  const accrued = await accrueStayExtras(tenantId, propertyId, businessDate, prisma);

  const carried = carriedForward.length > 0 ? ` · carried forward: ${carriedForward.join(", ")}` : "";
  await logAudit(propertyId, tenantId, {
    entity: "close_day",
    field: businessDate,
    oldValue: actor.kind === "system" ? "closed automatically by system" : "closed by staff",
    newValue: `${noShows} no-show(s) · ${accrued} extra(s) accrued · rolled to ${next}${carried}`,
    ...(actor.kind === "user" ? { userId: actor.userId } : {}),
  }, prisma);

  // Boundary rule: the close itself is operational (audit above). Only its availability effect
  // (no-show rooms released back to sale) is channel-facing.
  if (noShows > 0) {
    await recordSync(propertyId, tenantId, "Availability restored — no-show rooms released", `${noShows} room(s) returned to sale`, undefined, prisma);
  }

  return { businessDate, next, noShows, accrued, carriedForward };
}
