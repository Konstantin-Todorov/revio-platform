import { NextResponse, type NextRequest } from "next/server";
import { JOB, acquireJobLease, releaseJobLease } from "@revio/db";
import { runInvoiceGeneration } from "@/lib/invoice-run";

export const dynamic = "force-dynamic";

/**
 * Scheduled entry point for the monthly invoice run.
 *
 * ⚠️ This existed only as a button in the console, and `generateInvoices` generates the CURRENT
 * period only — so a month in which nobody pressed it is a month nobody was invoiced for, and that
 * revenue is not late, it is gone. Exactly the shape of a trial that only ends when somebody
 * remembers.
 *
 * Running it on every tick is deliberate rather than wasteful: the run is idempotent (a missing
 * draft is created, a stale one refreshed, a sent or paid invoice never touched), so the invoice a
 * client can see is always in step with what they actually hold, instead of being right once a
 * month and drifting for the other thirty days.
 *
 * No money moves — payments are mocked. This drafts documents.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Leased so two runners cannot race to create the same `tenantId + period` row.
  const lease = await acquireJobLease(JOB.invoiceRun, 5 * 60_000);
  if (!lease.acquired) {
    return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
  }

  try {
    return NextResponse.json({ ok: true, ...(await runInvoiceGeneration()) });
  } finally {
    await releaseJobLease(JOB.invoiceRun);
  }
}
