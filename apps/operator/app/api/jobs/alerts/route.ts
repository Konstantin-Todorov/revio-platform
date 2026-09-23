/**
 * Hourly: tell a human when something needs doing, and say nothing when it does not.
 *
 * ## ⚠️ Why this job is the point of everything built on 2026-09-17
 *
 * That day the platform learned to detect a rate plan publishing to the wrong room, a channel
 * pointed at a deleted property, and a booking a channel confirmed that we could not import. All of
 * it landed in the Operator console **and nowhere else**. A console nobody has open is a log file.
 *
 * The incident that started the day ran for two days before a support thread found it.
 *
 * ## Silence
 *
 * No candidates, or nothing new since the last mail → **no mail**, not an empty one. `decideAlerts`
 * holds that rule and is tested on it; this route only stores what was said.
 *
 * Cron-triggered hourly:
 *   POST /api/jobs/alerts   with `Authorization: Bearer $CRON_SECRET`
 */
import { NextResponse, type NextRequest } from "next/server";
import { JOB, withJobLease, forSystem } from "@revio/db";
import { decideAlerts, operatorAlertEmail } from "@revio/core";
import { sendEmail } from "@revio/email";
import { alertCandidates } from "@/lib/alerts";

export const dynamic = "force-dynamic";

/**
 * Where an alert goes.
 *
 * A shared address on purpose, not a person: somebody is on holiday and a hotel's channel is not.
 */
const ALERT_TO = process.env.OPERATOR_ALERT_EMAIL || "office@reviosoft.app";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }


  try {
    const lease = await withJobLease(JOB.operatorAlerts, 10 * 60_000, async () => {
      const db = forSystem();
      const candidates = await alertCandidates();
      const known = await db.operatorAlert.findMany({ where: { resolvedAt: null } });
      const now = new Date();
      const decision = decideAlerts(candidates, known, now);

      /*
       * ⚠️ Resolution is recorded even when nothing is sent.
       *
       * A fault that stopped being reported is a fault somebody fixed, and leaving the row open would
       * mean a recurrence three weeks later reads as "still open since September" rather than as the
       * new event it is.
       */
      const live = new Set(candidates.map((c) => c.key));
      const gone = known.filter((k) => !live.has(k.key));
      if (gone.length > 0) {
        await db.operatorAlert.updateMany({ where: { key: { in: gone.map((g) => g.key) } }, data: { resolvedAt: now } });
      }

      if (decision.silent) {
        return { ok: true, sent: false, candidates: candidates.length, resolved: gone.length };
      }

      const origin = process.env.OPERATOR_URL || "https://operator.reviosoft.app";
      const mail = operatorAlertEmail(decision, `${origin}/overview`);
      const res = await sendEmail({ to: [ALERT_TO], subject: mail.subject, text: mail.text, html: mail.html });

      /*
       * ⚠️ Only write `lastAlertedAt` when the mail actually left.
       *
       * Recording it on a failed send would mark the fault as reported and then stay silent about it
       * for three days — an alerting system that goes quiet exactly when its own transport is broken.
       */
      if (!res.ok) {
        // Thrown, not returned: inside `withJobLease` a returned value counts as a successful run and
        // stamps `lastRunAt`, which is what the dead-man's switch reads. An alerting job whose mail
        // does not leave must read as FAILED there, or the one alarm that watches the others goes quiet.
        throw new Error(`the alert email did not send: ${res.error ?? "send failed"}`);
      }

      for (const c of [...decision.fresh, ...decision.stale]) {
        await db.operatorAlert.upsert({
          where: { key: c.key },
          create: { key: c.key, clientName: c.clientName, summary: c.summary, lastAlertedAt: now },
          update: { lastAlertedAt: now, summary: c.summary, resolvedAt: null },
        });
      }

      return {
        ok: true, sent: true, to: ALERT_TO,
        fresh: decision.fresh.length, stale: decision.stale.length, resolved: gone.length,
      }
  ;
    });
    if (!lease.ran) {
      return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
    }
    return NextResponse.json(lease.result);
  } catch (err) {
    console.error("operator-alerts: failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
