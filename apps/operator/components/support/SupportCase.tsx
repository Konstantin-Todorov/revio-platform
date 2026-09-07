import Link from "next/link";
import {
  PRODUCT_BY_KEY,
  hoursOverdue,
  isOverdue,
  supportKind,
  supportReference,
  supportSourceLabel,
} from "@revio/core";
import { StatusPill } from "@/components/ui/primitives";
import { markSupportHandled, replyToSupportRequest } from "@/lib/actions-support";

/**
 * One support case, whole — and the same one whether it is waiting or answered.
 *
 * ## Why this is a component rather than markup on the queue
 *
 * It used to be markup, and only on the waiting list. An answered request collapsed to a single line
 * — reference, hotel, the first ninety characters, a date — losing where it came from, the entire
 * correspondence, and any way to say anything further. The founder reported it exactly: *"when its
 * waiting i see from where it comes but when i answer i cant see the info and the other
 * corespondation"*.
 *
 * The card that showed everything and the card that showed almost nothing were two pieces of markup,
 * so they could differ. One component cannot. Answering a case now changes its position and its
 * pill, and nothing about what you can read or do.
 *
 * That also repairs a promise the queue was already making: the answered list is headed *"Kept,
 * because a renewal call asks what they have reported before"*, and the correspondence — the part
 * such a call actually wants — was the part being dropped.
 */

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[16px] text-ink-900 outline-none transition-colors focus:border-brand-600 sm:text-[12.5px]";

const when = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");

export interface SupportCaseRow {
  id: string;
  tenantId: string;
  product: string;
  source: string;
  route: string | null;
  kind: string;
  message: string;
  contactName: string;
  contactEmail: string;
  handledAt: Date | null;
  createdAt: Date;
  messages: {
    id: string;
    side: string;
    authorName: string;
    body: string;
    emailedAt: Date | null;
    createdAt: Date;
  }[];
}

export function SupportCase({
  request: r,
  tenant,
  now,
  linkToCase = true,
}: {
  request: SupportCaseRow;
  tenant?: { name: string; isDemo: boolean };
  now: Date;
  /** Off on the case's own page, where a link to itself would be furniture. */
  linkToCase?: boolean;
}) {
  const k = supportKind(r.kind);
  const late = isOverdue(r, now);
  const answered = r.handledAt !== null;
  // Whose turn it is, read from the thread rather than from a column — the two can disagree, and
  // the thread is the one that is true. A hotel's reply reopens the case, so this follows it.
  const lastIsHotel = r.messages.length > 0 && r.messages[r.messages.length - 1]!.side === "hotel";
  const reference = supportReference(r.id);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {linkToCase ? (
          <Link
            href={`/support/${r.id}`}
            className="tnum text-[12px] font-semibold text-brand-700 hover:underline"
          >
            {reference}
          </Link>
        ) : (
          <span className="tnum text-[12px] font-semibold text-ink-900">{reference}</span>
        )}

        {answered ? (
          <StatusPill tone="success">answered</StatusPill>
        ) : (
          <StatusPill tone={late ? "danger" : k.key === "urgent" ? "warning" : "neutral"}>
            {late ? `${Math.round(hoursOverdue(r, now))}h late` : k.key}
          </StatusPill>
        )}
        {/* Said out loud: a reopened case is one somebody already considered finished. */}
        {!answered && lastIsHotel && r.messages.length > 1 && (
          <StatusPill tone="warning">they replied</StatusPill>
        )}

        <span className="text-[13px] font-semibold text-ink-900">{tenant?.name ?? "Unknown client"}</span>
        {tenant?.isDemo ? <StatusPill tone="neutral">demo</StatusPill> : null}
        <span className="text-[11.5px] text-ink-400">
          {PRODUCT_BY_KEY[r.product as "cm" | "crs" | "pms"]?.name ?? r.product}
          {r.route ? ` · ${r.route}` : ""}
          {r.source !== "app" ? ` · ${supportSourceLabel(r.source)}` : ""}
        </span>
        <span className="ml-auto text-[11.5px] text-ink-400">
          {r.contactName} · {r.contactEmail}
        </span>
      </div>

      <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-700">{r.message}</p>

      {r.messages.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-l-2 border-surface-border pl-3">
          {r.messages.map((m) => (
            <li key={m.id} className="text-[12.5px]">
              <span className="font-semibold text-ink-700">
                {m.side === "revio" ? m.authorName : r.contactName}
              </span>
              <span className="ml-1.5 text-[11px] text-ink-400">{when(m.createdAt)}</span>
              {/* An undelivered reply is indistinguishable from being ignored, so it is said out
                  loud rather than left to look sent. Only ours are delivered by us. */}
              {m.side === "revio" && !m.emailedAt && (
                <span className="ml-1.5 text-[11px] font-semibold text-danger-600">
                  email did not send
                </span>
              )}
              <p className="whitespace-pre-wrap text-ink-600">{m.body}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Answering from here, rather than from an inbox: the thread is the record both sides can
          read, and the hotel still receives it as email. Offered on an answered case too — a
          follow-up belongs on the case it follows up, not in a new one. */}
      <form action={replyToSupportRequest} className="mt-2.5">
        <input type="hidden" name="id" value={r.id} />
        <textarea name="body" required rows={2} placeholder={`Reply to ${r.contactName}…`} className={inputCls} />
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <button className="h-[30px] rounded-md bg-brand-800 px-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-700">
            Send reply
          </button>
          <span className="text-[11px] text-ink-400">
            Emailed to {r.contactEmail} and kept in the thread.
            {answered ? " It stays answered." : " Replying marks it answered."}
          </span>
        </div>
      </form>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {!answered && (
          <form action={markSupportHandled}>
            <input type="hidden" name="id" value={r.id} />
            <button className="text-[12px] font-semibold text-ink-500 transition-colors hover:text-ink-900">
              Mark answered
            </button>
          </form>
        )}
        <span className="text-[11.5px] text-ink-400">
          asked {when(r.createdAt)} · promised {k.targetHours}h
          {answered && r.handledAt ? ` · answered ${when(r.handledAt)}` : ""}
        </span>
      </div>
    </div>
  );
}
