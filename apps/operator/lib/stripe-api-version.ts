/**
 * The one Stripe API version this integration speaks.
 *
 * ## Why it is a constant rather than a string in each call (§S8)
 *
 * Outbound calls pinned `2024-06-20` in two files while the live event destination was pinned to
 * `2026-08-26.dahlia`. The fields we read happen to be compatible today, which is exactly the
 * problem: nothing anywhere connected the two numbers, so the webhook payload could drift away from
 * the parser one Stripe release at a time and the first symptom would be a payment that stopped
 * settling.
 *
 * Pinning is still right — an unpinned integration changes shape on Stripe's schedule rather than
 * ours. What changes here is that there is now **one** number to move, and moving it is a decision
 * somebody makes rather than a difference nobody noticed.
 *
 * ⚠️ **Changing this means re-reading the event shapes.** `readCheckoutCompleted` and
 * `readRefundOrDispute` extract specific fields; a major version can move or rename them. The
 * sequence is: read Stripe's upgrade notes, change this constant, run
 * `pnpm --filter @revio/operator webhook-verify` against a scratch database, and re-check the event
 * destination in the Stripe dashboard so both sides say the same thing.
 */
export const STRIPE_API_VERSION = "2024-06-20";
