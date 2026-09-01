/**
 * Where Channex lives. ONE definition, for everything that talks to it or checks on it.
 *
 * ⚠️ This exists because there were two. The operator console's key-health check hardcoded its own
 * copy and invented `secure.channex.io` — not a Channex host at all. Every request it made returned
 * 401, so the one function whose entire job is answering *"does this key work"* reported a perfectly
 * good production key as revoked, and an afternoon of diagnosis followed the wrong thread.
 *
 * `factory.ts` already carried the warning that a wrong host "fails at the worst possible moment:
 * the first real hotel's first real push". A second copy of a host is that same bug waiting.
 *
 * Pure data, so it lives in core: no fetch, no keys, nothing environment-specific.
 */

/** Production. Note it is `app.`, not `secure.` — the latter is not Channex. */
export const CHANNEX_PROD_URL = "https://app.channex.io/api/v1";
export const CHANNEX_SANDBOX_URL = "https://staging.channex.io/api/v1";

/**
 * Resolve a mode to its host. **Null for anything unrecognised** — a guessed host is how this went
 * wrong, so an unknown mode must fail loudly rather than default to production.
 */
export function channexBaseUrl(mode: string): string | null {
  if (mode === "channex_prod") return CHANNEX_PROD_URL;
  if (mode === "channex_sandbox") return CHANNEX_SANDBOX_URL;
  return null;
}
