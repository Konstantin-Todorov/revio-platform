import Link from "next/link";
import { PRODUCT_BY_KEY, hoursOverdue, isOverdue, supportKind, supportSourceLabel } from "@revio/core";
import { StatusPill } from "@/components/ui/primitives";

/**
 * One case as a row you can scan, rather than a conversation you have to read.
 *
 * ## Why the queue stopped rendering whole cases
 *
 * It used to show every case in full — the source, the entire thread, the reply box — one after
 * another. With two demo hotels that reads fine. The founder tried it with more and said what it
 * really is: *"the ticket system is hard to know when there are many hotels asking, it's
 * confusing."* Ten hotels meant ten expanded conversations stacked vertically, and the answer to
 * "who is waiting longest" was somewhere in the middle of somebody else's thread.
 *
 * A queue is scanned; a case is read. They are different jobs and now have different surfaces — the
 * row carries what you triage on, and `/support/[id]` carries the conversation and the reply box.
 * That is not the "one component per concept" rule being broken: a list row and a detail view are
 * two concepts, and the thing that must never fork — the case itself — is still one `SupportCase`.
 *
 * What a row has to answer without being opened: **how late**, **which hotel**, **whose turn**, and
 * **enough of the question to recognise it**. Everything else is a click away.
 */

export interface SupportQueueRowData {
  id: string;
  tenantId: string;
  product: string;
  source: string;
  route: string | null;
  kind: string;
  message: string;
  contactName: string;
  handledAt: Date | null;
  createdAt: Date;
  messages: { side: string; createdAt: Date }[];
}

function ago(from: Date, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function SupportQueueRow({
  request: r,
  tenantName,
  isDemo,
  now,
}: {
  request: SupportQueueRowData;
  tenantName: string;
  isDemo: boolean;
  now: Date;
}) {
  const k = supportKind(r.kind);
  const late = isOverdue(r, now);
  const answered = r.handledAt !== null;
  const last = r.messages[r.messages.length - 1];
  // Derived from the thread, not from a column — the two can disagree and the thread is the true one.
  const theyReplied = !answered && last?.side === "hotel" && r.messages.length > 1;

  return (
    <Link
      href={`/support/${r.id}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-surface-muted"
    >
      {/* Lateness first: it is the only thing that decides which of forty rows to open. */}
      <span className="w-[72px] shrink-0">
        {answered ? (
          <StatusPill tone="success">done</StatusPill>
        ) : late ? (
          <StatusPill tone="danger">{Math.round(hoursOverdue(r, now))}h late</StatusPill>
        ) : (
          <StatusPill tone={k.key === "urgent" ? "warning" : "neutral"}>{k.key}</StatusPill>
        )}
      </span>

      <span className="w-[150px] shrink-0 truncate text-[13px] font-semibold text-ink-900">
        {tenantName}
        {isDemo && <span className="ml-1 text-[10px] font-semibold uppercase text-ink-400">demo</span>}
      </span>

      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-600">{r.message}</span>

      {theyReplied && <StatusPill tone="warning">they replied</StatusPill>}

      <span className="shrink-0 text-[11.5px] text-ink-400">
        {PRODUCT_BY_KEY[r.product as "cm" | "crs" | "pms"]?.name ?? r.product}
        {r.source !== "app" ? ` · ${supportSourceLabel(r.source)}` : ""}
      </span>

      <span className="tnum w-[92px] shrink-0 text-right text-[11.5px] text-ink-400">
        {r.contactName.split(" ")[0]} · {ago(r.createdAt, now)}
      </span>
    </Link>
  );
}
