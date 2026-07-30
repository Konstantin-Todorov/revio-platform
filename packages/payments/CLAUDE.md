# Package: Payments (`@revio/payments`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. Founder decision, standing:
> **payments are mocked; Stripe TEST mode only; never live.** (`docs/specs/PMS-GUIDE-V1.md` §4.5, F2.)

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
or expiry date must never reach our servers or our database.** RevioDirect's checkout has no card
fields at all for this reason — which is why the page can say *your card details never reach us* as a
statement of fact.

Collecting a real card would need Stripe Elements (the number goes browser → Stripe, never through
us) plus a live-mode decision. Both are deliberately unbuilt.

## Mock behaviour worth knowing

References are `mock_<kind><timestamp><random>`. The random suffix is not decoration: without it two
bookings confirmed in the same millisecond shared a reference, and the hotel would have charged the
wrong guest for a no-show. A guarantee's reference says `guarantee` in it so nobody scanning a folio
mistakes it for a payment.
