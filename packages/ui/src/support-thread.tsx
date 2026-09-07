import type { ReactNode } from "react";

/**
 * A support case read as a conversation, not as a log.
 *
 * ## Why it looks like a messenger
 *
 * It used to be a flat list of paragraphs behind a single grey rule, with the question that started
 * it rendered somewhere else entirely — so the first thing anyone said was not even in the thread.
 * Reported exactly right: *"now its linear and it is super hard to get track of it"*. Reading it
 * meant checking a name on every line to work out who was talking.
 *
 * Everybody already knows how to read WhatsApp, Messenger and Viber, and they all encode the same
 * three things the eye can take without reading: **side** says who spoke, **grouping** says it is
 * still them, and a **day divider** says time passed. None of that is decoration — it is the
 * difference between scanning a conversation and parsing one.
 *
 * ## Perspective, so both sides get the familiar shape
 *
 * "Mine on the right" is the convention, and it is relative to whoever is looking. The hotel sees
 * its own words on the right; we see ours there. One component with a `perspective` — not two
 * implementations, because two implementations of this exact case is the bug that was fixed the day
 * before: the operator's answered view had quietly lost half of what the waiting view showed.
 *
 * ## The opening message is message one
 *
 * The request's own text is the hotel's first message. It was rendered above the thread as a
 * separate paragraph, which is what made a two-reply exchange read as three unrelated blocks.
 *
 * Times are the stored UTC instants, formatted without a locale on purpose: this renders on the
 * server, and a locale-dependent string is a hydration mismatch waiting to happen.
 */

export interface ThreadMessage {
  id: string;
  /** "hotel" | "revio" */
  side: string;
  authorName: string;
  body: string;
  /** Only meaningful for our own messages: null means the email never left. */
  emailedAt?: Date | null;
  createdAt: Date;
}

const dayOf = (d: Date) => d.toISOString().slice(0, 10);
const timeOf = (d: Date) => d.toISOString().slice(11, 16);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dayLabel(d: Date, today: Date): string {
  if (dayOf(d) === dayOf(today)) return "Today";
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (dayOf(d) === dayOf(yesterday)) return "Yesterday";
  const [y, m, day] = dayOf(d).split("-").map(Number) as [number, number, number];
  const label = `${day} ${MONTHS[m - 1]}`;
  return y === today.getUTCFullYear() ? label : `${label} ${y}`;
}

export function SupportThread({
  opening,
  messages,
  perspective,
  now = new Date(),
}: {
  /** The request itself — the hotel's first message, wherever it is stored. */
  opening: { authorName: string; body: string; createdAt: Date };
  messages: ThreadMessage[];
  /** Whose side of the conversation is the reader on. */
  perspective: "hotel" | "revio";
  now?: Date;
}) {
  const all: ThreadMessage[] = [
    { id: "opening", side: "hotel", authorName: opening.authorName, body: opening.body, createdAt: opening.createdAt },
    ...messages,
  ];

  let lastDay = "";
  const rows: ReactNode[] = [];

  all.forEach((m, i) => {
    const mine = m.side === perspective;
    const prev = all[i - 1];
    // Grouped: same speaker, same day. The name is said once per run, as a messenger does.
    const grouped = prev !== undefined && prev.side === m.side && dayOf(prev.createdAt) === dayOf(m.createdAt);
    const day = dayOf(m.createdAt);

    if (day !== lastDay) {
      lastDay = day;
      rows.push(
        <li key={`day-${day}`} className="flex justify-center py-1.5">
          <span className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">
            {dayLabel(m.createdAt, now)}
          </span>
        </li>,
      );
    }

    rows.push(
      <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
        <div className={`flex max-w-[85%] flex-col sm:max-w-[75%] ${mine ? "items-end" : "items-start"}`}>
          {!grouped && (
            <span className="mb-0.5 px-1 text-[11px] font-semibold text-ink-500">
              {m.side === "revio" ? `${m.authorName} · Revio` : m.authorName}
            </span>
          )}
          <div
            className={`rounded-2xl px-3 py-2 ${
              mine
                ? "rounded-br-sm bg-brand-50 text-ink-900"
                : "rounded-bl-sm border border-surface-border bg-surface-muted text-ink-800"
            }`}
          >
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.body}</p>
            <span className="mt-0.5 block text-[10.5px] text-ink-400">{timeOf(m.createdAt)}</span>
          </div>
          {/* An undelivered reply is indistinguishable from being ignored, so it is said out loud
              rather than left to look sent. Only our own messages are ones we deliver. */}
          {m.side === "revio" && m.id !== "opening" && m.emailedAt === null && (
            <span className="mt-0.5 px-1 text-[10.5px] font-semibold text-danger-600">
              the email did not send
            </span>
          )}
        </div>
      </li>,
    );
  });

  return (
    <ol className="mt-2 flex flex-col rounded-lg bg-surface-page/70 px-2.5 py-2">{rows}</ol>
  );
}
