/**
 * When does anything actually reach a channel — and do you wait, or is it immediate?
 *
 * The founder asked exactly that on 2026-09-12, after a Booking.com reservation took longer to
 * appear than expected: *"it should be clear when these pushes and pulls happen, and whether you
 * have to wait or it is instant."* Nothing on any screen answered it, so the only way to find out
 * was to watch and guess — and somebody who does not know a booking arrives within five minutes
 * cannot tell "not yet" from "broken".
 *
 * The two directions genuinely behave differently, and that is the thing to say plainly:
 *
 * - **What you send is immediate.** Saving a price, a restriction or an availability change pushes
 *   to the connected channels in the same request (`syncRealChannels`). Nothing to wait for, no
 *   button to press.
 * - **What you receive is polled.** Bookings are collected on a timer, because the channel does not
 *   call us — `instrumentation.ts` ticks `/api/jobs/pull` every five minutes.
 *
 * So: pushes are instant, bookings arrive within five minutes. Slower than that is not the cadence,
 * it is a fault — which is what `overdue` is for.
 */

/** How often the scheduler collects bookings. Mirrors `FIVE_MINUTES` in `instrumentation.ts`. */
export const PULL_INTERVAL_MINUTES = 5;

export interface SyncCadence {
  /** "4 minutes ago" · "just now" · "never" */
  lastLabel: string;
  /** "in about 1 minute" · "any moment now" — null when nothing has ever been collected. */
  nextLabel: string | null;
  /**
   * The last successful collection is older than it should be, so the timer is not the explanation.
   *
   * ⚠️ Two intervals, not one: a tick landing a few seconds late is normal, and calling that broken
   * is how a status light gets ignored.
   */
  overdue: boolean;
  /** The plain sentence to put on the screen. */
  sentence: string;
}

function ago(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function syncCadence(args: {
  /** Last time this channel successfully collected bookings. */
  lastSyncAt: Date | null;
  now: Date;
  intervalMinutes?: number;
}): SyncCadence {
  const interval = args.intervalMinutes ?? PULL_INTERVAL_MINUTES;

  if (!args.lastSyncAt) {
    return {
      lastLabel: "never",
      nextLabel: null,
      overdue: false,
      sentence:
        `Bookings are collected automatically about every ${interval} minutes. ` +
        "This channel has not collected any yet.",
    };
  }

  const elapsedMs = args.now.getTime() - args.lastSyncAt.getTime();
  const dueInMs = interval * 60_000 - elapsedMs;
  const overdue = elapsedMs > interval * 2 * 60_000;
  const dueMins = Math.round(dueInMs / 60_000);

  const nextLabel = overdue
    ? "overdue"
    : dueInMs <= 30_000
      ? "any moment now"
      : `in about ${Math.max(1, dueMins)} minute${Math.max(1, dueMins) === 1 ? "" : "s"}`;

  return {
    lastLabel: ago(elapsedMs),
    nextLabel,
    overdue,
    sentence: overdue
      ? `Bookings should arrive within ${interval} minutes and the last collection was ${ago(elapsedMs)}. ` +
        "That is longer than it should be — check this channel's connection."
      : `Bookings arrive on their own, within about ${interval} minutes. ` +
        `Last collected ${ago(elapsedMs)}, next ${nextLabel}. ` +
        "Prices, availability and restrictions are sent the moment you save them.",
  };
}
