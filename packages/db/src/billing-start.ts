import { forSystem } from "./rls.js";

/**
 * When a client starts being billable — the code behind "free until your first booking syncs".
 *
 * The promise is on every product page and in the refund policy, and the refund policy is careful in
 * a way the marketing line is not:
 *
 *   > If your subscription includes channel management, we do not invoice you until the date of your
 *   > first successfully synchronised booking. For subscriptions without channel management, billing
 *   > begins when your property is configured and ready to use.
 *
 * Two paths, and a first implementation that only built the first one left every CRS-only and
 * PMS-only client **free forever** — a revenue leak that also contradicted our own legal page. A
 * hotel that bought the front desk and no channel manager will never have a booking sync; waiting
 * for one is waiting for something that cannot happen.
 *
 * So the rule lives here, once, rather than in the two places that trigger it.
 */

export type BillableReason =
  /** A booking arrived from a real channel and landed. Clients with channel management. */
  | "first_booking_synced"
  /** First-run setup finished. Clients without channel management. */
  | "setup_completed";

/**
 * Mark a tenant billable, if it is not already.
 *
 * **Set once, never moved.** Re-stamping on a later event would restart the free period and quietly
 * cancel the bill, so the update is conditional on the column still being null — done in the WHERE
 * clause rather than a read-then-write, because two concurrent events would otherwise race and the
 * later one would win.
 *
 * **Never throws.** Both callers run inside something more important than this: a booking that has
 * already been saved, or a hotel finishing setup. Failing either because we could not record a
 * billing date would be the wrong trade, and the next event sets it anyway.
 *
 * Returns true when this call is the one that set it — so a caller can log it as the moment.
 */
export async function markBillable(tenantId: string, reason: BillableReason): Promise<boolean> {
  try {
    const tenant = await forSystem().tenant.findUnique({
      where: { id: tenantId },
      select: { hasChannelManager: true, billingStartsAt: true },
    });
    if (!tenant || tenant.billingStartsAt) return false;

    /*
     * The one rule that keeps the two paths from overlapping.
     *
     * A client WITH channel management waits for a real booking — finishing setup is not the
     * promise, and billing them at setup would break the line on the pricing page. A client WITHOUT
     * one cannot ever satisfy that condition, so setup is the honest trigger.
     */
    const expected: BillableReason = tenant.hasChannelManager ? "first_booking_synced" : "setup_completed";
    if (reason !== expected) return false;

    const { count } = await forSystem().tenant.updateMany({
      where: { id: tenantId, billingStartsAt: null },
      data: { billingStartsAt: new Date() },
    });
    return count > 0;
  } catch {
    // Deliberately silent. See above.
    return false;
  }
}

/**
 * Is this period billable for this client?
 *
 * Two conditions, and the second is the one easy to omit: a gate that only defers the FIRST invoice
 * and then bills the whole back-catalogue the moment a booking lands is the same broken promise with
 * a delay on it.
 *
 * `period` is `YYYY-MM`, which compares correctly as a string only because it is zero-padded and
 * fixed-width.
 */
export function isBillablePeriod(period: string, billingStartsAt: Date | null): boolean {
  if (!billingStartsAt) return false;
  return period >= billingStartsAt.toISOString().slice(0, 7);
}
