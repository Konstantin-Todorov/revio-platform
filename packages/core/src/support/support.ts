/**
 * Getting help — what a hotel can ask, and what we promise back.
 *
 * ## Why this is worth building before the first live hotel and not after
 *
 * `docs/ACTION-REQUIRED.md` has carried "support and incident basics — undefined" as an open item,
 * with the question stated plainly: **who does a hotel call at 23:00 when check-in fails?** While
 * nobody is live that is theoretical. The week somebody is, it is the most important thing in the
 * product, and it is the one thing that cannot be built in a hurry — a support route improvised
 * during an incident is a support route that loses the incident.
 *
 * ## The thing a generic contact form cannot do
 *
 * We know who is asking. A request arrives already carrying the hotel, the product, the screen they
 * were on, the person and their role — so triage starts from *"Hotel Sofia · RevioPMS ·
 * /housekeeping · Maria, manager"* rather than from *"it doesn't work"*. That context is captured
 * automatically and is never a field somebody has to fill in, because the person typing it is having
 * a bad morning.
 *
 * ## The promise is honest or it is worse than nothing
 *
 * A response time nobody can keep costs more trust than no promise at all. These windows are
 * deliberately modest and stated in the hotel's own terms; **change them here** if the answer
 * changes, because the same constants are shown to the hotel and used to decide what is overdue.
 * There is no pretend 24/7.
 */

export type SupportKind = "urgent" | "problem" | "question";

export interface SupportKindInfo {
  key: SupportKind;
  /** What the hotel picks, in their words. */
  label: string;
  /** The distinguishing question, so the choice is obvious without reading all three. */
  hint: string;
  /** What we promise, shown before they send. */
  promise: string;
  /** Hours after which an unanswered request is overdue, for the operator's queue. */
  targetHours: number;
}

/**
 * Ordered most urgent first — a person whose guests are affected should not read past their answer.
 *
 * ⚠️ `targetHours` and `promise` must agree. They are two renderings of one commitment: the hotel
 * reads the sentence and the console counts the hours, and if they drift the console will call a
 * request on time that the hotel was told was late.
 */
export const SUPPORT_KINDS: readonly SupportKindInfo[] = [
  {
    key: "urgent",
    label: "Guests are affected right now",
    hint: "Check-in is blocked, the booking page is down, a room was sold twice.",
    promise: "We aim to reply within 2 hours, 08:00–22:00 EET.",
    targetHours: 2,
  },
  {
    key: "problem",
    label: "Something is wrong, but we can work around it",
    hint: "A screen is failing, a number looks incorrect, a channel is not updating.",
    promise: "We aim to reply within one working day.",
    targetHours: 24,
  },
  {
    key: "question",
    label: "A question about how something works",
    hint: "How do I set this up, what does this figure mean, can it do X.",
    promise: "We aim to reply within two working days.",
    targetHours: 48,
  },
];

export const SUPPORT_KIND_BY_KEY: Record<SupportKind, SupportKindInfo> = Object.fromEntries(
  SUPPORT_KINDS.map((k) => [k.key, k]),
) as Record<SupportKind, SupportKindInfo>;

/** Unknown kinds fall to the middle, never to `urgent`: a mis-typed value must not page anyone. */
export function supportKind(value: string | null | undefined): SupportKindInfo {
  return SUPPORT_KIND_BY_KEY[(value ?? "") as SupportKind] ?? SUPPORT_KIND_BY_KEY.problem;
}

/**
 * Short, sayable over the phone. Derived from the id, so it needs no column and no sequence —
 * the same trick `bookingReference` uses.
 */
export function supportReference(id: string): string {
  return `SR-${id.slice(-6).toUpperCase()}`;
}

export type SupportRefusal = "no-message" | "too-short" | "too-long";

/**
 * Is this worth sending? `null` means yes.
 *
 * The floor is low on purpose. "Booking page 500s on save" is nine words and is a perfectly good
 * report; demanding a paragraph from somebody mid-incident is how you get no report at all. The
 * ceiling exists only to stop a paste of an entire log filling an email nobody can read — and it
 * says so, rather than silently truncating what they wrote.
 */
