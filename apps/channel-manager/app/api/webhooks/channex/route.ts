/**
 * Channex rings this the moment a booking arrives. We then pull, exactly as the cron does.
 *
 * ## ⚠️ This is a PUBLIC endpoint, and it is built to be boring
 *
 * It is the only unauthenticated write surface in the staff products, so the rules are strict:
 *
 *   * **It reads no booking data from the request.** The body is used for one thing — which property
 *     rang — and even that is checked against our own database before anything happens. Everything
 *     about the booking comes from our own authenticated pull.
 *   * **The worst a forged request can do is cause one extra pull**, which is idempotent and
 *     serialised per channel inside `pullChannel` (`withChannelPullLock`). It cannot create,
 *     cancel or alter anything. (This line used to cite "the lease below"; there was none, and
 *     two rings for one booking ran their imports side by side until 2026-09-23.)
 *   * **A wrong or missing secret is a 401 and nothing else** — no hint about whether the property
 *     exists, because an endpoint that answers differently for a real id is an enumeration oracle.
 *
 * ## ⚠️ It does not replace the five-minute pull
 *
 * A webhook that never arrives is silent, and silence reading as "nothing happened" is precisely the
 * failure this platform spent 2026-09-17 removing. The cron stays. This buys latency — seconds
 * instead of up to five minutes — not certainty.
 *
 * ## Answer fast
 *
 * Channex retries and eventually disables an endpoint that is slow or failing, so the pull is not
 * awaited before responding: a ring that took nine seconds to answer is a ring that gets us
 * unhooked. We acknowledge, then work.
 */
import { NextResponse, type NextRequest } from "next/server";
import { forSystem } from "@revio/db";
import { pullChannel, WEBHOOK_SECRET_HEADER } from "@revio/connectivity";
import { deliverNewBookings } from "@/lib/booking-delivery";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.CHANNEX_WEBHOOK_SECRET;
  /*
   * ⚠️ Fail CLOSED. An unset secret means every request on the internet would be accepted, and this
   * route triggers work against a real hotel's channel. The five-minute poll keeps bookings arriving
   * meanwhile, so refusing costs latency and nothing else.
   */
  if (!secret || req.headers.get(WEBHOOK_SECRET_HEADER) !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let propertyId: string | null = null;
  try {
    const body = (await req.json()) as { property_id?: string; data?: { property_id?: string } } | null;
    propertyId = body?.property_id ?? body?.data?.property_id ?? null;
  } catch {
    // A ring we cannot parse is still a ring. Fall through and pull everything real.
  }

  const db = forSystem();
  /*
   * Which channels to pull. Scoped by the id Channex sent when it sent one — and by `status` and
   * `connectivityMode` regardless, so a forged or malformed body can only ever reach channels that
   * were already being polled every five minutes anyway.
   */
  const channels = await db.channel.findMany({
    where: {
      status: "connected",
      connectivityMode: { not: "mock" },
      ...(propertyId ? { externalPropertyId: propertyId } : {}),
    },
    select: { id: true },
  });

  // Acknowledge first. Channex disables an endpoint that answers slowly, and the pull can take
  // seconds. `void` is deliberate: the response must not wait on it.
  void (async () => {
    for (const c of channels) {
      try {
        const outcome = await pullChannel(db, c.id);
        // The webhook imports first, so the scheduled pull finds nothing new afterwards — this is the
        // only chance to tell a RevioLink-only hotel about the booking. See `deliverNewBookings`.
        if (outcome.ok && outcome.imported > 0) await deliverNewBookings(c.id, outcome.imported);
      } catch (e) {
        // A failed pull writes its own SyncEvent. Logged here so a webhook-shaped failure is
        // distinguishable from a cron-shaped one in the service log.
        console.warn(`[channex-webhook] pull failed for ${c.id}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }
  })();

  return NextResponse.json({ ok: true, channels: channels.length });
}
