import { supportKind, supportReference, type SupportKind } from "@revio/core";
import { fill, LOCALE_LABELS, translate, type Locale } from "./i18n";
import { helpStrings } from "./help-strings";
import { shellStrings } from "./shell-strings";
import { SupportReply, type SupportReplyResult } from "./support-reply.js";
import { SupportThread } from "./support-thread.js";

/**
 * A hotel's own support history, in their own product — shaped like a messenger's inbox.
 *
 * ## Why a list and a conversation, not everything open
 *
 * It was every request stacked with its whole thread and a reply box under each. Two requests in, a
 * reader could not tell which answer belonged to which question — the founder's words were *"super
 * confusing which is what and on what topic"*. Every messenger solves this the same way, so this
 * borrows it: **one line per request** (reference, what it was about, whose turn it is, when it last
 * moved) and the conversation of the one you pick beside it. Below `xl` the list and the conversation
 * are two screens with a way back — beside the app's sidebar and Help's own nav, a third column
 * narrower than that squeezed the chat to a few words a line.
 *
 * The selection lives in the URL (`/help/requests/<id>`), so a request can be linked to from an
 * email, and the back button does what people expect.
 *
 * Rendered on the server: these are rows the database already restricts to their tenant.
 */

export interface MyRequestRow {
  id: string;
  kind: string;
  message: string;
  /** Who asked, copied onto the request when it was made — often a colleague, not the reader. */
  contactName: string;
  source: string;
  createdAt: Date;
  handledAt: Date | null;
  messages: { id: string; side: string; authorName: string; body: string; createdAt: Date }[];
}

/** Whose turn it is, derived rather than stored — a status column and a thread can disagree. */
function awaitingUs(r: MyRequestRow): boolean {
  const last = r.messages[r.messages.length - 1];
  return !last || last.side === "hotel";
}

function lastMoved(r: MyRequestRow): Date {
  return r.messages[r.messages.length - 1]?.createdAt ?? r.createdAt;
}

/** Newest movement first: a request we have just answered belongs at the top, however old it is. */
export function orderRequests(rows: MyRequestRow[]): MyRequestRow[] {
  return [...rows].sort((a, b) => lastMoved(b).getTime() - lastMoved(a).getTime());
}

