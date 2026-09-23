/**
 * Nightly: ask every real channel what its rate plans belong to, and raise the ones we have wrong.
 *
 * ## Why this is scheduled rather than a button
 *
 * A cross-wired mapping produces no symptom anybody would go looking for. The row says `mapped`,
 * the push says `success`, the channel accepts every update, and the only consequence is that one
 * room's prices publish against another — which the hotel discovers from a guest, or from a bill.
 * Nothing is going to prompt somebody to press a button about a screen that looks finished.
 *
 * It ran twice on real property before anything could see it: the €666 price on 13 September, and
 * `Apartment, 2 Bedrooms → Standard Rate` still pointing at the 1-Bedroom's plan four days later,
 * because the adapter fix of the 13th repaired the picker and never repaired the rows.
 *
 * Mock channels are excluded, as everywhere else — they would invent an answer.
 *
 * Cron-triggered, nightly is enough (a mapping changes when a person changes it):
 *   POST /api/jobs/mapping-audit   with `Authorization: Bearer $CRON_SECRET`
 */
import { NextResponse, type NextRequest } from "next/server";
import { JOB, withJobLease, forSystem } from "@revio/db";
import { auditChannelMapping } from "@revio/connectivity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }


  try {
    const lease = await withJobLease(JOB.mappingAudit, 15 * 60_000, async () => {
      const db = forSystem();
      /*
       * ⚠️ Suspended accounts ARE audited, deliberately — unlike the pull, which skips them.
       *
       * The pull is skipped because doing the work would be wrong. This is the opposite: a suspended
       * client is one we are more likely to be in a difficult conversation with, and "your channel has
       * been pointed at a property that no longer exists" is exactly the thing we need to know before
       * that call rather than after it. Ventsi Group is suspended and is the reason this job found
       * anything at all.
       */
      const channels = await db.channel.findMany({
        where: { status: "connected", connectivityMode: { not: "mock" } },
        select: { id: true },
      });

      /*
       * Where Channex rings us. From the environment, never from the request: `req.nextUrl.origin`
       * behind Railway's proxy is the internal `localhost:<port>`, which this codebase has already
       * shipped once and spent a day chasing.
       */
      const origin = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "")
        || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");
      const callbackUrl = origin ? `${origin}/api/webhooks/channex` : "";
      const webhookSecret = process.env.CHANNEX_WEBHOOK_SECRET ?? "";

      let checked = 0, crossWired = 0, raised = 0, inconclusive = 0;
      const webhooks = { registered: 0, already: 0, failed: 0 };
      const lines: string[] = [];
      for (const c of channels) {
        /*
         * One channel's failure never stops the rest. A revoked key on one hotel must not leave every
         * other hotel's mapping unexamined — that shape of coupling is how a single bad credential
         * turns into a platform-wide blind spot.
         */
        try {
          const r = await auditChannelMapping(db, c.id, callbackUrl, webhookSecret);
          if (r.webhook) webhooks[r.webhook]++;
          checked += r.checked;
          crossWired += r.crossWired.length;
          raised += r.raised;
          if (r.skipped) {
            inconclusive++;
            lines.push(`${r.channelName}: ${r.skipped}`);
          } else if (r.crossWired.length > 0) {
            lines.push(`${r.channelName}: ${r.crossWired.length} cross-wired, ${r.raised} newly raised`);
          }
        } catch (e) {
          inconclusive++;
          lines.push(`${c.id}: threw — ${e instanceof Error ? e.message : "unknown"}`);
        }
      }

      for (const l of lines) console.warn(`[mapping-audit] ${l}`);
      return { ok: true, channels: channels.length, checked, crossWired, raised, inconclusive, webhooks };
    });
    if (!lease.ran) {
      return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
    }
    return NextResponse.json(lease.result);
  } catch (err) {
    console.error("mapping-audit: failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
