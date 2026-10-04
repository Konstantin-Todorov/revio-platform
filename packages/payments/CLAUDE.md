# Package: Payments (`@revio/payments`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. Founder decision, standing:
> **Guest payments go live only by explicit choice** (founder, 2026-10-04: identity verified, "продължавай"):
> `STRIPE_GUEST_MODE=live` plus a live key. The desk terminal (`gateway.ts`) stays TEST/mock — see below.

The **only** path by which any Revio product touches a card. RevioPMS charges and refunds folios;
RevioDirect takes a card guarantee. Both go through here.

## The safety property

`stripeKey()` accepts the `sk_test_` prefix and nothing else. A live key, a restricted live key, a
publishable key or a lookalike all fall back to the **mock** — so the worst outcome of a
misconfigured environment variable is a fake reference, never a real charge.

This is one line of code protecting the single most expensive mistake available in the platform, and
it is exactly the kind of line a well-meaning refactor deletes. `gateway.test.ts` pins it. Do not
relax it to "warn and continue" — going live is a deliberate decision with its own review, not
something that should be possible by pasting a key.

## What we store, and what we must not

A guarantee returns a **token** plus card brand and last4. That is enough to charge a no-show and
useless to anyone who steals the database, and it keeps the platform outside PCI scope. **A PAN, CVV
or expiry date must never reach our servers or our database.** RevioDirect's card fields are Stripe's
own iframe for this reason — which is why the page can say *your card details never reach us* as a
statement of fact.

**Since 2026-09-30 RevioDirect collects a real card — in Stripe's Payment Element**, an iframe served
by Stripe, so the number goes browser → Stripe and still never through us (`guest-payments.ts`). It is
charged on the **hotel's connected account** (`Stripe-Account` header), authorised first
(`capture_method=manual`), captured only after the reservation exists, and cancelled if the booking
fails — so a guest is never charged for a booking that did not happen.

**Test or live is a CHOICE (`stripe-mode.ts`, 2026-10-04).** `STRIPE_GUEST_MODE=live` on a service
makes guest payments, saved-card charges, refunds, payment links and Connect onboarding use a LIVE
key; without it only a `sk_test_`/`pk_test_` key is accepted. A key whose prefix disagrees with the
chosen mode is refused, in both directions — pasting a live key never starts charging cards, and a
test key left behind after going live never silently stops taking money. `stripe-mode.test.ts` pins it.

⚠️ `chargeCard`/`refundCard` in `gateway.ts` (RevioPMS terminal at the desk) do **not** send
`Stripe-Account` — live, they would charge OUR account for a hotel's guest. So `gateway.ts` keeps its
own `sk_test_`-only key and falls back to the mock in live mode (a desk card payment is then a record
of the terminal payment, which is what it is). Charging a card ON FILE from the folio goes through
`chargeSavedCard` here, on the hotel's account, and is correct live.

## Mock behaviour worth knowing

References are `mock_<kind><timestamp><random>`. The random suffix is not decoration: without it two
bookings confirmed in the same millisecond shared a reference, and the hotel would have charged the
wrong guest for a no-show. A guarantee's reference says `guarantee` in it so nobody scanning a folio
mistakes it for a payment.