export function RequestsView({
  requests,
  selectedId,
  basePath = "/help/requests",
  replyAction,
  locale = "en",
  timeZone = "Europe/Sofia",
}: {
  requests: MyRequestRow[];
  /** The open conversation, from the URL. Absent ⇒ the list alone (and a prompt on wide screens). */
  selectedId?: string;
  basePath?: string;
  /**
   * Supplied by the app, because the perimeter belongs to the app. Optional so a surface that only
   * shows the history gets a conversation with no input rather than a broken form.
   */
  replyAction?: (prev: SupportReplyResult, fd: FormData) => Promise<SupportReplyResult>;
  locale?: Locale;
  /** The property's zone, so "10:15" is the hotel's 10:15. */
  timeZone?: string;
}) {
  const t = translate(helpStrings, locale).requests;
  const getHelp = translate(shellStrings, locale).help.trigger;

  if (requests.length === 0) {
    return (
      <section className="rounded-lg border border-surface-border bg-white p-5">
        <h2 className="text-[14px] font-semibold text-ink-900">{t.emptyTitle}</h2>
        <p className="mt-1 max-w-[68ch] text-[13px] leading-relaxed text-ink-600">
          {t.emptyBefore} <strong>{getHelp}</strong> {t.emptyAfter}
        </p>
      </section>
    );
  }

  const ordered = orderRequests(requests);
  const selected = selectedId ? ordered.find((r) => r.id === selectedId) : undefined;
  const date = new Intl.DateTimeFormat(LOCALE_LABELS[locale].intl, { timeZone, day: "numeric", month: "short" });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(260px,320px)_1fr]">
      {/* The list. On a phone it gives way to the conversation once one is chosen. */}
      <nav
        aria-label={t.title}
        className={`overflow-hidden rounded-lg border border-surface-border bg-white ${selectedId ? "hidden xl:block" : ""}`}
      >
        <ul className="divide-y divide-surface-border">
          {ordered.map((r) => {
            const k = supportKind(r.kind);
            const kindLabel = translate(shellStrings, locale).help.kinds[k.key as SupportKind]?.label ?? k.label;
            const ours = awaitingUs(r);
            const active = r.id === selectedId;
            return (
              <li key={r.id}>
                <a
                  href={`${basePath}/${r.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`block px-3.5 py-3 transition-colors ${active ? "bg-brand-50" : "hover:bg-surface-muted"}`}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="tnum text-[12px] font-semibold text-ink-900">{supportReference(r.id)}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        ours ? "bg-warning-50 text-warning-600" : "bg-success-50 text-success-600"
                      }`}
                    >
                      {ours ? t.withRevio : t.answered}
                    </span>
                    <span className="tnum ml-auto shrink-0 text-[11px] text-ink-400">{date.format(lastMoved(r))}</span>
                  </span>
                  {/* What it was about — the first line of the question, which is how people name it. */}
                  <span className="mt-1 block truncate text-[13px] text-ink-800">{r.message.split("\n")[0]}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-400">{kindLabel}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className={`min-w-0 ${selectedId ? "" : "hidden xl:block"}`}>
        {selectedId && (
          <a href={basePath} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-800 xl:hidden">
            <span aria-hidden="true">&larr;</span> {t.back}
          </a>
        )}
        {selected ? (
          <Conversation r={selected} replyAction={replyAction} locale={locale} timeZone={timeZone} />
        ) : (
          <div className="flex h-full min-h-[160px] items-center justify-center rounded-lg border border-dashed border-surface-border bg-white/60 p-6 text-center text-[13px] text-ink-500">
            {selectedId ? t.notFound : t.pick}
          </div>
        )}
      </section>
    </div>
  );
}

function Conversation({
  r,
  replyAction,
  locale,
  timeZone,
}: {
  r: MyRequestRow;
  replyAction: ((prev: SupportReplyResult, fd: FormData) => Promise<SupportReplyResult>) | undefined;
  locale: Locale;
  timeZone: string;
}) {
  const t = translate(helpStrings, locale).requests;
  const kinds = translate(shellStrings, locale).help.kinds;
  const k = supportKind(r.kind);
  const kind = kinds[k.key as SupportKind] ?? { label: k.label, promise: k.promise };
  const ours = awaitingUs(r);
  const opened = new Intl.DateTimeFormat(LOCALE_LABELS[locale].intl, {
    timeZone, day: "numeric", month: "long", year: "numeric",
  }).format(r.createdAt);

  return (
    <article className="overflow-hidden rounded-lg border border-surface-border bg-white">
      <header className="border-b border-surface-border bg-surface-muted/50 px-4 py-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="tnum text-[14px] font-semibold text-ink-900">{supportReference(r.id)}</h2>
          <span className="text-[12px] text-ink-500">{kind.label}</span>
          <span
            className={`ml-auto rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
              ours ? "bg-warning-50 text-warning-600" : "bg-success-50 text-success-600"
            }`}
          >
            {ours ? t.withRevio : t.answered}
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-ink-500">
          {fill(t.opened, { date: opened, name: r.contactName })}
          {r.source !== "app" ? ` · ${t.sources[r.source] ?? r.source}` : ""}
        </p>
      </header>

      <div className="px-3 pb-3">
        {/* Read from the hotel's side, so their own words sit where a messenger puts them. */}
        <SupportThread
          perspective="hotel"
          opening={{ authorName: r.contactName, body: r.message, createdAt: r.createdAt }}
          messages={r.messages}
          locale={locale}
          timeZone={timeZone}
        />

        {ours && r.messages.length > 0 && (
          <p className="mt-2 text-[11.5px] italic text-ink-400">
            {t.waiting} {kind.promise.charAt(0).toLowerCase() + kind.promise.slice(1)}
          </p>
        )}

        {/*
          Offered on every request, answered or not. A hotel reading an answer that did not solve it
          should say so where the question already is, rather than opening a second case carrying
          none of the history. Sending reopens it; `recordHotelReply` clears `handledAt`.
        */}
        {replyAction && <SupportReply key={r.id} requestId={r.id} action={replyAction} />}
      </div>
    </article>
  );
}
