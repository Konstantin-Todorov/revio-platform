import { NextResponse, type NextRequest } from "next/server";
import { JOB, withJobLease, forSystem, forTenant } from "@revio/db";
import { chargeSavedCard } from "@revio/payments";
import { stayDetails, todayInTimeZone } from "@revio/core";
import { sendTemplatedEmail } from "@revio/email";
import { bookingReference, storedStayTotal } from "@revio/booking";

const addDay = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * The day before: tell the guest the amount, the date and the card. A charge the guest agreed to
 * weeks ago and has forgotten is how a hotel earns a chargeback; one line of warning prevents it.
 * Stamped once (`balanceReminderSentAt`) so an hourly job mails once, and never blocks the charge.
 */
async function sendReminders(now: Date): Promise<number> {
  const system = forSystem();
  const soon = await system.reservation.findMany({
    where: {
      balanceChargeMinor: { gt: 0 },
      balanceChargedAt: null,
      balanceReminderSentAt: null,
      balanceChargeError: null,
      balanceChargeOn: { lte: new Date(now.getTime() + 60 * 3_600_000) },
      status: { in: ["confirmed", "modified"] },
      guaranteeLast4: { not: null },
    },
    select: {
      id: true, tenantId: true, propertyId: true, currency: true, balanceChargeMinor: true, balanceChargeOn: true,
      guaranteeLast4: true, guestLanguage: true, guestName: true, guestManageToken: true,
      guest: { select: { email: true, firstName: true } },
      lines: { select: { checkIn: true, checkOut: true, guestsCount: true, roomType: { select: { name: true } } }, take: 1 },
      property: { select: { timezone: true, name: true, defaultLanguage: true, publicSlug: true, checkInTime: true, checkOutTime: true } },
    },
  });
  const origin = process.env.BOOKING_ENGINE_ORIGIN?.trim().replace(/\/+$/, "") || "https://booking.reviosoft.app";
  let sent = 0;
  for (const r of soon) {
    const on = r.balanceChargeOn!.toISOString().slice(0, 10);
    // Only on the hotel's day before — not two days early because the server's day is UTC.
    if (addDay(todayInTimeZone(r.property.timezone, now)) !== on) continue;
    const to = r.guest?.email?.trim();
    const line = r.lines[0];
    const db = forTenant(r.tenantId);
    if (to && line) {
      const locale = r.guestLanguage || r.property.defaultLanguage || "en";
      const intl = locale === "bg" ? "bg-BG" : "en-GB";
      const money = (m: number) => new Intl.NumberFormat(intl, { style: "currency", currency: r.currency }).format(m / 100);
      const reference = bookingReference(r.id);
      const checkIn = line.checkIn.toISOString().slice(0, 10);
      const checkOut = line.checkOut.toISOString().slice(0, 10);
      const total = await storedStayTotal(db, r.id);
      const manage = r.guestManageToken && r.property.publicSlug
        ? `${origin}/${r.property.publicSlug}/booking/${reference}?k=${encodeURIComponent(r.guestManageToken)}`
        : null;
      await sendTemplatedEmail(system, {
        propertyId: r.propertyId,
        key: "balance_reminder",
        to: [to],
        locale,
        vars: {
          guestName: r.guest?.firstName || r.guestName || "",
          propertyName: r.property.name,
          reference, checkIn, checkOut,
          roomType: line.roomType?.name ?? "",
          amount: money(r.balanceChargeMinor!),
          chargeDate: new Date(`${on}T12:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "long", timeZone: "UTC" }),
          cardLast4: r.guaranteeLast4!,
        },
        details: stayDetails({
          locale, reference, roomType: line.roomType?.name ?? "", checkIn, checkOut,
          checkInTime: r.property.checkInTime, checkOutTime: r.property.checkOutTime, guests: line.guestsCount ?? null,
          ...(total ? { totalMinor: total.totalMinor, currency: total.currency } : {}),
        }),
        ...(manage ? { cta: { label: locale === "bg" ? "Вижте резервацията" : "View my booking", url: manage } } : {}),
      }).catch(() => ({ ok: false }));
      sent++;
    }
    // Stamped even without an address: there is nobody to tell, and asking again every hour helps no one.
    await db.reservation.update({ where: { id: r.id }, data: { balanceReminderSentAt: now } });
  }
  return sent;
}

/**
 * The balance a guest agreed to pay before arrival — "€254.10 charged automatically on 3 November"
 * — charged on that date, in the HOTEL's own day, to the card they authenticated at booking, on the
 * hotel's own Stripe account.
 *
 * Each stay is charged at most once: the Stripe idempotency key is the reservation, and
 * `balanceChargedAt` is stamped on success. A refusal (the bank wants the guest again, or declines)
 * is recorded on the stay as `balanceChargeError` — shown to the front desk — and never retried in a
 * loop, because a declined card retried every hour is how a guest's bank blocks the hotel.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const lease = await withJobLease(JOB.balanceCharges, 10 * 60_000, async () => {
      const system = forSystem();
      const now = new Date();
      // Everything due by the latest today on Earth; each is then checked against its own hotel's day.
      const horizon = new Date(now.getTime() + 36 * 3_600_000);
      const due = await system.reservation.findMany({
        where: {
          balanceChargeMinor: { gt: 0 },
          balanceChargedAt: null,
          balanceChargeError: null,
          balanceChargeOn: { lte: horizon },
          status: { in: ["confirmed", "checked_in"] },
          paymentCustomerId: { not: null },
          guaranteeRef: { not: null },
        },
        select: {
          id: true, tenantId: true, currency: true, balanceChargeMinor: true, balanceChargeOn: true,
          paymentAccountId: true, paymentCustomerId: true, guaranteeRef: true, onlinePaidMinor: true,
          property: { select: { timezone: true, name: true } },
        },
      });

      let charged = 0, refused = 0, notYet = 0;
      for (const r of due) {
        const today = todayInTimeZone(r.property.timezone, now);
        if (r.balanceChargeOn!.toISOString().slice(0, 10) > today) { notYet++; continue; }
        const res = await chargeSavedCard({
          account: r.paymentAccountId,
          customerId: r.paymentCustomerId!,
          paymentMethodId: r.guaranteeRef!,
          amountMinor: r.balanceChargeMinor!,
          currency: r.currency,
          description: `${r.property.name} · balance before arrival`,
          metadata: { reservationId: r.id, kind: "balance", source: "reviodirect" },
          idempotencyKey: `balance-${r.id}`,
        });
        const db = forTenant(r.tenantId);
        if (res.ok) {
          await db.reservation.update({
            where: { id: r.id },
            data: { balanceChargedAt: now, balancePaymentRef: res.intentId, onlinePaidMinor: (r.onlinePaidMinor ?? 0) + r.balanceChargeMinor! },
          });
          charged++;
        } else {
          await db.reservation.update({ where: { id: r.id }, data: { balanceChargeError: `${res.reason}: ${res.message}`.slice(0, 300) } });
          refused++;
        }
      }
      const reminded = await sendReminders(now);
      return { considered: due.length, charged, refused, notYet, reminded };
    });
    return NextResponse.json({ ok: true, ...lease });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
