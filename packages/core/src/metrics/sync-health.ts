/**
 * Is this channel actually working? — derived from what happened, never from what is configured.
 *
 * ## The bug this exists to stop
 *
 * Three screens shipped a green pill over a dead channel:
 *
 *  - `Last Successful Sync: 29d ago`, badge **Live**, green — because the pill asked *"has it ever
 *    synced?"* rather than *"has it synced recently?"*
 *  - `0 Failed Syncs · Clear`, green — on a property where **nothing was attempted**. Technically
 *    true, practically a lie.
 *  - `100% sync success` beside 25 open errors.
 *
 * All three are the same mistake, and it is the same one that produced 411 consecutive
 * "Pulled 0 revisions · success" events against a real hotel whose key had been revoked: **a zero
 * from success and a zero from silence rendered identically.**
 *
 * So the rule this module encodes, and the reason it is one shared function rather than three
 * screens agreeing by luck:
 *
 * > **Connection state is not delivery health.** A socket that is open tells you nothing about
 * > whether anything arrived. Only recency does.
 */

/**
 * Deliberately five states, not three. `idle` and `unknown` are the ones screens keep collapsing
 * into `healthy`, and they are the whole point:
 *
 *  - `healthy` — it worked, recently.
 *  - `stale` — it worked, but not lately. Might be fine; might be dying.
 *  - `dead` — it has not worked in long enough that something is wrong.
 *  - `idle` — nothing has ever run. Not a fault, and **not health either**.
 *  - `unknown` — nothing was attempted in the window, so there is nothing to report.
 */
export type SyncHealth = "healthy" | "stale" | "dead" | "idle" | "unknown";

/** Green ≤ 24h · amber 1–7d · red > 7d. Tunable; the shape is what matters. */
export const SYNC_FRESH_MS = 24 * 60 * 60 * 1000;
export const SYNC_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export interface HealthVerdict {
  health: SyncHealth;
  /** What to say. Never "Live" for something that last worked a month ago. */
  label: string;
  /** A sentence, or null when the label says enough. */
  detail: string | null;
}

/**
 * Health of a channel or property from the last time a sync SUCCEEDED.
 *
 * `lastSuccessAt` must be the last *success*, not the last attempt — a channel failing every five
 * minutes has a very recent attempt and is entirely broken.
 */
export function syncRecencyHealth(lastSuccessAt: Date | null, now: Date): HealthVerdict {
  if (lastSuccessAt == null) {
    return { health: "idle", label: "Never synced", detail: "No sync has run yet." };
  }
  const age = now.getTime() - lastSuccessAt.getTime();
  // A future timestamp is a clock problem, not freshness. Treated as fresh rather than as an error:
  // a skewed clock should not paint a working channel red.
  if (age <= SYNC_FRESH_MS) {
    return { health: "healthy", label: "Live", detail: null };
  }
  if (age <= SYNC_STALE_MS) {
    return { health: "stale", label: "Stale", detail: "Hasn't synced in over a day." };
  }
  return { health: "dead", label: "Not syncing", detail: "Nothing has synced in over a week." };
}

/**
 * The subtitle under a pending count — **derived from the count**, always.
 *
 * The shipped version rendered "Queue empty — all delivered" beneath the number **10**, because the
 * subtitle was static copy written for the empty state and never wired to the value. A card that
 * contradicts itself in two lines teaches people to stop reading it.
 *
 * The age matters as much as the count: ten updates queued for thirty seconds is normal, ten queued
 * for two days is an incident, and the number alone cannot tell them apart.
 */
export function pendingSubtitle(count: number, oldestAt: Date | null, now: Date): string {
  if (count <= 0) return "Queue empty — all delivered.";
  const plural = count === 1 ? "update" : "updates";
  if (oldestAt == null) return `${count} ${plural} waiting to be delivered.`;
  return `${count} ${plural} waiting — oldest ${describeAge(now.getTime() - oldestAt.getTime())}.`;
}

/**
 * A zero that might mean silence.
 *
 * `0 failures` is only good news if something was tried. With no attempts the honest answer is that
 * we do not know, and it must not render in the same green as a clean run.
 */
export function failureVerdict(attempts: number, failures: number): HealthVerdict {
  if (attempts <= 0) {
    return {
      health: "unknown",
      label: "Nothing attempted",
      detail: "No syncs were attempted in the last 24 hours.",
    };
  }
  if (failures > 0) {
    return {
      health: "dead",
      label: "Review",
      detail: `${failures} of ${attempts} failed in the last 24 hours.`,
    };
  }
  return { health: "healthy", label: "Clear", detail: `${attempts} succeeded in the last 24 hours.` };
}

/**
 * A success percentage that refuses to say 100% while anything is unresolved.
 *
 * The console reported `100%` beside 25 open errors. Both numbers were correct and the pair was
 * nonsense: the percentage counted *attempts in a window* while the errors counted *unresolved
 * items of any age*. Returning null when nothing was attempted is the other half — a rate over zero
 * attempts is not 100%, it is undefined, and rendering it as 100% is how silence became green.
 */
export function successRate(attempts: number, failures: number, openErrors: number): {
  pct: number | null;
  qualified: boolean;
  detail: string | null;
} {
  if (attempts <= 0) {
    return { pct: null, qualified: false, detail: "Nothing was attempted in this window." };
  }
  const pct = Math.round(((attempts - Math.min(failures, attempts)) / attempts) * 100);
  if (pct === 100 && openErrors > 0) {
    return {
      pct,
      qualified: true,
      detail: `Every attempt in this window succeeded, but ${openErrors} error${openErrors === 1 ? " is" : "s are"} still open from earlier.`,
    };
  }
  return { pct, qualified: false, detail: null };
}

/**
 * `Pushed -56/56 updates` — a negative numerator, from `sent - rejected` where rejected exceeded
 * sent. Whatever the arithmetic, a count of things that happened cannot be below zero or above the
 * total, and printing one destroys confidence in every other number on the screen.
 */
export function pushedOf(total: number, rejected: number): { sent: number; total: number; text: string } {
  const safeTotal = Math.max(0, total);
  const sent = Math.min(Math.max(0, safeTotal - Math.max(0, rejected)), safeTotal);
  return { sent, total: safeTotal, text: `${sent}/${safeTotal}` };
}

/** "3h", "2 days", "45 min" — short enough for a card subtitle. */
export function describeAge(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}
