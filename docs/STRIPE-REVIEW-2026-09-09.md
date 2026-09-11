# Stripe payment path and live-account review (2026-09-09)

Read-only review. No Stripe setting, key, product, price, webhook, tax rate, bank account or payment
mode was changed. No secret was revealed or copied.

## Account state actually observed

- Revio Operator is still deliberately in **Sandbox**. Both stored connections pass their key check.
- Sandbox points to a separate account branded **Revio**. Live points to the old account branded
  **Weber**. Going live has not happened and should not happen before the decisions below.
- The live account can accept charges and payouts and Stripe shows no active account-status tasks.
- The live webhook `revio-operator` is active at
  `https://operator.reviosoft.app/api/webhooks/stripe`, with zero deliveries so far and 0% errors.
  It listens for `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed` and `checkout.session.expired`.
- The live account has 13 active products, all old web/SEO products in PHP/BGN/GBP. There is no Revio
  product. It has 14 old Stripe invoices, no active subscription, and old third-party WooCommerce
  webhooks. These are not used by the current Revio payment path.
- One active 20% Bulgarian tax rate exists from 2023. Revio does not use it, correctly: Revio issues
  the legally numbered invoice and sends the already-calculated gross amount to Checkout. Stripe
  Invoicing and Stripe Tax must not become a second invoice/tax authority by accident.
- Customer-facing live details are still Weber: Weber icon/no Revio logo, `www.weberbg.com`,
  `office@weberbg.com`, and card statement descriptor `WWW.WEBERBG.COM`.
- The only payout bank is a USD Revolut account and USD is the default settlement currency. Revio
  invoices in EUR, so Stripe converts before payout. The current public Bulgarian standard rate is
  1.5% + €0.25 for standard EEA cards, with an additional conversion fee when conversion is needed.
- Successful-payment and refund receipt emails are disabled. Stripe's support reply address is the
  Weber email. This is a product decision: our legal invoice remains Revio's, but a payment receipt
  can still be useful evidence for the payer.
- Cards, Apple Pay, Google Pay, Link, Bancontact and EPS are enabled in the live default payment-method
  configuration. Team-wide two-step authentication is required. There is one active owner and one
  inactive former administrator.

## Code findings — fix before live payments

### S1 · High · A delayed successful payment can remain “unpaid” in Revio

Checkout uses dynamic payment methods because the request does not set `payment_method_types`.
Stripe therefore uses the Dashboard configuration. The live webhook is subscribed to async success,
but `readCheckoutCompleted` accepts only `checkout.session.completed`; async success is acknowledged
with HTTP 200 and ignored forever. Stripe explicitly says delayed methods must be fulfilled from both
`checkout.session.completed` and `checkout.session.async_payment_succeeded`.

Fix: make the same idempotent settlement function accept both successful event types and add a real
HTTP verification case. Handling `async_payment_failed` as an operator alert is valuable but must not
mark an invoice paid. Until fixed, limit the Revio Checkout configuration to immediate card/wallet
methods only.

