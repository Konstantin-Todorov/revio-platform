import Link from "next/link";
import { AlertCircle, ArrowRight, Clock, PhoneCall } from "lucide-react";
import type { TrialRow } from "@/lib/trial-reading-data";
import { StatusPill, type Tone } from "@/components/ui/primitives";

/**
 * Every trial, ordered by what needs doing today.
 *
 * ## Why it is not a table of dates
 *
 * A list of trials sorted by end date tells you when to panic and nothing about whether to. This
 * leads with the reading — what the trial is actually doing — because two trials ending on the same
 * Thursday can need opposite conversations: one has three people in it every morning and wants an
 * order form, the other has never been opened and needs somebody to ask what went wrong.
 *
 * ## ⚠️ The product named is the one they USED
 *
 * Every hotel gets all three, so the column that matters is not what they signed up for. A hotel
 * that ticked "channel manager" and spent three weeks in the front desk is a RevioPMS sale, and
 * their own days of use are the argument for it.
 */

const TONE: Record<string, Tone> = {
  asked_to_keep: "success",
  landing: "success",
  exploring: "info",
  drifting: "warning",
  never_opened: "danger",
  ended_engaged: "warning",
  ended_cold: "neutral",
  converted: "success",
};

const LABEL: Record<string, string> = {
  asked_to_keep: "asked to keep it",
  landing: "landing",
  exploring: "exploring",
  drifting: "drifting",
  never_opened: "never opened",
  ended_engaged: "ended · was used",
  ended_cold: "ended · unused",
  converted: "bought it",
};

export function TrialsPanel({ rows, needAttention }: { rows: TrialRow[]; needAttention: number }) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-[13px] font-semibold text-ink-700">No trials yet</p>
        <p className="mt-1 text-[12.5px] text-ink-500">
          This fills in the first time a hotel confirms a signup. Every one of them gets all three products for 30 days.
        </p>
      </div>
    );
  }

  return (
    <div>
      {needAttention > 0 && (
        <p className="flex items-center gap-1.5 border-b border-surface-border bg-warning-50/50 px-4 py-2 text-[12.5px] font-semibold text-warning-800">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {needAttention} trial{needAttention === 1 ? "" : "s"} need{needAttention === 1 ? "s" : ""} something today.
        </p>
      )}

      <ul className="divide-y divide-surface-border/60">
        {rows.map((r) => (
          <li key={`${r.tenantId}-${r.product}`} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <Link href={`/clients/${r.tenantId}`} className="text-[13.5px] font-semibold text-brand-700 hover:underline">
                {r.tenantName}
              </Link>
              <span className="flex items-center gap-2">
                {r.isDemo && (
                  <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">
                    demo
                  </span>
                )}
                <StatusPill tone={TONE[r.reading.verdict] ?? "neutral"}>{LABEL[r.reading.verdict] ?? r.reading.verdict}</StatusPill>
                {/*
                  Days left, not the end date: "4 days" is a decision, "1 October" is a lookup.
                  ⚠️ Gated on `finished`, not on the countdown — a trial ended early still has a
                  future `endsAt`, which printed "ended · was used" beside "11 days left".
                */}
                {!r.reading.finished && (
                  <span className="tnum flex items-center gap-1 text-[11.5px] text-ink-500">
                    <Clock className="h-3 w-3" />
                    {r.reading.daysLeft} day{r.reading.daysLeft === 1 ? "" : "s"} left
                  </span>
                )}
              </span>
            </div>

            <p className="mt-1 text-[12.5px] leading-snug text-ink-700">{r.reading.headline}</p>

            {/* The action, when there is one. No filler when the honest answer is "nothing yet". */}
            {r.reading.action && (
              <p
                className={`mt-1.5 flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] leading-snug ${
                  r.reading.urgency === "now" ? "bg-warning-50 text-warning-800" : "bg-surface-muted text-ink-600"
                }`}
              >
                <PhoneCall className="mt-px h-3.5 w-3.5 shrink-0" />
                {r.reading.action}
              </p>
            )}

            {(r.reading.strongest || r.reading.untouched.length > 0) && (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-ink-400">
                {r.reading.strongest && (
                  <span>
                    Most used: <strong className="font-semibold text-ink-700">{r.reading.strongest.name}</strong>
                  </span>
                )}
                {r.reading.untouched.length > 0 && (
                  <span>Never opened: {r.reading.untouched.map((p) => p.name).join(", ")}</span>
                )}
                <span className="tnum">{r.reading.activeDays} active days</span>
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="border-t border-surface-border px-4 py-2 text-[11.5px] text-ink-400">
        Ordered by what needs doing first, then by what runs out soonest. Usage is counted only inside each trial&apos;s
        own window <ArrowRight className="inline h-3 w-3" /> a hotel&apos;s older activity in another product cannot
        flatter it.
      </p>
    </div>
  );
}
