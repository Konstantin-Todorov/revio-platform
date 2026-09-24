import type { ReactNode } from "react";
import { LOCALE_LABELS, translate, type Locale } from "./i18n";
import { helpStrings } from "./help-strings";

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

/**
 * The day and the time in the zone the reader is in. Formatting with `toISOString` printed UTC — a
 * reply sent at 10:15 in Sofia read "07:15", and one sent after 21:00 appeared under the next day.
 */
function clock(timeZone: string, locale: Locale) {
  const intl = LOCALE_LABELS[locale].intl;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const time = new Intl.DateTimeFormat(intl, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const label = new Intl.DateTimeFormat(intl, { timeZone, day: "numeric", month: "short" });
  const labelYear = new Intl.DateTimeFormat(intl, { timeZone, day: "numeric", month: "short", year: "numeric" });
  return {
    dayOf: (d: Date) => day.format(d),
    timeOf: (d: Date) => time.format(d),
    dayLabel(d: Date, today: Date, t: { today: string; yesterday: string }): string {
      if (day.format(d) === day.format(today)) return t.today;
      if (day.format(d) === day.format(new Date(today.getTime() - 86_400_000))) return t.yesterday;
      return day.format(d).slice(0, 4) === day.format(today).slice(0, 4) ? label.format(d) : labelYear.format(d);
    },
  };
}

export function SupportThread({
  opening,
  messages,
  perspective,
  now = new Date(),
  locale = "en",
  timeZone = "Europe/Sofia",
}: {
  /** The request itself — the hotel's first message, wherever it is stored. */
  opening: { authorName: string; body: string; createdAt: Date };
  messages: ThreadMessage[];
  /** Whose side of the conversation is the reader on. */
  perspective: "hotel" | "revio";
  now?: Date;
  locale?: Locale;
  /** The reader's zone: the property's for a hotel, Sofia for us. */
  timeZone?: string;
}) {
  const t = translate(helpStrings, locale).thread;
  const { dayOf, timeOf, dayLabel } = clock(timeZone, locale);
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
            {dayLabel(m.createdAt, now, t)}
          </span>
        </li>,
      );
    }

    rows.push(
      <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
        <div className={`flex max-w-[85%] flex-col sm:max-w-[75%] ${mine ? "items-end" : "items-start"}`}>
          {!grouped && (
            <span className="mb-0.5 px-1 text-[11px] font-semibold text-ink-500">
              {m.side === "revio" ? `${m.authorName} · ${t.revio}` : m.authorName}
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
              {t.notSent}
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
