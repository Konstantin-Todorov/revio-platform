import { NextResponse, type NextRequest } from "next/server";
import { JOB, withJobLease, forSystem, forTenant } from "@revio/db";
import { sendTemplatedEmail } from "@revio/email";
import { bookingReference, guestMailDue, guestMailWindow, stayDetails, todayInTimeZone } from "@revio/core";

/**
 * The scheduled guest emails — "Before arrival" and "After departure" — across every hotel that has
 * switched one on (Settings → Guest emails). Off by default: `EMAIL_OPT_IN` in core.
 *
 * Which stay is due, and when, is `guestMailDue` in core (pure, tested): the hotel's own morning,
 * three days before arrival, the morning after departure, never an old stay. This route only reads
 * the window, sends, and stamps each stay once — whatever the outcome, so a provider having a bad
 * morning can never turn into the same guest mailed every five minutes.
 *
 * Read from the one reservation record, so it works for a hotel whatever products it runs: a
 * booking that arrived from Booking.com through RevioLink gets the same note as one typed into
 * RevioCRS.
 */
function localHour(timeZone: string, now: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone }).format(now)) % 24;
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const lease = await withJobLease(JOB.guestMail, 5 * 60_000, async () => {
      const system = forSystem();
      const now = new Date();
      // Only hotels that switched one of the two on — most ticks read one small table and stop.
      const optedIn = await system.emailTemplate.findMany({
        where: { key: { in: ["pre_arrival", "post_stay"] }, enabled: true },
        select: { propertyId: true },
        distinct: ["propertyId"],
      });

      let sent = 0, skipped = 0, failed = 0;
      for (const { propertyId } of optedIn) {
        const property = await system.property.findUnique({
          where: { id: propertyId },
          select: { id: true, tenantId: true, name: true, timezone: true, defaultLanguage: true, checkInTime: true, checkOutTime: true },
        });
        if (!property) continue;
        const today = todayInTimeZone(property.timezone, now);
        const hour = localHour(property.timezone, now);
        const w = guestMailWindow(today);
        const db = forTenant(property.tenantId);
        const stays = await db.reservation.findMany({
          where: {
            propertyId,
            OR: [
              { preArrivalMailedAt: null, lines: { some: { checkIn: { gte: new Date(`${w.checkInFrom}T00:00:00Z`), lte: new Date(`${w.checkInTo}T00:00:00Z`) } } } },
              { postStayMailedAt: null, lines: { some: { checkOut: { gte: new Date(`${w.checkOutFrom}T00:00:00Z`), lte: new Date(`${w.checkOutTo}T00:00:00Z`) } } } },
            ],
          },
          include: { guest: true, lines: { include: { roomType: true } } },
        });

        for (const r of stays) {
          const line = r.lines[0];
          if (!line) continue;
          const checkIn = line.checkIn.toISOString().slice(0, 10);
          const checkOut = line.checkOut.toISOString().slice(0, 10);
          const due = guestMailDue(
            { status: r.status, checkIn, checkOut, departed: r.departedAt !== null, preArrivalMailed: r.preArrivalMailedAt !== null, postStayMailed: r.postStayMailedAt !== null },
            { today, localHour: hour },
          );
          if (!due) continue;

          const to = r.guest?.email?.trim();
          let outcome: "sent" | "skipped" | "failed" = "skipped";
          if (to) {
            const locale = property.defaultLanguage || "en";
            const reference = bookingReference(r.id);
            const res = await sendTemplatedEmail(db, {
              propertyId,
              key: due,
              to: [to],
              locale,
              vars: {
                guestName: r.guest?.firstName || r.guestName, propertyName: property.name, reference,
                checkIn, checkOut, roomType: line.roomType.name, checkInTime: property.checkInTime,
              },
              // Before arrival carries the stay; after departure is a thank-you, not a statement.
              ...(due === "pre_arrival"
                ? {
                    details: stayDetails({
                      locale, reference, roomType: line.roomType.name, checkIn, checkOut,
                      checkInTime: property.checkInTime, checkOutTime: property.checkOutTime, guests: line.guestsCount ?? null,
                    }),
                  }
                : {}),
            }).catch(() => ({ ok: false as const }));
            outcome = !res.ok ? "failed" : "skipped" in res && res.skipped ? "skipped" : "sent";
          }
          // Stamped whatever happened: once per stay, never retried into a flood.
          await db.reservation.update({
            where: { id: r.id },
            data: due === "pre_arrival" ? { preArrivalMailedAt: now } : { postStayMailedAt: now },
          });
          if (outcome === "sent") sent++; else if (outcome === "failed") failed++; else skipped++;
        }
      }
      return { ok: true, properties: optedIn.length, sent, skipped, failed };
    });
    if (!lease.ran) {
      return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
    }
    return NextResponse.json(lease.result);
  } catch (err) {
    console.error("guest-mail: failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
