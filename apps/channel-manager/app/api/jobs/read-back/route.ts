/**
 * Daily: read what every live channel is publishing, compare it with what we send, re-send what
 * differs, and tell a person about whatever still differs. See `@revio/connectivity` read-back.ts.
 *
 * Called on every cron tick like every other job, and does the work only once
 * `JOB_INTERVAL_MS["channel-read-back"]` has passed since the last run that succeeded. The
 * not-yet answer is read without taking the lease, so it never stamps `lastRunAt` — otherwise each
 * "not yet" would push the next run a further twenty hours away, and it would never run at all.
 *
 *   POST /api/jobs/read-back   with `Authorization: Bearer $CRON_SECRET`
 *   POST /api/jobs/read-back?force=1   runs now regardless of the interval (a person asking)
 */
import { NextResponse, type NextRequest } from "next/server";
import { JOB, JOB_INTERVAL_MS, forSystem, lastJobRunAt, withJobLease } from "@revio/db";
import { readBackChannel } from "@revio/connectivity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const every = JOB_INTERVAL_MS[JOB.channelReadBack] ?? 0;
    const last = await lastJobRunAt(JOB.channelReadBack);
    if (!req.nextUrl.searchParams.has("force") && last && Date.now() - last.getTime() < every) {
      return NextResponse.json({ ok: true, skipped: "not due", lastRunAt: last.toISOString() });
    }

    const lease = await withJobLease(JOB.channelReadBack, 15 * 60_000, async () => {
      const db = forSystem();
      const channels = await db.channel.findMany({
        where: { status: "connected", connectivityMode: { not: "mock" } },
        select: { id: true },
      });
      // `matching`, never `ok`: spread into the response, a key named `ok` overwrote `ok: true`
      // with a count, and a night with no clean channel answered `"ok": 0` — a failure to run-jobs.
      const tally = { matching: 0, healed: 0, differs: 0, unreadable: 0, skipped: 0 };
      const lines: string[] = [];
      for (const c of channels) {
        // One channel's failure never stops the rest — same rule as the mapping audit.
        try {
          const r = await readBackChannel(db, c.id, { settleMs: 5_000 });
          tally[r.status === "ok" ? "matching" : r.status]++;
          if (r.status !== "ok") lines.push(`${r.channelName}: ${r.status} — ${r.summary}`);
        } catch (e) {
          tally.unreadable++;
          lines.push(`${c.id}: threw — ${e instanceof Error ? e.message : "unknown"}`);
        }
      }
      for (const l of lines) console.warn(`[read-back] ${l}`);
      return { ok: true, channels: channels.length, ...tally };
    });
    if (!lease.ran) {
      return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
    }
    return NextResponse.json(lease.result);
  } catch (err) {
    console.error("read-back: failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
