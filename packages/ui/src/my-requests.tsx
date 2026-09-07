import { supportKind, supportReference, supportSourceLabel } from "@revio/core";
import { SupportReply, type SupportReplyResult } from "./support-reply.js";
import { SupportThread } from "./support-thread.js";

/**
 * A hotel's own support history, in their own product.
 *
 * The half that was missing. A request went in and the answer arrived by email, so the system held
 * the question and none of the conversation — and the hotel had nowhere to look up what they were
 * told last time. Both sides now read the same thread.
 *
 * Rendered on the server: this is a read of rows the database already restricts to their tenant, and
 * there is nothing here worth shipping a client bundle for.
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

const when = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");

export function MyRequests({
  requests,
  replyAction,
}: {
  requests: MyRequestRow[];
  /**
   * Supplied by the app, because the perimeter belongs to the app. Optional so a surface that only
   * wants to show the history — the operator's own help page, say — can render without one, and
   * gets a thread with no input rather than a broken form.
   */
  replyAction?: (prev: SupportReplyResult, fd: FormData) => Promise<SupportReplyResult>;
}) {
  if (requests.length === 0) {
    return (
      <section className="rounded-lg border border-surface-border bg-white p-5">
        <h2 className="text-[14px] font-semibold text-ink-900">You have not asked us anything yet</h2>
        <p className="mt-1 text-[13px] text-ink-600">
          Use <strong>Get help</strong> in the menu under your name. We can already see which hotel
          and which screen you are on, so you only have to say what went wrong — and everything you
          send, and everything we answer, stays here.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-surface-border bg-white">
      <div className="border-b border-surface-border bg-surface-muted/50 px-4 py-2.5">
        <h2 className="text-[13px] font-semibold text-ink-900">Your requests</h2>
        <p className="text-[11.5px] text-ink-500">
          Everything you have asked us, and what we said back
        </p>
      </div>
      <ul className="divide-y divide-surface-border">
        {requests.map((r) => {
          const k = supportKind(r.kind);
          // Whose turn it is, derived rather than stored — a status column and a thread can disagree,
          // and the thread is the one that is true.
          const last = r.messages[r.messages.length - 1];
          const awaitingUs = !last || last.side === "hotel";
          return (
            <li key={r.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="tnum text-[12px] font-semibold text-ink-900">{supportReference(r.id)}</span>
                <span className="text-[11px] text-ink-400">{k.label}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
                    awaitingUs ? "bg-warning-50 text-warning-600" : "bg-success-50 text-success-600"
                  }`}
                >
                  {awaitingUs ? "With Revio" : "Answered"}
                </span>
                <span className="ml-auto text-[11px] text-ink-400">
                  {when(r.createdAt)}
                  {r.source !== "app" ? ` · ${supportSourceLabel(r.source)}` : ""}
                </span>
              </div>

              {/* Read from the hotel's side, so their own words sit where a messenger puts them. */}
              <SupportThread
                perspective="hotel"
                opening={{ authorName: r.contactName, body: r.message, createdAt: r.createdAt }}
                messages={r.messages}
              />

              {awaitingUs && r.messages.length > 0 && (
                <p className="mt-2 text-[11.5px] italic text-ink-400">
                  We have your reply — {k.promise.toLowerCase()}
                </p>
              )}

              {/*
                Offered on every request, answered or not. A hotel reading an answer that did not
                solve it should say so where the question already is, rather than opening a second
                case carrying none of the history — which was their only option until now. Sending
                reopens it; `recordHotelReply` clears `handledAt` so it returns to our queue.
              */}
              {replyAction && <SupportReply requestId={r.id} action={replyAction} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
