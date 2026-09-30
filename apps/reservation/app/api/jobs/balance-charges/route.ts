import { NextResponse, type NextRequest } from "next/server";
import { JOB, withJobLease, forSystem, forTenant } from "@revio/db";
import { chargeSavedCard } from "@revio/payments";
import { todayInTimeZone } from "@revio/core";

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
      return { considered: due.length, charged, refused, notYet };
    });
    return NextResponse.json({ ok: true, ...lease });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
