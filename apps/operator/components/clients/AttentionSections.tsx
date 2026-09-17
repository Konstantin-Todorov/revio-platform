import type { AttentionFlag } from "@/lib/attention";

/**
 * The attention feed in its two halves.
 *
 * ## ⚠️ Why this is two sections and not one list with labels
 *
 * A single ranked list mixed two unlike things. "3 bookings never reached the calendar" and "renews
 * in 12 days" are both true and both worth knowing, and they are **not the same kind of thing**:
 * one means a guest is about to arrive at a desk with no reservation, the other means a
 * conversation to have this month. Ranked against each other by severity they compete, and on a
 * quiet day the commercial note wins — which is exactly backwards.
 *
 * A label on each row does not fix it, because a label has to be read; a heading is read before
 * anything under it. Somebody opening this console is answering one of two questions, and the screen
 * should answer them separately rather than make them filter it in their head.
 *
 * ## The order
 *
 * Their hotel first, always, even when ours is the redder half. A broken channel is somebody's
 * morning; an unpaid invoice is a phone call we can make tomorrow.
 *
 * ## An empty half still shows
 *
 * "Nothing is wrong with their software" is a thing worth seeing, and a section that disappears
 * cannot say it. It is the sentence somebody wants before a difficult call.
 */

const DOT: Record<string, string> = { act: "bg-danger-600", soon: "bg-warning-500", note: "bg-ink-300" };

function Section({
  title,
  hint,
  empty,
  flags,
}: {
  title: string;
  hint: string;
  empty: string;
  flags: AttentionFlag[];
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 border-b border-surface-border bg-surface-muted/60 px-4 py-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-ink-600">{title}</h4>
        <span className="text-[11px] text-ink-400">{hint}</span>
        {flags.length > 0 && <span className="tnum ml-auto text-[11px] font-semibold text-ink-500">{flags.length}</span>}
      </div>
      {flags.length === 0 ? (
        <p className="px-4 py-3 text-[12.5px] text-ink-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-surface-border/60">
          {flags.map((f) => (
            <li key={f.title} className="flex items-start gap-3 px-4 py-3">
              <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[f.severity] ?? "bg-ink-300"}`} />
              <span>
                <span className={`text-[13px] font-semibold ${f.severity === "act" ? "text-danger-600" : "text-ink-900"}`}>
                  {f.title}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-ink-500">{f.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AttentionSections({ theirs, ours }: { theirs: AttentionFlag[]; ours: AttentionFlag[] }) {
  return (
    <div>
      <Section
        title="Their hotel"
        hint="the software is not doing its job"
        empty="Nothing is broken for them right now."
        flags={theirs}
      />
      <Section
        title="Our account with them"
        hint="money, renewal, usage"
        empty="Nothing outstanding on our side."
        flags={ours}
      />
    </div>
  );
}
