import { NextResponse, type NextRequest } from "next/server";
import { forSystem, decryptSecret } from "@revio/db";
import { verifyAgainstModes, readCheckoutCompleted, readRefundOrDispute, matchesStoredCheckoutSession } from "@/lib/stripe-webhook";

/**
 * Where Stripe tells us an invoice has been paid.
 *
 * ## Why this endpoint has to exist at all
 *
 * The obvious design is to mark the invoice paid when the customer's browser lands on the success
 * page. That is wrong, and it fails in both directions: a browser can reach the success URL without
 * paying (it is just a URL), and a customer who pays and then closes the tab never reaches it at
 * all. **A redirect is not evidence.** The only party that knows a payment succeeded is Stripe, and
 * this is how Stripe says so.
 *
 * ## Everything below the signature check is untrusted until it verifies
 *
 * This is a public URL — it has to be, Stripe is a server with no session — and what it does is mark
 * our invoices paid. Without a verified signature it is an unauthenticated write that says "this
 * customer has paid", and anyone who guesses the path clears their own bill.
 *
 * So the order is: raw bytes → verify → *only then* parse and act. No field of the body is read
 * before `verifyAgainstModes` returns ok, including which mode sent it — the body cannot be asked to
 * authenticate itself.
 *
 * ## The status codes are part of the design
 *
 * - **400** — did not verify. Stripe retries a while and gives up, which is the correct outcome for
 *   something that never came from Stripe.
 * - **200** — verified, whether or not we acted on it. An event we do not handle, an invoice already
 *   paid, a session we do not recognise: all 200. A route that errors on those gets retried forever
 *   and eventually **disabled by Stripe**, which would take the events we do care about with it.
 * - **500** — only a genuine failure on our side, where a retry is what we actually want.
 */

export const dynamic = "force-dynamic";

const prisma = forSystem();

export async function POST(req: NextRequest) {
  /*
   * The RAW body, and it must stay raw.
   *
   * `req.json()` would parse and discard the bytes the signature is over — re-serialising changes
   * key order and whitespace, and the check then fails for every genuine event. The symptom is
   * "Stripe keeps sending bad signatures", which sends somebody to look at Stripe.
   */
  const rawBody = await req.text();
  const header = req.headers.get("stripe-signature");

  const stored = await prisma.platformCredential.findMany({
    where: { provider: "stripe", webhookCipher: { not: null } },
    select: { mode: true, webhookCipher: true },
  });
  const secrets = stored.flatMap((c) => {
    try {
      return [{ mode: c.mode as "test" | "live", secret: decryptSecret(c.webhookCipher!) }];
    } catch {
      // A secret we cannot decrypt is a rotation problem, not an event problem. Drop it rather than
      // failing the whole request — the other mode may still verify.
      console.error(`[stripe-webhook] ${c.mode} webhook secret cannot be decrypted; check CONNECTIVITY_SECRET rotation`);
      return [];
    }
  });

  const verified = verifyAgainstModes(rawBody, header, secrets);
  if (!verified.ok) {
    /*
     * 400 and nothing else. In particular the body is NOT logged: an unverified request is
     * attacker-controlled, and writing it into our logs is where a log-injection lives.
     */
    return NextResponse.json({ error: verified.reason }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Verified, but the body is not JSON." }, { status: 400 });
  }

  /*
   * Money going OUT is payment truth too (§S2).
   *
   * Handled before the payment branch only because it is a different question entirely: a refund or
   * dispute never settles an invoice, it records what happened to money that already arrived.
   */
  const back = readRefundOrDispute(body);
  if (back) return settleRefundOrDispute(back);

  const event = readCheckoutCompleted(body);
  // Verified but not ours to act on. 200, so Stripe stops.
  if (!event) return NextResponse.json({ received: true, handled: false });

  if (event.paymentStatus !== "paid") {
    // A completed session that is not paid — an async method still pending, or a failure. Nothing to
    // do, and marking it paid on "completed" alone is exactly the bug this check exists to avoid.
    return NextResponse.json({ received: true, handled: false, reason: "not paid" });
  }
  if (!event.invoiceId) {
    return NextResponse.json({ received: true, handled: false, reason: "no invoice in metadata" });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: event.invoiceId },
    select: { id: true, status: true, grossMinor: true, amountMinor: true, currency: true, stripeSessionId: true, number: true },
  });
  if (!invoice) return NextResponse.json({ received: true, handled: false, reason: "unknown invoice" });

  /*
   * Only an ISSUED invoice can be settled.
   *
   * A draft has no number and its amount can still move, so "paid" against one would close a bill
   * nobody has agreed. Creating a link already refuses drafts; this is the same rule at the other
   * end, where the input comes from outside.
   */
  if (!invoice.number) {
    return NextResponse.json({ received: true, handled: false, reason: "invoice is not issued" });
  }

  /*
   * The session must be the one WE created for THIS invoice.
   *
   * Metadata is attacker-controllable in the sense that matters: an event is only as trustworthy as
   * the account that signed it, and a session belonging to a different invoice must never be able to
   * settle this one. The unique index on `stripeSessionId` is the other half of this guarantee.
   */
  if (!matchesStoredCheckoutSession(invoice.stripeSessionId, event.sessionId)) {
    return NextResponse.json({ received: true, handled: false, reason: "session does not belong to this invoice" });
  }

  /*
   * And the money has to match what we asked for.
   *
   * Defence in depth: Checkout was created with our amount, so a mismatch means something is wrong
   * upstream — a session made by hand, an invoice re-priced after the link was sent. Marking it paid
   * anyway would close a bill that has not been settled.
   */
  const owed = invoice.grossMinor ?? invoice.amountMinor;
  if (event.amountTotalMinor !== owed || (event.currency && event.currency !== invoice.currency.toUpperCase())) {
    return NextResponse.json(
      { received: true, handled: false, reason: "amount or currency does not match the invoice" },
    );
  }

  /*
   * Idempotent by construction: the `where` clause is the decision.
   *
   * Stripe delivers at least once and retries on any non-2xx, so the same event arrives more than
   * once as a matter of routine. `count` tells us whether THIS delivery was the one that moved it,
   * which is what stops a second audit entry being written for a payment that happened once. Same
   * shape as the hold conversion in the booking engine (R1).
   */
  const { count } = await prisma.invoice.updateMany({
    where: { id: invoice.id, status: { not: "paid" } },
    data: {
      status: "paid",
      paidAt: new Date(),
      paidVia: "stripe",
      stripeMode: verified.mode,
      stripePaymentIntentId: event.paymentIntentId,
      stripeSessionId: event.sessionId,
      /*
       * The same two fields a person fills in when they mark a bank transfer paid, so a card payment
       * and a manual one land in one place rather than two.
       *
       * `paidById` stays NULL deliberately: nobody clicked. Together with `paidVia = "stripe"` that
       * reads as "the machine recorded this", which is true and is exactly what an auditor needs to
       * be able to tell apart from a person asserting it.
       */
      paidReference: event.paymentIntentId ?? event.sessionId,
      // The link has done its job. Leaving it live invites a second payment of a settled bill.
      stripeCheckoutUrl: null,
      stripeCheckoutExpires: null,
    },
  });

  return NextResponse.json({ received: true, handled: true, changed: count === 1 });
}

