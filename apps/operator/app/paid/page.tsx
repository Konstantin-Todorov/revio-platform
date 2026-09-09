import { CheckCircle2, XCircle } from "lucide-react";

/**
 * Where Stripe returns the customer's browser after Checkout.
 *
 * ## This page decides nothing
 *
 * It is deliberately static. It does not look up the session, does not read the invoice, and does
 * not mark anything paid — the webhook does that, because **a redirect is not evidence**: anyone can
 * open this URL without paying, and a customer who pays and then closes the tab never reaches it.
 *
 * It also looks nothing up because it *cannot* safely: this is a public URL with no session, and a
 * page that took a session id and reported an invoice's state would answer questions about our
 * customers' billing to anyone who guessed one.
 *
 * So it says the one true thing — Stripe has the payment, the receipt is on its way — and stops.
 * Outside the `(protected)` group and exempted in `middleware.ts`, because the person reading it is
 * a hotel owner who has no operator login and never will.
 */

export const dynamic = "force-dynamic";

export default async function PaidPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const cancelled = (await searchParams).cancelled === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-16">
      <div className="w-full max-w-[440px] rounded-xl bg-white p-8 text-center shadow-float">
        {cancelled ? (
          <>
            <XCircle className="mx-auto h-10 w-10 text-ink-300" />
            <h1 className="mt-4 text-[19px] font-bold tracking-tight text-ink-900">Payment cancelled</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
              Nothing has been charged and your invoice is unchanged. You can open the payment link
              again whenever you are ready, or pay by bank transfer using the details on the invoice.
            </p>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-success-600" />
            <h1 className="mt-4 text-[19px] font-bold tracking-tight text-ink-900">Thank you — payment received</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
              Stripe has your payment and will email you a receipt. Your invoice is marked as paid on
              our side within a few seconds; there is nothing else for you to do.
            </p>
            {/*
              * Said plainly rather than left to be wondered about. The customer has just handed over
              * money on a page they were sent to from an email, and "did that work?" is the only
              * question they have — so it is answered before they can ask it.
              */}
            <p className="mt-4 border-t border-surface-border pt-4 text-[12px] leading-relaxed text-ink-400">
              You can close this window. If anything looks wrong, reply to the invoice email and a
              person will check it.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
