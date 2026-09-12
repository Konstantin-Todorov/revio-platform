/**
 * A no-op stand-in for Next's `server-only` marker, for the test runner.
 *
 * `server-only` throws at import time outside a React Server Component build — that is its whole job:
 * it makes accidentally shipping a server module to the browser a build error rather than a leak.
 * Vitest is neither, so importing a module that carries the marker fails to resolve and the file
 * cannot be tested at all.
 *
 * ⚠️ This weakens nothing. The real package is still what the apps build against, so the guarantee
 * it provides in production is untouched; this only exists inside `vitest.config.ts`. Without it,
 * every server module in RevioCRS — which is most of `lib/` — is permanently untestable, and "it
 * imports server-only" is a poor reason for the formula sheet behind every reported number to have
 * no coverage.
 */
export {};