/**
 * A GET here is somebody checking the URL is alive, or a misconfigured endpoint.
 *
 * It answers without touching the database and without confirming anything about what is stored,
 * because "does this operator have Stripe configured" is not a question a stranger gets to ask.
 */
export function GET() {
  return NextResponse.json({ ok: true, endpoint: "stripe-webhook", method: "POST" });
}

/**
 * Record money that came back, or a dispute, beside the invoice it belongs to.
 *
 * ## `status` never moves off "paid", and that is the whole design
 *
 * The invoice records a supply that happened and a payment that happened. Both stay true after the
 * money is returned. Flipping it back to unpaid would rewrite history — and would put it back on the
 * chase list as though the customer had never paid, which is an untrue story about somebody who paid
 * and was then refunded.
 *
 * ## Matched on the payment intent, not on metadata alone
 *
 * A refund event carries a charge rather than a Checkout session, so it has no session id. It does
 * carry the payment intent, and `createCheckoutSession` deliberately writes our invoice id onto the
 * intent as well as the session — that second copy exists for exactly this. Where Stripe echoes the
 * metadata back, it is checked AGAINST the intent rather than believed instead of it.
 */
async function settleRefundOrDispute(e: Awaited<ReturnType<typeof readRefundOrDispute>>) {
  if (!e) return NextResponse.json({ received: true, handled: false });
  if (!e.paymentIntentId) {
    return NextResponse.json({ received: true, handled: false, reason: "no payment intent on the event" });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { stripePaymentIntentId: e.paymentIntentId },
    select: { id: true, number: true, refundedMinor: true, currency: true, grossMinor: true, amountMinor: true },
  });
  if (!invoice) {
    // A payment we did not create — another integration on the same Stripe account, or a charge made
    // by hand in the Dashboard. Not ours to record, and not an error.
    return NextResponse.json({ received: true, handled: false, reason: "no invoice for that payment" });
  }
  if (e.invoiceId && e.invoiceId !== invoice.id) {
    // The two identifiers disagree. Something is wrong upstream and guessing which to believe is
    // exactly how the wrong invoice gets marked refunded.
    return NextResponse.json({ received: true, handled: false, reason: "metadata and payment intent name different invoices" });
  }

  if (e.kind === "dispute") {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { disputeStatus: e.disputeStatus, disputedAt: new Date() },
    });
    return NextResponse.json({ received: true, handled: true, kind: "dispute", status: e.disputeStatus });
  }

  /*
   * `amount_refunded` is CUMULATIVE on the charge, so two partial refunds arrive as two events and
   * the second already carries the total. Taking the larger of stored and incoming makes a replayed
   * or out-of-order delivery harmless — the same reason the payment path keys off a `where` clause
   * rather than counting on exactly-once delivery.
   */
  const refunded = Math.max(invoice.refundedMinor, e.amountMinor ?? 0);
  if (refunded === invoice.refundedMinor) {
    return NextResponse.json({ received: true, handled: true, changed: false });
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { refundedMinor: refunded, refundedAt: new Date() },
  });
  return NextResponse.json({
    received: true,
    handled: true,
    changed: true,
    refundedMinor: refunded,
    fully: refunded >= (invoice.grossMinor ?? invoice.amountMinor),
  });
}
