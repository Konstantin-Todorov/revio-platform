/**
 * @revio/payments — the one way any Revio product touches a card.
 *
 * Mock-first by default; a `sk_test_` key switches it to Stripe TEST MODE. A live key is refused by
 * construction (`stripeKey()` only accepts the test prefix), so no configuration mistake can move
 * real money.
 */
export * from "./gateway.js";
export * from "./connect.js";
