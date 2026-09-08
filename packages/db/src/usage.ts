import { normaliseRoute, isRecordableRoute } from "@revio/core";
import { forSystem } from "./rls.js";

/**
 * Record that somebody opened a screen.
 *
 * ## It can never break a page
 *
 * This is bookkeeping about the product, not part of it. Every failure is swallowed on purpose: a
 * hotel whose front desk cannot check a guest in because an analytics write deadlocked would be a
 * self-inflicted outage in service of a number nobody is waiting for. The caller does not await a
 * result and there is nothing to handle.
 *
 * ## Two upserts, both idempotent
 *
 * `FeatureUsage` counts views into one row per hotel · product · screen · day. `ActiveUserDay`
 * records only THAT a person was active that day in that product, which is the smallest thing that
 * yields a distinct-user count. Neither grows with the customer's business: the first is bounded by
 * screens × days, the second by staff × days.
 *
 * ## Why the system perimeter
 *
 * Same reason as the support write. It is called from a signed-in context that has already proved
 * who the caller is, and going through the tenant proxy would make analytics fail exactly when a
 * hotel's session or entitlements are in a bad state — which is when knowing what they were looking
 * at is most useful. The tenant is stamped from the caller's own session, never from input.
 */
export async function recordUsage(input: {
  tenantId: string;
  userId: string;
  /** cm | crs | pms */
  product: string;
  /** The raw pathname. Normalised here, so no caller can store a guest's data by accident. */
  path: string;
}): Promise<void> {
  try {
    const route = normaliseRoute(input.path);
    if (!isRecordableRoute(route)) return;

    // Midnight UTC. Days, not timestamps — the question is never "at 14:32", and a day bucket is
    // what keeps one row per screen instead of one per visit.
    const day = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const db = forSystem();

    await Promise.all([
      db.featureUsage.upsert({
        where: {
          tenantId_product_route_day: { tenantId: input.tenantId, product: input.product, route, day },
        },
        create: { tenantId: input.tenantId, product: input.product, route, day, views: 1 },
        update: { views: { increment: 1 } },
      }),
      db.activeUserDay.upsert({
        where: { userId_product_day: { userId: input.userId, product: input.product, day } },
        create: { tenantId: input.tenantId, userId: input.userId, product: input.product, day },
        update: {},
      }),
    ]);
  } catch {
    /* Analytics must never be the reason a screen fails. */
  }
}