Sources: [Stripe fulfillment guide](https://docs.stripe.com/checkout/fulfillment),
[dynamic payment methods](https://docs.stripe.com/payments/checkout/payment-methods).

### S2 · High · Refunds and disputes do not change our payment truth — **FIXED 2026-09-11**

A refund or dispute in Stripe leaves `Invoice.status = "paid"`. The payment intent carries the Revio
invoice id, which makes reconciliation possible, but the endpoint does not subscribe to or process
refund/dispute events. Do not simply turn the legal invoice back into “unpaid”: the issued invoice,
payment, refund and dispute are separate accounting facts. Add a payment/refund state or ledger, an
operator alert and webhook handling after the founder/accountant settles the desired invoice model.

### S3 · High · The live key is broader than the integration needs

The validator accepts only `sk_test_…` / `sk_live_…`, so the stored live credential must be a full
secret key. A restricted `rk_…` key cannot be entered even though this path needs only Account and
Balance read plus Checkout Session write. Supporting a least-privilege restricted key would reduce
the impact of a database/encryption-key compromise.

### S4 · Medium · Session creation has a narrow duplicate-charge race

The action checks for a live link, calls Stripe, then stores the session in separate operations. The
Stripe idempotency key is invoice + wall-clock hour. Two requests straddling an hour boundary can
create two payable sessions; whichever database update lands last is the only session the webhook
will accept, even though the other session can still take money. Use a stable generation recorded by
an atomic database claim rather than the current hour, and explicitly model/reconcile a duplicate
payment.

### S5 · Medium · “The session must be ours” is not fully enforced

The webhook rejects a mismatched session only when `invoice.stripeSessionId` is non-null. An issued
invoice that never had a link accepts any correctly signed session from the Stripe account if its
metadata, amount and currency match. This requires access to our Stripe account, so it is not an
internet forgery, but the code's stated invariant is stronger than its check. Require an exact stored
session-id match.

### S6 · Medium · Credential decryption failure looks green until a payment fails

`readStripeSecret` converts every decryption failure to `null`, while readiness is based on the last
successful Stripe check stored in the database. The screen can therefore remain green after a broken
`CONNECTIVITY_SECRET` rotation; payment-link creation reports “no usable key”, and the webhook drops
an undecryptable signing secret before returning a generic signature error. Surface a distinct
`decryption_error` state in Integrations/Health and log it as an operational fault.

### S7 · Low · Every payment link creates a new Stripe Product and Price — **ACCEPTED, not fixed (2026-09-11)**

**Accepted rather than fixed, with the reasoning in the code.** The standing-product alternative keeps
the catalogue tidy and costs the thing that matters more: the customer sees *our* invoice number on
Stripe's page, on their card statement and in Stripe's own receipt, so what they pay and the document
in their accounts are visibly one thing. A few hundred invoices a year is not clutter worth trading
that for. Revisit when the catalogue is genuinely in the way.

Original finding: `price_data.product_data` asks Stripe to generate a new Product inline, so a
product-per-invoice will eventually clutter the catalog and reporting. No pre-created fixed prices are needed because invoice
amounts vary, but one Revio product per mode can be referenced while creating each variable inline
Price. Source: [Checkout Session API](https://docs.stripe.com/api/checkout/sessions/create).

### S8 · Low · API versions differ — **FIXED 2026-09-11** (`stripe-api-version.ts`, one constant)

Outbound calls pin `2024-06-20`; the live event destination is pinned to `2026-08-26.dahlia`. The
fields used today are compatible, but the two sides should be intentionally aligned and regression
tested so the webhook payload cannot drift independently of the parser.

## Founder decisions required before “Go live”

1. **Which Stripe account owns Revio revenue?** Preferred: complete live onboarding on the existing
   dedicated “Revio” account and replace the current Weber live key. Reusing Weber mixes SaaS revenue,
   old web-agency products/invoices/customers/webhooks and branding in one ledger.
2. **Who is the legal seller?** If it is still WEBER BG, keep the legal/tax identity but change the
   trading name, icon/logo, public website, support email and statement descriptor to Revio. If a
   different entity sells Revio, do not edit around it — use that entity's Stripe account.
3. **EUR settlement account.** Add a business EUR bank account and make EUR a settlement currency if
   available; otherwise explicitly accept Stripe's FX cost on every EUR hotel payment.
4. **Receipts.** Decide whether Stripe sends successful-payment/refund receipts in addition to our own
   legally numbered invoice. If enabled, fix branding and support email first.
5. **Accepted methods.** Until S1 is fixed, keep Revio to immediate card/wallet methods. After S1,
   decide whether local bank redirects are worth the added asynchronous reconciliation path.

## Suggested rehearsal gate

Keep the platform in Sandbox. Generate one issued demo invoice, create its link, pay with a Stripe
test card, and prove: one Checkout session, one verified webhook delivery, correct amount/currency,
invoice changes to paid once, replay changes nothing, and no redirect is treated as payment. Only
after that, complete the account/branding/EUR decisions, fix S1, switch live deliberately, and run a
small real payment followed by a refund/reconciliation test.
