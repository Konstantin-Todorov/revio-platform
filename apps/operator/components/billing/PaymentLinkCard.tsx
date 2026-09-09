import { CreditCard, Link2, ShieldCheck } from "lucide-react";
import { Card, StatusPill } from "@/components/ui/primitives";
import { createInvoicePaymentLink, clearInvoicePaymentLink } from "@/lib/actions-integrations";
import { isLinkLive } from "@/lib/stripe-checkout";
import { CopyLinkButton } from "./CopyLinkButton";

/**
 * How this invoice gets paid by card.
 *
 * ## What this card has to answer, in order
 *
 * **Is it paid?** first, because everything else is irrelevant if it is. **Is there a live link?**
 * second — that is the thing somebody came here to fetch and send. **Is it real money?** always, in
 * red, because a sandbox link and a live link look identical and only one of them charges anybody.
 *
 * ## Why the link is shown rather than emailed from here
 *
 * Sending it is a decision with a covering sentence — *"here is the invoice, here is the link"* —
 * and that email is not built yet. Handing the operator the URL to paste is honest about that. A
 * "Send" button that silently composed something on their behalf would be worse than no button.
 */
export function PaymentLinkCard({
  invoice,
}: {
  invoice: {
    id: string;
    status: string;
    number: string | null;
    currency: string;
    grossMinor: number | null;
    amountMinor: number;
    paidVia: string | null;
    paidAt: Date | null;
    paidReference: string | null;
    stripeMode: string | null;
    stripeCheckoutUrl: string | null;
    stripeCheckoutExpires: Date | null;
  };
}) {
  const live = isLinkLive(invoice.stripeCheckoutExpires);
  const owed = invoice.grossMinor ?? invoice.amountMinor;
  const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: invoice.currency }).format(owed / 100);
  const isLive = invoice.stripeMode === "live";

  if (invoice.status === "paid") {
    return (
      <Card className="mb-4 p-4" data-print-hide>
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-[18px] w-[18px] text-success-600" />
          <span className="text-[13px] font-bold text-ink-900">Paid</span>
          <StatusPill tone="success">{invoice.paidVia === "stripe" ? "by card" : "recorded by hand"}</StatusPill>
          {invoice.paidAt && (
            <span className="text-[11.5px] text-ink-400">{new Date(invoice.paidAt).toLocaleDateString("en-GB")}</span>
          )}
        </div>
        {invoice.paidVia === "stripe" && (
          // The reference is what reconciles our row against Stripe's dashboard. Without it the two
          // are two claims about the same money with nothing joining them.
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-400">
            Stripe {invoice.stripeMode ?? "?"} · {invoice.paidReference ?? "no reference"}
            {invoice.stripeMode === "test" && (
              <span className="ml-1 font-semibold text-warning-700">— sandbox, so no money actually moved.</span>
            )}
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card className="mb-4 p-4" data-print-hide>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-[18px] w-[18px] text-ink-400" />
            <h3 className="text-[13px] font-bold text-ink-900">Pay by card</h3>
            {live && (
              <StatusPill tone={isLive ? "danger" : "warning"}>
                {isLive ? "live · real money" : "sandbox · charges nothing"}
              </StatusPill>
            )}
          </div>
          <p className="mt-1 max-w-[62ch] text-[11.5px] leading-relaxed text-ink-400">
            A Stripe-hosted page for {money}. No card detail reaches Revio, and the invoice is marked
            paid by Stripe telling us so — not by the customer reaching a thank-you page.
          </p>
        </div>

        {!live && invoice.number && (
          <form action={createInvoicePaymentLink}>
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700"
            >
              <Link2 className="h-4 w-4" /> Create payment link
            </button>
          </form>
        )}
      </div>

      {/* An invoice with no number has no frozen amount, so a link against it would charge a figure
          nobody has agreed. Said here rather than only refused on submit. */}
      {!invoice.number && (
        <p className="rounded-md bg-warning-50 px-3 py-2 text-[12px] text-warning-700">
          Issue this invoice first. A draft has no number and its amount can still change.
        </p>
      )}

      {live && (
        <div className="rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <code className="tnum min-w-0 flex-1 truncate text-[11.5px] text-ink-600">{invoice.stripeCheckoutUrl}</code>
            <CopyLinkButton url={invoice.stripeCheckoutUrl!} />
          </div>
          <p className="mt-1.5 text-[11px] text-ink-400">
            Expires {new Date(invoice.stripeCheckoutExpires!).toLocaleString("en-GB")} — Stripe&rsquo;s
            limit is 24 hours, so send it now rather than saving it for Monday.
            {invoice.stripeMode === "test" && " Test card: 4242 4242 4242 4242, any future date, any CVC."}
          </p>
          <form action={clearInvoicePaymentLink} className="mt-1">
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <button
              type="submit"
              className="rounded-md px-1.5 py-1 text-[11px] font-semibold text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
            >
              Withdraw this link
            </button>
          </form>
        </div>
      )}
    </Card>
  );
}
