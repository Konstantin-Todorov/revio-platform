/**
 * Arrival-summary notifications (CM-UPDATES-V1 Settings): emails "Today's arrivals" and
 * "Tomorrow's arrivals" digests at each property's configured send time.
 *
 * Cron-triggered (run every ~15 minutes): POST with `Authorization: Bearer $CRON_SECRET`.
 * A property matches when its toggle is on and its property-TZ time is within 15 minutes
 * past the configured HH:MM — so one cron sweep sends each digest exactly once.
 */
import { NextResponse, type NextRequest } from "next/server";
import { forSystem } from "@revio/db";
import { SOLD_STATUSES } from "@revio/core";
import { sendEmail, deliveryRecipients } from "@/lib/email";

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
  const db = forSystem();
  const properties = await db.property.findMany({
    where: { status: "active", OR: [{ notifyTodayArrivals: true }, { notifyTomorrowArrivals: true }] },
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
      const day = new Date(`${job.day}T00:00:00Z`);
      const arrivals = await db.reservation.findMany({
        where: { propertyId: property.id, status: { in: [...SOLD_STATUSES] }, lines: { some: { checkIn: day } } },
        include: { channel: true, lines: { include: { roomType: true } } },
        orderBy: { guestName: "asc" },
      });
      const rows = arrivals.map((r) => {
        const l = r.lines[0];
        return `• ${r.guestName} — ${l?.roomType.name ?? ""} · ${l ? `${(l.checkOut.getTime() - l.checkIn.getTime()) / 86_400_000}n` : ""} · ${r.channel?.name ?? "Direct"}`;
      });
      const res = await sendEmail({
        to: job.to,
        subject: `${job.label} (${arrivals.length}) — ${property.name} · ${job.day}`,
        text: arrivals.length > 0 ? `${job.label} for ${property.name}:\n\n${rows.join("\n")}\n\n— RevioLink` : `No arrivals ${job.label === "Today's arrivals" ? "today" : "tomorrow"} for ${property.name}.\n\n— RevioLink`,
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
  return NextResponse.json({ ok: true, propertiesChecked: properties.length, digestsSent: sent });
}
