import { NextResponse, type NextRequest } from "next/server";
import { JOB, acquireJobLease, forSystem, forTenant, releaseJobLease } from "@revio/db";
import { waitlistSweep } from "@revio/booking";

/**
 * Scheduled entry point for the waitlist sweep, across every tenant.
 *
 * Same shape as the hold-expiry job next door, including the lease — but for a different reason.
 * Hold expiry is idempotent, so a double run is merely wasteful. This one **sends email and holds
 * rooms**: two runners racing could offer the same freed room to two guests, which is precisely the
 * failure the sequential-offer design exists to prevent. Losing the lease is the normal outcome on
 * every replica but one, so it reports ok+skipped rather than an error.
 *
 * Per property rather than per tenant, because availability, timezone and the queue are all
 * property-scoped — a group with two hotels has two independent lists.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const lease = await acquireJobLease(JOB.waitlistSweep, 5 * 60_000);
  if (!lease.acquired) {
    return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
  }

  const system = forSystem();
  // Only properties that actually have somebody waiting — most sweeps should do nothing at all.
  const pending = await system.waitlistEntry.findMany({
    where: { status: { in: ["waiting", "offered"] } },
    select: { propertyId: true },
    distinct: ["propertyId"],
  });

  let offered = 0, lapsed = 0, staled = 0;
  for (const { propertyId } of pending) {
    const property = await system.property.findUnique({
      where: { id: propertyId },
      select: { id: true, tenantId: true, name: true, baseCurrency: true, timezone: true },
    });
    if (!property) continue;
    // Scoped per tenant even inside a system job: the sweep reads and writes hotel-owned rows, and
    // the RLS perimeter is the thing that makes "one property at a time" true rather than hoped for.
    const result = await waitlistSweep(forTenant(property.tenantId), property);
    offered += result.offered;
    lapsed += result.lapsed;
    staled += result.staled;
  }

  await releaseJobLease(JOB.waitlistSweep);
  return NextResponse.json({ ok: true, properties: pending.length, offered, lapsed, staled });
}
