import { CreditCard, Link2 } from "lucide-react";
import { paymentRequestState, storedStayTotal } from "@revio/booking";
import { guestPaymentsConfigured, isMockAccount } from "@revio/payments";
import { Card, CardHeader } from "@/components/ui/primitives";
import { SubmitButton } from "@revio/ui/submit-button";
import { prisma } from "@/lib/db";
import { getProperty } from "@/lib/data";
import { i18n } from "@/lib/i18n/server";
import { reservations as reservationsDict } from "@/lib/i18n/reservations";
import { cancelPaymentRequest, requestGuestPayment } from "@/lib/actions-payment-requests";

const inputCls =
  "h-[38px] w-full rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none focus:border-brand-500";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400";

/**
 * Ask the guest to pay with a link — and see every link asked, its state and what came in.
 * The amount suggested is what is still unpaid; the desk can change it (a deposit is often less).
 */
export async function PaymentLinkCard({
  reservation, flash,
}: {
  reservation: { id: string; currency: string; onlinePaidMinor: number | null; guest: { email: string | null } | null };
  flash?: string;
}) {
  const property = await getProperty();
  const { t: tr, money, day } = await i18n();
  const t = tr(reservationsDict).detail.payLink;
  const m = (minor: number) => money(minor, reservation.currency);
  const requests = await prisma.paymentRequest.findMany({ where: { reservationId: reservation.id }, orderBy: { createdAt: "desc" } });
  const total = (await storedStayTotal(prisma, reservation.id))?.totalMinor ?? 0;
  const paidLinks = requests.filter((r) => r.status === "paid").reduce((s, r) => s + r.amountMinor, 0);
  const outstanding = Math.max(0, total - (reservation.onlinePaidMinor ?? 0) - paidLinks);
  const ready = property.stripeChargesEnabled && !!property.stripeAccountId && !isMockAccount(property.stripeAccountId)
    && guestPaymentsConfigured() && property.bookingEngineEnabled && !!property.publicSlug;
  const origin = process.env.BOOKING_ENGINE_ORIGIN?.trim().replace(/\/+$/, "")
    || (process.env.NODE_ENV === "development" ? "http://localhost:3004" : "");
  const notice = flash ? (t as unknown as Record<string, string>)[flash] : null;
  const tone = { open: "text-amber-700 bg-amber-50", paid: "text-emerald-700 bg-emerald-50", cancelled: "text-ink-500 bg-surface-muted", expired: "text-ink-500 bg-surface-muted" } as const;

  return (
    <Card>
      <CardHeader title={t.title} />
      <div className="space-y-3 px-4 py-3.5 text-[13px]">
        <p className="text-ink-500">{t.hint}</p>
        {notice && typeof notice === "string" && (
          <p className={`rounded-md px-3 py-2 font-semibold ${flash === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`} role="status">{notice}</p>
        )}

        {requests.length > 0 && (
          <ul className="divide-y divide-surface-border/60 rounded-md border border-surface-border">
            {requests.map((r) => {
              const st = paymentRequestState(r);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <CreditCard className="h-4 w-4 text-ink-400" aria-hidden />
                  <span className="tnum font-semibold text-ink-900">{m(r.amountMinor)}</span>
                  {r.note && <span className="text-ink-500">{r.note}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone[st]}`}>{t.status[st]}</span>
                  <span className="text-[12px] text-ink-400">
                    {st === "paid" && r.paidAt ? t.paidWith(r.cardLast4 ?? "••••", day(r.paidAt.toISOString().slice(0, 10))) : st === "open" ? t.until(day(r.expiresAt.toISOString().slice(0, 10))) : ""}
                  </span>
                  {st === "open" && (
                    <span className="ml-auto flex items-center gap-3">
                      {origin && property.publicSlug && (
                        <a href={`${origin}/${property.publicSlug}/pay/${r.token}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                          <Link2 className="h-3.5 w-3.5" aria-hidden /> {t.copy}
                        </a>
                      )}
                      <form action={cancelPaymentRequest}>
                        <input type="hidden" name="requestId" value={r.id} />
                        <button className="text-[12px] font-semibold text-ink-500 hover:text-red-700">{t.cancel}</button>
                      </form>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!ready ? (
          <p className="rounded-md bg-surface-muted px-3 py-2 text-ink-600">{t.notReady}</p>
        ) : !reservation.guest?.email ? (
          <p className="rounded-md bg-surface-muted px-3 py-2 text-ink-600">{t.noEmail}</p>
        ) : (
          <form action={requestGuestPayment} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[10rem_1fr_auto]">
            <input type="hidden" name="id" value={reservation.id} />
            <div>
              <label className={labelCls} htmlFor="pl-amount">{t.amount(reservation.currency)}</label>
              <input id="pl-amount" name="amount" type="number" step="0.01" min="0.01" required
                     defaultValue={outstanding > 0 ? (outstanding / 100).toFixed(2) : ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="pl-note">{t.note}</label>
              <input id="pl-note" name="note" maxLength={200} placeholder={t.notePlaceholder} className={inputCls} />
            </div>
            <SubmitButton pendingLabel={t.sending} className="h-[38px] rounded-md bg-brand-800 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700">{t.send}</SubmitButton>
            {outstanding > 0 && <p className="text-[12px] text-ink-400 sm:col-span-3">{t.outstanding(m(outstanding))}</p>}
          </form>
        )}
        {requests.some((r) => r.status === "paid") && <p className="text-[12px] text-ink-400">{t.refundNote}</p>}
      </div>
    </Card>
  );
}
