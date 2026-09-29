import { NextResponse, type NextRequest } from "next/server";
import { forSystem } from "@revio/db";
import { invoiceByPayToken } from "@/lib/pay-page";
import { activeStripeMode, readStripeSecret } from "@/lib/integrations";
import { createCheckoutSession, isLinkLive } from "@/lib/stripe-checkout";
import { operatorOrigin } from "@/lib/invoice-mailer";

export const dynamic = "force-dynamic";

/**
 * "Pay by card" on an invoice's own page: a Checkout session, made fresh when needed.
 *
 * A still-live session for this invoice in the current mode is REUSED — two open sessions are two
 * chances to pay one bill. An expired one is replaced, with the previous id in the idempotency key so
 * a double click cannot create two. Anything that stops a card payment sends the customer back to
 * the page, which always offers the bank route; it never shows them an error about our keys.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = operatorOrigin();
  const back = NextResponse.redirect(`${origin}/pay/${token}`, 303);
  const invoice = await invoiceByPayToken(token);
  if (!invoice || invoice.status === "paid") return back;

  const mode = await activeStripeMode();
  if (invoice.stripeCheckoutUrl && invoice.stripeMode === mode && isLinkLive(invoice.stripeCheckoutExpires)) {
    return NextResponse.redirect(invoice.stripeCheckoutUrl, 303);
  }
  const key = await readStripeSecret(mode);
  if (key.state !== "ready") return back;

  const billing = await forSystem().clientBilling.findUnique({ where: { tenantId: invoice.tenantId }, select: { legalName: true, billingEmail: true } });
  const result = await createCheckoutSession({
    mode,
    secretKey: key.secret,
    invoiceId: invoice.id,
    invoiceNumber: invoice.number!,
    amountMinor: invoice.grossMinor ?? invoice.amountMinor,
    currency: invoice.currency,
    customerName: billing?.legalName ?? invoice.buyerName ?? "Customer",
    customerEmail: billing?.billingEmail ?? null,
    origin,
    previousSessionId: invoice.stripeSessionId,
    returnPath: `/pay/${token}`,
  });
  if (!result.ok) {
    console.error(`pay page: checkout for ${invoice.number} failed — ${result.error}`);
    return back;
  }
  await forSystem().invoice.update({
    where: { id: invoice.id },
    data: {
      stripeSessionId: result.session.sessionId,
      stripeCheckoutUrl: result.session.url,
      stripeCheckoutExpires: result.session.expiresAt,
      stripeMode: mode,
    },
  });
  return NextResponse.redirect(result.session.url, 303);
}
