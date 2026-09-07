/**
 * "The app changed underneath this tab" — told apart from "the app is broken".
 *
 * Every deploy replaces the client bundle and mints new server-action ids. A browser that loaded a
 * page *before* the deploy and submits a form *after* it sends an action id the new server has never
 * heard of, and Next.js throws **"Failed to find Server Action. This request might be from an older
 * or newer deployment."** The same staleness produces chunk-load failures when the tab lazily
 * fetches a script the new build no longer serves.
 *
 * This is not a fault and it is not "temporarily unavailable". The app is fine; *this tab* is out of
 * date, and a hard reload fixes it completely. Telling the user the product is down instead is worse
 * than useless — it is a false statement about our reliability, made at the moment they were trying
 * to sign in.
 *
 * Found on production 2026-09-07: three of these, two of them on `/login`. A manager typed a
 * password, pressed the button, and was shown "RevioCRS is temporarily unavailable" with a Reload
 * button that could not have worked — `reset()` re-renders the same stale bundle.
 *
 * Matching on the MESSAGE rather than an error class because Next.js throws a plain `Error` here and
 * the browser variants are all different classes. Deliberately narrow: a predicate that reloads the
 * page on the wrong error hides real bugs behind a refresh.
 */

const STALE_PATTERNS: readonly RegExp[] = [
  // Next.js: the action id is not in this deployment's manifest.
  /failed to find server action/i,
  /from an older or newer deployment/i,
  // The bundle this tab is running references chunks the new build no longer serves.
  /loading chunk \S+ failed/i,
  /failed to fetch dynamically imported module/i,
  // Safari's wording for the same thing.
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
];

export function isStaleDeploymentError(error: unknown): boolean {
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message ?? "")
        : "";
  if (!message) return false;
  return STALE_PATTERNS.some((p) => p.test(message));
}

/**
 * May we reload the page automatically right now?
 *
 * A hard reload is the whole fix, so doing it without asking is the kindest behaviour — but a reload
 * that runs every time the boundary mounts is an infinite loop, and an app that reloads forever is
 * far worse than one that shows a button.
 *
 * So it is time-bounded rather than once-only: a second stale error a week later should still heal
 * itself. `lastReloadAt` is whatever the caller persisted across the reload (sessionStorage), and
 * `null` means "we have never done this" or "we could not remember" — see the caller for why the
 * unreadable case must NOT auto-reload.
 */
export const STALE_RELOAD_COOLDOWN_MS = 30_000;

export function shouldAutoReload(lastReloadAt: number | null, now: number): boolean {
  if (lastReloadAt == null) return true;
  if (!Number.isFinite(lastReloadAt)) return false;
  return now - lastReloadAt > STALE_RELOAD_COOLDOWN_MS;
}
