/**
 * The notification centre: what HAPPENED, and whether this person has seen it.
 *
 * ## ⚠️ An event is not an attention state, and merging them breaks both
 *
 * Every product already has a bell, and what it shows is **derived state**: "3 rooms to clean",
 * "2 sync failures", "Close Day is due". Those are computed fresh on every render and they are
 * self-healing — clean the room and the line disappears, with nothing to dismiss and nothing to
 * remember. That is exactly right for "what is wrong right now" and it is kept.
 *
 * A notification centre answers a different question: **what happened while I was away, and have I
 * seen it.** A booking arrived at 14:02. A channel disconnected. An invoice was paid. Those have a
 * time, they are true forever, and they need read/unread and a history.
 *
 * Putting an unread badge on a derived state fails in both directions and there is no third option:
 * either "3 rooms to clean" stays unread until somebody cleans them — a badge that ignores being
 * read — or marking it read hides a problem that is still happening. So the two live side by side
 * in one panel, and **only events carry the unread count**.
 *
 * ## Why the feed is derived rather than written
 *
 * Nothing writes a `Notification` row. The events are read out of what the platform already
 * records — `SyncEvent`, `ErrorItem`, a reservation's `importedAt`, an invoice's `issuedAt` — and
 * the only thing stored is **who has read what**.
 *
 * That is not a shortcut, it is the safer half of the trade. A written feed is a second copy of the
 * truth, and a second copy drifts: a booking cancelled after its notification was written leaves a
 * cheerful "new booking" sitting in the panel, and the notification and the screen it links to then
 * disagree. Deriving it means the panel cannot say something the system does not still hold, and it
 * means history exists from the day this ships rather than from the day it was switched on. What it
 * costs is that we cannot notify about something nothing records — and if that ever comes up, the
 * answer is to record it, which is worth doing anyway.
 */

export type NotificationSeverity = "critical" | "warning" | "info" | "success";

/** A thing that happened, at a time, in one product. */
export interface NotificationEvent {
  /**
   * ⚠️ Stable across reloads, because a read mark is keyed on it.
   *
   * `"<source>:<row id>"` — `"reservation:abc123"`, `"sync:def456"`. Derived from the row it came
   * from rather than from its position or its text, so re-ordering the feed or rewording a title
   * never resurrects something somebody has already read.
   */
  key: string;
  title: string;
  /** One line of detail. Optional — a title that needs a paragraph is a badly written title. */
  body?: string;
  /** The screen that answers it. Also what decides who may SEE it — see `visibleEvents`. */
  href: string;
  severity: NotificationSeverity;
  at: Date;
  /** Which property, when the account holds more than one. */
  context?: string;
}

/**
 * What this person has read.
 *
 * Two mechanisms, because one cannot do both jobs cheaply. `clearedAt` is "mark all as read" and is
 * a single timestamp, so clearing a thousand notifications is one write rather than a thousand
 * rows. `readKeys` holds the individual ones read since. Everything is per person: two receptionists
 * sharing a hotel have their own unread counts, which is the entire point of a notification centre
 * over a shared attention list.
 */
export interface ReadState {
  clearedAt: Date | null;
  readKeys: ReadonlySet<string>;
}

export const EMPTY_READ_STATE: ReadState = { clearedAt: null, readKeys: new Set() };

/**
 * Has this person read this event?
 *
 * ⚠️ `<=` on the cleared instant, not `<`. "Mark all as read" means every event visible at that
 * moment, and the newest of them was created at exactly that instant often enough to matter — it is
 * how the one notification somebody actually wanted to clear stays stubbornly unread.
 */
export function isRead(event: NotificationEvent, state: ReadState): boolean {
  if (state.readKeys.has(event.key)) return true;
  return state.clearedAt !== null && event.at.getTime() <= state.clearedAt.getTime();
}

export function unreadCount(events: readonly NotificationEvent[], state: ReadState): number {
  return events.reduce((n, e) => (isRead(e, state) ? n : n + 1), 0);
}

/**
 * Newest first, capped.
 *
 * ⚠️ The tie-break is the key, not the source order. Several events routinely share a timestamp —
 * a nightly job writes a run of rows inside the same second — and without a deterministic
 * tie-break the panel silently reshuffles between two polls, which reads as new activity when
 * nothing has happened.
 */
export function rankEvents(events: readonly NotificationEvent[], limit = 50): NotificationEvent[] {
  return [...events]
    .sort((a, b) => b.at.getTime() - a.at.getTime() || a.key.localeCompare(b.key))
    .slice(0, limit);
}

/**
 * Only what this person may open.
 *
 * The same rule the ⌘K palette uses, and for the same reason: a notification line is itself data —
 * "Marcus Reyes checked out with €140 outstanding" tells a housekeeper the guest's name and the
 * hotel's money before she has clicked anything. `allows` is the product's own screen rule, so the
 * panel cannot offer a screen the menu does not contain.
 */