export const SUPPORT_MESSAGE_MIN = 10;
export const SUPPORT_MESSAGE_MAX = 4000;

export function validateSupportMessage(message: string): SupportRefusal | null {
  const trimmed = message.trim();
  if (trimmed.length === 0) return "no-message";
  if (trimmed.length < SUPPORT_MESSAGE_MIN) return "too-short";
  if (trimmed.length > SUPPORT_MESSAGE_MAX) return "too-long";
  return null;
}

export function supportRefusalMessage(refusal: SupportRefusal): string {
  switch (refusal) {
    case "no-message":
      return "Tell us what is happening and we will look at it.";
    case "too-short":
      return "A few more words would help — what were you doing when it went wrong?";
    case "too-long":
      return `That is longer than ${SUPPORT_MESSAGE_MAX.toLocaleString("en-GB")} characters. Send the short version and attach the rest in a reply.`;
  }
}

/** Enough of a request to say how long they have been waiting. `messages` may be absent. */
export interface SupportTiming {
  kind: string;
  createdAt: Date;
  handledAt: Date | null;
  messages?: readonly { side: string; createdAt: Date }[];
}

/**
 * When the ball last came to us — the moment the clock we promised against started running.
 *
 * Not `createdAt`, once a thread exists. A hotel that replies to an answer reopens the case, and
 * measuring from the original question would report a reply received a minute ago as three weeks
 * late. The queue would sort by the age of the subject instead of by who has been kept waiting, and
 * every reopened case would out-shout a genuinely urgent new one.
 *
 * So: the newest message from the hotel, and the request's own creation when there is none. Our own
 * replies never move it — answering does not restart our own clock, it stops it.
 */
export function waitingSince(request: SupportTiming): Date {
  let latest = request.createdAt;
  for (const m of request.messages ?? []) {
    if (m.side === "hotel" && m.createdAt.getTime() > latest.getTime()) latest = m.createdAt;
  }
  return latest;
}

/**
 * Is an unanswered request past what we promised?
 *
 * Used by the operator's queue to sort by *how late*, not by how loudly it was reported. A question
 * asked three days ago is overdue; an urgent raised ten minutes ago is not, however it feels.
 *
 * Measured from `waitingSince`, so a reopened case is judged on the reply we have not answered
 * rather than on the age of the conversation.
 */
export function isOverdue(request: SupportTiming, now: Date): boolean {
  if (request.handledAt) return false;
  const target = supportKind(request.kind).targetHours * 3_600_000;
  return now.getTime() - waitingSince(request).getTime() > target;
}

/** How late, in hours, or 0 when it is not. For ordering the queue. */
export function hoursOverdue(request: SupportTiming, now: Date): number {
  if (!isOverdue(request, now)) return 0;
  const target = supportKind(request.kind).targetHours * 3_600_000;
  return (now.getTime() - waitingSince(request).getTime() - target) / 3_600_000;
}

/**
 * How a question reached us.
 *
 * The queue began by recording only the in-app form, which meant it only knew about the half of a
 * hotel that types. Somebody who telephones asks the same questions — often the more urgent ones,
 * because they picked up the phone — and those left no trace at all. Help written from that queue
 * would have been written for the wrong audience.
 *
 * `app` is the guest of honour and the rest are logged by an operator after the fact, which is why
 * they are labelled from OUR side ("Logged from a call") rather than the hotel's.
 */
export type SupportSource = "app" | "phone" | "email" | "meeting";

export const SUPPORT_SOURCES: { key: SupportSource; label: string }[] = [
  { key: "app", label: "Asked in the app" },
  { key: "phone", label: "Logged from a call" },
  { key: "email", label: "Logged from an email" },
  { key: "meeting", label: "Logged from a conversation" },
];

export function supportSourceLabel(value: string | null | undefined): string {
  return SUPPORT_SOURCES.find((s) => s.key === value)?.label ?? "Asked in the app";
}
