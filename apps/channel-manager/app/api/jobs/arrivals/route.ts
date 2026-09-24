/**
 * Arrival-summary notifications (CM-UPDATES-V1 Settings): emails "Today's arrivals" and
 * "Tomorrow's arrivals" digests at each property's configured send time.
 *
 * Cron-triggered (run every ~15 minutes): POST with `Authorization: Bearer $CRON_SECRET`.
 * A property matches when its toggle is on and its property-TZ time is within 15 minutes
 * past the configured HH:MM — so one cron sweep sends each digest exactly once.
 */
import { NextResponse, type NextRequest } from "next/server";
import { JOB, withJobLease, forSystem, teamLocale } from "@revio/db";
import { SOLD_STATUSES } from "@revio/core";
import { sendEmail, deliveryRecipients } from "@revio/email";
import { arrivalsEmail } from "@revio/core";

export const dynamic = "force-dynamic";

function nowInTz(tz: string): { hhmm: string; minutes: number; ymd: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const h = Number(get("hour")) % 24;
  const m = Number(get("minute"));
  return { hhmm: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, minutes: h * 60 + m, ymd: `${get("year")}-${get("month")}-${get("day")}` };
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const addDays = (ymd: string, n: number) => new Date(new Date(`${ymd}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

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
   * This job sends email — two runners would send a hotel its arrivals digest twice.
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
    const lease = await withJobLease(JOB.arrivalsDigest, 5 * 60_000, async () => {
      const db = forSystem();
      /*
       * ⚠️ `tenant: { status: "active" }` — a suspended account gets no mail either.
       *
       * Ventsi Group has been suspended and receiving "Tomorrow's arrivals (0) — Chervena Vila" every
       * afternoon, for a property whose channel points at something Channex deleted. Every part of that
       * is wrong: nobody there can sign in to act on it, the number is zero because nothing can reach
       * them, and it is a daily reminder of a service we have switched off. A suspension that stops the
       * software and keeps the mail is a suspension nobody thought through.
       */
      const properties = await db.property.findMany({
        where: {
          status: "active",
          tenant: { status: "active" },
          OR: [{ notifyTodayArrivals: true }, { notifyTomorrowArrivals: true }],
        },
      });

      let sent = 0;
      for (const property of properties) {
        const { minutes, ymd } = nowInTz(property.timezone);
        const jobs: { day: string; label: string; to: string[] }[] = [];
        const due = (time: string) => {
          const t = toMinutes(time);
          return minutes >= t && minutes < t + 15; // one 15-minute window per day
        };
        if (property.notifyTodayArrivals && due(property.notifyTodayTime)) {
          jobs.push({ day: ymd, label: "Today's arrivals", to: deliveryRecipients(property, property.notifyTodayTo as "primary" | "secondary" | "both") });
        }
        if (property.notifyTomorrowArrivals && due(property.notifyTomorrowTime)) {
          jobs.push({ day: addDays(ymd, 1), label: "Tomorrow's arrivals", to: deliveryRecipients(property, property.notifyTomorrowTo as "primary" | "secondary" | "both") });
        }

        for (const job of jobs) {
          if (job.to.length === 0) continue;
          // Idempotence guard: the "due" window is 15 minutes wide, but a scheduler may fire more often
          // than that (and GitHub-style crons drift). One digest per property/label/day — if we already
          // logged this digest today, skip it rather than emailing the hotel two or three times.
          const alreadySent = await db.auditEntry.findFirst({
            where: {
              propertyId: property.id, entity: "Arrival notification", field: job.label,
              createdAt: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) },
            },
          });
          if (alreadySent) continue;
          const day = new Date(`${job.day}T00:00:00Z`);
          const arrivals = await db.reservation.findMany({
            where: { propertyId: property.id, status: { in: [...SOLD_STATUSES] }, lines: { some: { checkIn: day } } },
            include: { channel: true, lines: { include: { roomType: true } } },
            orderBy: { guestName: "asc" },
          });
          // In the team's language (`teamLocale`); the audit row below keeps its English label, which
          // is also the once-a-day guard.
          const mail = arrivalsEmail({
            locale: await teamLocale(property.tenantId, job.to),
            which: job.label === "Today's arrivals" ? "today" : "tomorrow",
            hotel: property.name,
            day: job.day,
            rows: arrivals.map((r) => {
              const l = r.lines[0];
              return {
                guest: r.guestName,
                room: l?.roomType.name ?? "",
                nights: l ? Math.round((l.checkOut.getTime() - l.checkIn.getTime()) / 86_400_000) : 0,
                channel: r.channel?.name ?? null,
              };
            }),
          });
          const res = await sendEmail({
            to: job.to,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
          });
          if (res.ok) sent++;
          await db.auditEntry.create({
            data: {
              tenantId: property.tenantId, propertyId: property.id,
              entity: "Arrival notification", field: job.label,
              newValue: res.ok ? `${arrivals.length} arrival(s) emailed to ${job.to.join(", ")} (${res.mode})` : `failed: ${res.error}`,
              source: "api", channelCode: "all", syncResult: res.ok ? "success" : "failed",
            },
          });
        }
      }
      return { ok: true, propertiesChecked: properties.length, digestsSent: sent };
    });
    if (!lease.ran) {
      return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
    }
    return NextResponse.json(lease.result);
  } catch (err) {
    console.error("arrivals-digest: failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
