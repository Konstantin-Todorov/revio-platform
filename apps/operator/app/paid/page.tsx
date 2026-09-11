import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { forSystem } from "@revio/db";

/**
 * Where Stripe returns the customer's browser after Checkout.
 *
 * ## This page still decides nothing
 *
 * It does not mark anything paid, and it never will — **a redirect is not evidence**. Anyone can
 * open this URL without paying, and a customer who pays then closes the tab never reaches it. The
 * webhook settles the invoice; this page only reports what is already true.
 *
 * ## Why it can now name the invoice, having refused to before
 *
 * The first version showed nothing at all, because looking a session up meant calling Stripe from a
 * public page. It does not: the session id is resolved against **our own database**, and only an
 * invoice that already carries that exact `stripeSessionId` and has already been settled will match.
 *
 * So a public page makes no API call, uses no key, and can only echo back an invoice number and an
 * amount that the person who just paid already has in their hand and in their email. Anything richer
 * — the buyer's address, our bank details, the line items — stays behind the login where it belongs.
 *
 * ## The third state is the one people forget
 *
 * The redirect frequently beats the webhook by a second or two. "Paid" would then be a guess and
 * "nothing found" would read as a failed payment, so there is an explicit *received, still
 * recording* state. Saying "we have it, the paperwork is a moment behind" is both true and calm.
 */

export const dynamic = "force-dynamic";

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
}

export default async function PaidPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string; session_id?: string }>;
}) {
  const { cancelled, session_id: sessionId } = await searchParams;

  /*
   * Matched on the session id AND on the invoice already being paid.
   *
   * Both halves matter. The session id proves this browser is the one we sent to Checkout; `paid`
   * proves Stripe has confirmed it to us over a signed webhook. Showing a number on the strength of
   * the URL alone would make this page an oracle for anybody holding a session id.
   */
  const invoice =
    !cancelled && sessionId
      ? await forSystem().invoice.findFirst({
          where: { stripeSessionId: sessionId, status: "paid" },
          select: { number: true, grossMinor: true, amountMinor: true, currency: true, stripeMode: true },
        })
      : null;

  if (cancelled) {
    return (
      <Shell tone="neutral" icon={<XCircle className="mx-auto h-10 w-10 text-ink-300" />} title="Payment cancelled">
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
          Nothing has been charged and your invoice is unchanged. You can open the payment link again
          whenever you are ready, or pay by bank transfer using the details on the invoice.
        </p>
      </Shell>
    );
  }

  if (invoice) {
    const owed = invoice.grossMinor ?? invoice.amountMinor;
    return (
      <Shell tone="success" icon={<CheckCircle2 className="mx-auto h-10 w-10 text-success-600" />} title="Payment received">
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
          Thank you. Stripe has confirmed the payment and your invoice is marked paid.
        </p>
        <dl className="mt-5 divide-y divide-surface-border rounded-lg border border-surface-border text-left">
          <div className="flex items-center justify-between px-4 py-2.5">
            <dt className="text-[12.5px] text-ink-500">Invoice</dt>
            <dd className="tnum text-[13px] font-bold text-ink-900">{invoice.number}</dd>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <dt className="text-[12.5px] text-ink-500">Paid</dt>
            <dd className="tnum text-[13px] font-bold text-ink-900">{money(owed, invoice.currency)}</dd>
          </div>
        </dl>
        {/* A sandbox payment looks identical to a real one on this page, and the difference is the
            whole point of a rehearsal. Say it rather than let somebody believe they have paid. */}
        {invoice.stripeMode === "test" && (
          <p className="mt-3 rounded-md bg-warning-50 px-3 py-2 text-[12px] font-medium text-warning-700">
            This was a test payment. No money actually moved.
          </p>
        )}
        <p className="mt-4 border-t border-surface-border pt-4 text-[12px] leading-relaxed text-ink-400">
          A confirmation is on its way by email, with the paid invoice attached. You can close this
          window.
        </p>
      </Shell>
    );
  }

  /*
   * Paid, but the webhook has not landed yet — or somebody opened this URL on their own. Both look
   * the same from here, and the honest sentence covers both without claiming either.
   */
  return (
    <Shell tone="neutral" icon={<Clock className="mx-auto h-10 w-10 text-ink-300" />} title="Thank you">
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
        If you have just paid, Stripe has your payment and will email you a receipt. Our own
        confirmation follows within a few seconds — there is nothing else for you to do.
      </p>
      <p className="mt-4 border-t border-surface-border pt-4 text-[12px] leading-relaxed text-ink-400">
        You can close this window. If anything looks wrong, reply to the invoice email and a person
        will check it.
      </p>
    </Shell>
  );
}

function Shell({
  icon,
  title,
  children,
}: {
  tone: "success" | "neutral";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-16">
      <div className="w-full max-w-[440px] rounded-xl bg-white p-8 text-center shadow-float">
        {icon}
        <h1 className="mt-4 text-[19px] font-bold tracking-tight text-ink-900">{title}</h1>
        {children}
      </div>
    </main>
  );
}