export function visibleEvents(
  events: readonly NotificationEvent[],
  allows: (href: string) => boolean,
): NotificationEvent[] {
  return events.filter((e) => allows(e.href));
}

export interface EventDay<T extends NotificationEvent = NotificationEvent> {
  /** "Today", "Yesterday", or the calendar date — resolved at the property's timezone. */
  label: string;
  /** `YYYY-MM-DD`, so the caller can key a list on something stable. */
  day: string;
  events: T[];
}

/**
 * Split the feed into day headings.
 *
 * ⚠️ The day is the **property's** calendar day, never the server's UTC one. A booking that arrives
 * at 01:30 in Sofia is today's booking; UTC calls it yesterday's until 03:00, which is precisely the
 * night auditor's shift and precisely when somebody is reading this panel to find out what happened
 * overnight. This is the platform's one rule about dates applied to a feed.
 */
export function groupByDay<T extends NotificationEvent>(
  /* Generic so it keeps whatever the caller added. The panel groups events that already carry
     `read`, and a signature fixed to `NotificationEvent` quietly widened them back on the way out —
     every row then rendered as read. */
  events: readonly T[],
  timeZone: string,
  now: Date = new Date(),
): EventDay<T>[] {
  const dayOf = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
  const today = dayOf(now);
  const yesterday = dayOf(new Date(now.getTime() - 86_400_000));

  const out: EventDay<T>[] = [];
  for (const e of events) {
    const day = dayOf(e.at);
    const last = out[out.length - 1];
    if (last && last.day === day) last.events.push(e);
    else out.push({ day, label: day === today ? "Today" : day === yesterday ? "Yesterday" : day, events: [e] });
  }
  return out;
}

/**
 * "2 min ago". For the panel, where an exact timestamp is noise.
 *
 * Stops at a week and hands back the date, because "23 days ago" is a number somebody has to do
 * arithmetic on to get the thing they actually wanted, which was the date.
 */
export function relativeTime(at: Date, timeZone: string, now: Date = new Date()): string {
  const secs = Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days} d ago`;
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(at);
}

/**
 * A derived attention state — what is wrong at the hotel RIGHT NOW.
 *
 * Kept exactly as the four bells already compute it. It has no `at` and no read mark on purpose:
 * "3 rooms to clean" is not something that happened, it is something that is true, and it stops
 * being true when somebody cleans the rooms rather than when somebody reads about it.
 */
export interface AttentionItem {
  text: string;
  href: string;
  tone: "danger" | "warning" | "info" | "success";
}

/** Everything one render of the panel needs, and the exact shape a poll returns. */
export interface NotificationFeed {
  /** What is wrong now. Never counted in `unread`. */
  attention: AttentionItem[];
  /** What happened, newest first, already scoped to what this person may open. */
  events: (NotificationEvent & { read: boolean })[];
  /** Unread EVENTS only — see the note at the top of this file for why states are excluded. */
  unread: number;
}

/**
 * Assemble one render of the panel from raw events and this person's read state.
 *
 * The order is load-bearing: scope first, then rank, then cap, then mark read. Marking before
 * capping would count an unread item that the panel never shows, and a badge that says 3 over a
 * list of 2 is the kind of small wrongness that makes somebody stop trusting the number.
 */
export function buildFeed(
  raw: readonly NotificationEvent[],
  attention: AttentionItem[],
  state: ReadState,
  allows: (href: string) => boolean,
  limit = 50,
): NotificationFeed {
  const events = rankEvents(visibleEvents(raw, allows), limit)
    .map((e) => ({ ...e, read: isRead(e, state) }));
  /* ⚠️ The attention list is scoped by the SAME rule. It is easy to forget because it looks like
     chrome rather than data, and it is not: RevioPMS's own attention list carries "2 folios
     unsettled", which tells a housekeeper what the hotel is owed. The line is the leak, exactly as
     it is for an event. */
  return {
    attention: attention.filter((a) => allows(a.href)),
    events,
    unread: events.reduce((n, e) => (e.read ? n : n + 1), 0),
  };
}

/**
 * What "mark all as read" should actually store.
 *
 * ⚠️ **Not simply `now`.** An event stamped even slightly ahead of the server clock is, by
 * `isRead`, newer than the moment you cleared — so it stays unread, the badge never goes to zero,
 * and pressing the button again does nothing. The person's conclusion is that the button is broken,
 * and they are right.
 *
 * Clock skew between the database and the application makes this reachable in production: the rows
 * are timestamped by one machine and compared against another. It was found here by a test row that
 * landed an hour in the future, which is a smaller version of the same thing.
 *
 * So the marker is the later of "now" and "the newest thing this person can currently see", which is
 * also the more honest statement of what they just did: they read everything in front of them.
 */
export function clearedAtFor(events: readonly NotificationEvent[], now: Date = new Date()): Date {
  let latest = now.getTime();
  for (const e of events) latest = Math.max(latest, e.at.getTime());
  return new Date(latest);
}
