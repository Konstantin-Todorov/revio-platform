import { NextResponse, type NextRequest } from "next/server";
import { JOB, withJobLease, refreshDemoStays } from "@revio/db";

/**
 * Scheduled entry point for the demo refresh.
 *
 * ## Why a demo hotel needs a cron job
 *
 * Demo data is written with fixed dates and today keeps moving. On 2026-09-16 the demo hotels held
 * 76 room assignments and not one of them reached today — the last night was six days earlier — so
 * opening RevioPMS to show somebody gave an empty tape chart and an empty front desk. Nothing was
 * broken and no test could catch it: the data was correct, just old.
 *
 * **The demo is the sale.** A hotel deciding whether to trust us with its bookings opens the
 * calendar, and what it must never see is a blank grid. Running this nightly means the demo is
 * always mid-service — somebody departing, somebody in house, somebody arriving — on whatever day
 * it is opened.
 *
 * ⚠️ Scoped by `isDemo` and by nothing else, and everything it writes carries the `DEMO-STAY-`
 * external id so a re-run replaces its own rows rather than piling more on. It cannot reach a real
 * client, and `prisma/seed.ts` — which opens with `TRUNCATE … CASCADE` — can never be the way to do
 * this, because the demo tenants live in production beside real ones on purpose.
 *
 * Leased like every other job. Two runners would each delete the other's stays mid-write.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }


  try {
    const lease = await withJobLease(JOB.demoRefresh, 5 * 60_000, async () => {
      const { tenantsTouched, staysWritten, lines } = await refreshDemoStays({ apply: true });
      // The same trace the CLI prints, so a log line and a terminal say the same thing.
      for (const l of lines) console.log(`[demo-refresh] ${l}`);
      return { ok: true, tenantsTouched, staysWritten };
    });
    if (!lease.ran) {
      return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
    }
    return NextResponse.json(lease.result);
  } catch (err) {
    console.error("demo-refresh: failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
