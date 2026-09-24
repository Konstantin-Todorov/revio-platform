/**
 * Scheduled OTA pull (all tenants, system perimeter).
 *
 * Until now bookings only arrived when a human opened the app and hit Pull. For a live hotel that is
 * not acceptable — an OTA booking made at 02:00 must be in the system before the desk opens, and the
 * availability it consumes must be re-pushed so nobody oversells. This route pulls every connected
 * REAL channel (mock channels are excluded — they'd invent bookings), imports/updates reservations,
 * and writes one audit entry per channel so the Sync Center shows the unattended activity.
 *
 * Cron-triggered (suggested every 5-15 minutes):
 *   POST /api/jobs/pull   with `Authorization: Bearer $CRON_SECRET`
 */
import { NextResponse, type NextRequest } from "next/server";
import { JOB, withJobLease, forSystem } from "@revio/db";
import { pullChannel } from "@revio/connectivity";
import { deliverNewBookings } from "@/lib/booking-delivery";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  /*
   * CX1 — exactly one runner for this job, across every process.
   *
   * The scheduler lives in `instrumentation.ts`, i.e. INSIDE the web server, so there is one timer
   * per server process. A second Railway replica, a developer pointed at the same sandbox, or a
   * certification script running while the deployed app ticks is each another runner. Channex saw
   * the consequence and asked about it directly: the same booking revision delivered twice within
   * one second, from two different IP addresses.
   *
   * This job the Channex booking-revisions feed — the exact job Channex saw duplicated.
   *
   * Losing the lease is the NORMAL outcome on every replica but one, so it reports ok+skipped
   * rather than an error. If the body throws, the lease is released anyway so the next
   * tick retries — see the note on `withJobLease` below.
   */
  /*
    ⚠️ The work runs inside a try whose RETURN is also inside it.

    That detail is the whole fix: wrapping only the statements and leaving the return outside puts
    every variable the return reads out of scope, which is exactly how the first attempt at this
    broke. Typecheck caught it; it is recorded here so the next person does not repeat it.

    ⚠️ ONE lease policy since 2026-09-23: `withJobLease`, releasing on both paths and stamping
    `lastRunAt` only on success. This route used to keep its lease after a failure so a failed
    run would "wait out its TTL". Measured against the real 10-minute cron that backoff mostly
    did not exist — a 5-minute TTL has expired before the next tick — and where it did (10-minute
    TTLs) it skipped a tick at random and reported the skip as `ok: true`. Decided by the founder;
    the table is in `docs/ACTION-REQUIRED.md` §2d, and `jobs-lint` now refuses a hand-held lease.

    What the catch changes is that a failure can be READ. Without a catch, Next answers a bare 500 with an
    EMPTY body, and the runner logged exactly that on 2026-09-22: `HTTP 500 in 10166ms · ` and
    nothing after the separator. An error nobody can see is an error nobody fixes.
  */
  try {
    const lease = await withJobLease(JOB.channexPull, 10 * 60_000, async () => {
      const db = forSystem();
      /*
       * Connected, real connectivity, and an account that is not suspended.
       *
       * ⚠️ The tenant filter is an optimisation, NOT the rule. `pullChannel` refuses a suspended account
       * on its own and that is the authority — one decision, in one place, that a second caller cannot
       * route around. This filter exists so the job does not call it 288 times a day only to be refused
       * and write an audit row saying so: a trail full of "this account is suspended" is how a hotel's
       * record of what actually happened becomes unreadable, which has already happened here once with
       * 20,249 rows of "0 new · 0 updated".
       */
      const channels = await db.channel.findMany({
        where: { status: "connected", connectivityMode: { not: "mock" }, property: { tenant: { status: "active" } } },
        include: { property: { include: { tenant: true } } },
      });

      let imported = 0, updated = 0, failed = 0, rejected = 0;
      for (const channel of channels) {
        let outcome;
        try {
          outcome = await pullChannel(db, channel.id);
        } catch (e) {
          failed++;
          outcome = { ok: false as const, imported: 0, updated: 0, unchanged: 0, failedImport: 0, mode: "unknown", error: e instanceof Error ? e.message : "pull threw" };
        }
        if (outcome.ok) {
          imported += outcome.imported;
          updated += outcome.updated;
          // A booking that arrived and bounced off a missing mapping. The pull worked; the booking did
          // not land. Counted separately so a run that rejected one never reports as a clean run.
          rejected += outcome.failedImport;
        } else { failed++; }

        /*
         * Only write to the audit trail when something actually happened.
         *
         * This used to record every tick of every channel. The cron runs every few minutes against three
         * connected channels, so it wrote roughly 860 rows a day saying "0 new · 0 updated" — and by
         * 2026-09-07 the audit log was **20,249 of ~20,700 rows** of exactly that. 98% noise.
         *
         * The audit trail is the HOTEL's record of who changed what. A pull that changed nothing changed
         * nothing, and burying a price edit or a check-in under nine hundred daily non-events makes the
         * screen useless precisely when somebody is trying to answer "what happened to this booking?".
         *
         * ⚠️ This does NOT weaken the proof that the poller is alive — that was never this row's job.
         * `SyncEvent` still records every attempt (including the successful no-ops), the Sync Center
         * reads those, and `operator /api/health/jobs` reports a job that has stopped running. Health
         * lives there; the audit trail is for changes.
         *
         * A FAILURE is always recorded, because a channel that could not be pulled is a change in the
         * hotel's world even though no data moved.
         */
        const changedSomething = outcome.ok && (outcome.imported > 0 || outcome.updated > 0);
        if (changedSomething || !outcome.ok) {
          await db.auditEntry.create({
            data: {
              tenantId: channel.tenantId, propertyId: channel.propertyId,
              entity: "Channel sync", field: "scheduled pull",
              newValue: outcome.ok ? `${outcome.imported} new · ${outcome.updated} updated (${outcome.mode})` : `failed: ${outcome.error ?? "unknown"}`,
              source: "api", channelCode: channel.code,
              syncResult: outcome.ok ? "success" : "failed",
            },
          });
        }

        // "N new bookings" to a hotel that runs RevioLink alone — one function for every import path.
        if (outcome.ok && outcome.imported > 0) await deliverNewBookings(channel.id, outcome.imported);
      }

      return { ok: true, channels: channels.length, imported, updated, failed, rejected };
    });
    if (!lease.ran) {
      return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
    }
    return NextResponse.json(lease.result);
  } catch (err) {
    console.error("channex-pull: failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
