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
import { JOB, acquireJobLease, forSystem, releaseJobLease } from "@revio/db";
import { pullChannel } from "@revio/connectivity";
import { sendEmail, deliveryRecipients } from "@revio/email";
import { renderSystemEmail, renderSystemEmailText } from "@revio/core";

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
   * rather than an error. If the body throws, the lease is deliberately NOT released — a run that
   * failed should wait out the short TTL rather than be retried instantly by the next tick.
   */
  const lease = await acquireJobLease(JOB.channexPull, 10 * 60_000);
  if (!lease.acquired) {
    return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
  }

  const db = forSystem();
  // Same filter the app's own auto-push uses: connected, real connectivity only.
  const channels = await db.channel.findMany({
    where: { status: "connected", connectivityMode: { not: "mock" } },
    include: { property: { include: { tenant: true } } },
  });

  let imported = 0, updated = 0, failed = 0;
  for (const channel of channels) {
    let outcome;
    try {
      outcome = await pullChannel(db, channel.id);
    } catch (e) {
      failed++;
      outcome = { ok: false as const, imported: 0, updated: 0, unchanged: 0, mode: "unknown", error: e instanceof Error ? e.message : "pull threw" };
    }
    if (outcome.ok) { imported += outcome.imported; updated += outcome.updated; } else { failed++; }

    await db.auditEntry.create({
      data: {
        tenantId: channel.tenantId, propertyId: channel.propertyId,
        entity: "Channel sync", field: "scheduled pull",
        newValue: outcome.ok ? `${outcome.imported} new · ${outcome.updated} updated (${outcome.mode})` : `failed: ${outcome.error ?? "unknown"}`,
        source: "api", channelCode: channel.code,
        syncResult: outcome.ok ? "success" : "failed",
      },
    });

    // Reservation delivery: when the hotel runs neither CRS nor PMS, nothing else would surface the
    // booking — email it to the configured address(es), same rule as the manual pull.
    if (outcome.ok && outcome.imported > 0) {
      const tenant = channel.property.tenant;
      const takesDeliveryElsewhere = tenant.hasReservation || tenant.hasPms;
      const to = deliveryRecipients(channel.property, "both");
      if (!takesDeliveryElsewhere && to.length > 0) {
        const fresh = await db.reservation.findMany({
          where: { propertyId: channel.propertyId, channelId: channel.id },
          include: { channel: true, lines: { include: { roomType: true } } },
          orderBy: { importedAt: "desc" },
          take: outcome.imported,
        });
        const rows = fresh.map((r) => {
          const l = r.lines[0];
          return `• ${r.guestName} — ${l?.roomType.name ?? ""} · ${l ? `${l.checkIn.toISOString().slice(0, 10)} → ${l.checkOut.toISOString().slice(0, 10)}` : ""} · ${r.channel?.name ?? "Direct"}`;
        });
        const mail = {
          preview: `${outcome.imported} new from ${channel.name}.`,
          heading: `${outcome.imported} new booking${outcome.imported > 1 ? "s" : ""}`,
          product: "RevioLink",
          blocks: [{ p: `Pulled from ${channel.name} for ${channel.property.name}.` }, { list: rows }],
        };
        await sendEmail({
          to,
          subject: `${outcome.imported} new booking${outcome.imported > 1 ? "s" : ""} — ${channel.property.name}`,
          text: renderSystemEmailText(mail),
          html: renderSystemEmail(mail),
        });
      }
    }
  }

  await releaseJobLease(JOB.channexPull);
  return NextResponse.json({ ok: true, channels: channels.length, imported, updated, failed });
}
