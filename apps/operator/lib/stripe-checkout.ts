import type { StripeMode } from "./stripe-key";

/**
 * Turning one of our invoices into a page a hotel can pay on.
 *
 * ## Stripe Checkout, and why not Elements
 *
 * Checkout is hosted by Stripe: we send an amount and get back a URL. The hotel opens it, pays, and
 * no card detail ever touches our servers, our logs or our error reporter — which keeps the PCI
 * question at "we never see a card" rather than at "we see one but handle it carefully".
 *
 * Elements would let us build the form ourselves, and there is nothing to gain from that here. The
 * person paying is a hotel owner opening a link from an invoice email, not a guest mid-booking; they
 * are not in a flow we are trying to keep them inside. Elements is the right answer for the *guest*
 * card path in RevioDirect, and that is where it already is.
 *
 * ## Stripe is the rail, never the invoicing system
 *
 * We deliberately do **not** use Stripe Invoicing. It issues documents under its own numbering, and
 * Bulgarian law wants one gapless ascending run per company (`OperatorInvoiceSeries`). A second
 * source of invoice numbers is a compliance defect, not a convenience. So the Checkout Session
 * carries a single line whose name is *our* invoice number, and the document the customer files is
 * still the one we issued.
 *
 * ## The amount is the GROSS
 *
 * What the customer owes is net + VAT, and `grossMinor` is the only field that means that. Charging
 * `amountMinor` (the net) would silently undercharge every domestic invoice by the VAT — and it is
 * the field with the most innocent-looking name, which is exactly why this is written down.
 */

export interface CheckoutInput {
  mode: StripeMode;
  secretKey: string;
  invoiceId: string;
  /** Our own gapless number. It becomes the line description the customer sees on Stripe. */
  invoiceNumber: string;
  /** GROSS — net plus VAT. What they actually owe. */
  amountMinor: number;
  currency: string;
  customerName: string;
  /** Pre-fills the receipt address. Absent is fine; Stripe asks. */
  customerEmail: string | null;
  /** Where Stripe returns the browser afterwards, e.g. https://operator.reviosoft.app */
  origin: string;
  /** The last session stored for this invoice. It makes the next generation stable across races. */
  previousSessionId?: string | null;
  /** Hours the link stays valid. Stripe's own maximum is 24. */
  expiresInHours?: number;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
  expiresAt: Date;
}

export type CheckoutResult =
  | { ok: true; session: CheckoutSession }
  | { ok: false; error: string };

const API = "https://api.stripe.com/v1";

/**
 * One stable Stripe request per invoice generation.
 *
 * The previous implementation included the wall-clock hour. Two clicks either side of the hour
 * could therefore create two payable sessions. The last STORED session is the generation token:
 * concurrent callers see the same previous value and Stripe returns the same session; after that
 * session expires, its id becomes the stable token for exactly one successor.
 */
export function checkoutIdempotencyKey(invoiceId: string, previousSessionId?: string | null): string {
  return `revio-invoice-${invoiceId}-${previousSessionId ?? "initial"}`;
}

/**
 * Create the session.
 *
 * Every failure path returns a sentence rather than a status code, because the person who presses
 * this button is deciding whether to email the link or chase a bank transfer, and "500" does not
 * help them choose.
 */
export async function createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
  if (input.amountMinor <= 0) {
    return { ok: false, error: "This invoice has no amount to charge." };
  }

  const hours = Math.min(Math.max(input.expiresInHours ?? 24, 1), 24);
  const expiresAt = new Date(Date.now() + hours * 3_600_000);

  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(input.amountMinor),
    // The customer sees OUR invoice number on Stripe's page, so the thing they are paying and the
    // document in their accounts are visibly the same thing.
    "line_items[0][price_data][product_data][name]": `Revio invoice ${input.invoiceNumber}`,
    "line_items[0][price_data][product_data][description]": `${input.customerName} — hotel software subscription`,
    /*
     * The metadata that makes the webhook safe.
     *
     * Set on BOTH the session and the payment intent. The session carries it for
     * `checkout.session.completed`; the payment intent carries it so a refund, dispute or any
     * later event can still be traced back to the invoice without a lookup table.
     */
    "metadata[revioInvoiceId]": input.invoiceId,
    "metadata[revioInvoiceNumber]": input.invoiceNumber,
    "payment_intent_data[metadata][revioInvoiceId]": input.invoiceId,
    // What appears on the customer's card statement. Blank here is a support ticket in a month.
    "payment_intent_data[description]": `Revio invoice ${input.invoiceNumber}`,
    success_url: `${input.origin}/paid`,
    cancel_url: `${input.origin}/paid?cancelled=1`,
    expires_at: String(Math.floor(expiresAt.getTime() / 1000)),
  });
  if (input.customerEmail) body.set("customer_email", input.customerEmail);

  let res: Response;
  try {
    res = await fetch(`${API}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2024-06-20",
        /*
         * Idempotency, so a double-click or a retry cannot create two live payment links for one
         * invoice — two links means two chances to pay the same bill twice.
         *
         * Keyed on the invoice and its last stored session — never on the wall clock. Concurrent
         * callers therefore use the same key even across an hour boundary. Once a session expires,
         * its id becomes the generation token for the one legitimate successor.
         */
        "Idempotency-Key": checkoutIdempotencyKey(input.invoiceId, input.previousSessionId),
      },
      body: body.toString(),
    });
  } catch {
    return { ok: false, error: "Could not reach Stripe. Nothing has been created — try again." };
  }

  // Status first, never the shape of the answer. A Stripe error is valid JSON, and reading `.url`
  // off it yields `undefined` rather than an error — the trap documented on `stripe-check.ts`.
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (res.status !== 200) {
    const root = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
    const err = root && typeof root.error === "object" && root.error ? (root.error as Record<string, unknown>) : null;
    const message = err && typeof err.message === "string" ? err.message : null;
    if (res.status === 401) {
      return { ok: false, error: "Stripe rejected the stored key. Check the connection on Integrations before trying again." };
    }
    return { ok: false, error: message ?? `Stripe answered ${res.status}. No payment link was created.` };
  }

  const root = json as Record<string, unknown> | null;
  const sessionId = root && typeof root.id === "string" ? root.id : null;
  const url = root && typeof root.url === "string" ? root.url : null;
  if (!sessionId || !url) {
    return { ok: false, error: "Stripe accepted the request but returned no payment link. Nothing has been charged." };
  }

  return { ok: true, session: { sessionId, url, expiresAt } };
}

/** A stored link is only useful while it is alive. Stripe expires them; the screen must not pretend. */
export function isLinkLive(expires: Date | null | undefined, now = new Date()): boolean {
  return !!expires && expires.getTime() > now.getTime();
}
