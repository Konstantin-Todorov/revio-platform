import { notFound } from "next/navigation";
import { CalendarCheck, CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";
import { forTenant } from "@revio/db";
import { bookingReference, paymentRequestState } from "@revio/booking";
import { guestPublishableKey } from "@revio/payments";
import { getPublicProperty } from "@/lib/property";
import { serverKit } from "@/lib/i18n/server";
import { PropertyHeader } from "@/components/PropertyHeader";
import { PropertyFooter } from "@/components/PropertyFooter";
import { PayLink } from "@/components/PayLink";

export const dynamic = "force-dynamic";

/**
 * A payment the hotel asked for — one amount, one button, the booking it is for, and nothing else.
 * Reached only by the token in the hotel's email; every other state (paid, expired, withdrawn) says
 * plainly what happened instead of showing a card form that cannot work.
 */
export default async function PayPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const property = await getPublicProperty(slug);
  if (!property) notFound();
  const req = await forTenant(property.tenantId).paymentRequest.findFirst({
    where: { token, propertyId: property.id },
    include: { reservation: { include: { lines: { include: { roomType: true }, take: 1 } } } },
  });
  if (!req) notFound();
  const kit = await serverKit(property);
  const { s, money, fmtDay } = kit;
  const p = s.pay;
  const state = paymentRequestState(req);
  const line = req.reservation.lines[0];
  const amount = money(req.amountMinor, req.currency);
  const key = guestPublishableKey();

  const status = (icon: React.ReactNode, title: string, body: string, tone: string) => (
    <div className="card mt-6 p-6 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `hsl(var(${tone}) / 0.12)`, color: `hsl(var(${tone}))` }}>{icon}</span>
      <h2 className="display mt-4 text-[1.5rem]">{title}</h2>
      <p className="mt-2 text-[14px]" style={{ color: "hsl(var(--ink-soft))" }}>{body}</p>
    </div>
  );

  return (
    <>
      <PropertyHeader property={property} />
      <main className="mx-auto w-full max-w-[34rem] px-5 pb-20 pt-10 sm:px-8">
        <h1 className="display text-[1.9rem]">{p.title(property.name)}</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>{p.lead}</p>

        <section className="card-raised mt-6 overflow-hidden">
          <div className="flex items-baseline justify-between gap-4 px-5 py-4">
            <div>
              <p className="eyebrow">{p.amount}</p>
              {req.note && <p className="mt-1 text-[14px] font-semibold">{req.note}</p>}
            </div>
            <p className="price text-[2rem]">{amount}</p>
          </div>
          {line && (
            <div className="grid grid-cols-2 gap-3 border-t px-5 py-3.5 text-[13px]" style={{ borderColor: "hsl(var(--line))", color: "hsl(var(--ink-soft))" }}>
              <p className="col-span-2 font-semibold" style={{ color: "hsl(var(--ink))" }}>{p.forStay} · {bookingReference(req.reservationId)}</p>
              <p className="flex items-center gap-1.5"><CalendarCheck size={14} aria-hidden /> {fmtDay(line.checkIn.toISOString().slice(0, 10))} — {fmtDay(line.checkOut.toISOString().slice(0, 10))}</p>
              <p>{line.roomType.name}</p>
            </div>
          )}
        </section>

        {state === "paid" ? status(<CheckCircle2 size={24} aria-hidden />, p.paidTitle, p.paidBody(amount), "--positive")
          : state === "expired" ? status(<Clock size={24} aria-hidden />, p.expiredTitle, p.expiredBody, "--caution")
          : state === "cancelled" ? status(<XCircle size={24} aria-hidden />, p.cancelledTitle, p.cancelledBody, "--ink-faint")
          : !property.paymentReady || !key ? status(<XCircle size={24} aria-hidden />, p.notReady, "", "--caution")
          : (
            <>
              <PayLink
                slug={property.slug}
                token={token}
                amountMinor={req.amountMinor}
                config={{ publishableKey: key, account: property.paymentAccountId, currency: req.currency, locale: kit.locale }}
                payLabel={p.pay(amount)}
              />
              <p className="mt-3 flex items-start gap-2 text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>
                <ShieldCheck size={14} aria-hidden className="mt-0.5 shrink-0" /> {p.secure}
              </p>
            </>
          )}
      </main>
      <PropertyFooter property={property} />
    </>
  );
}
