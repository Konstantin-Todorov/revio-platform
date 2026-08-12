"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { ClientSetup } from "@/lib/onboarding";

/**
 * What this client has set up, per product — the operator's view of the hotel's own checklist.
 *
 * **Collapsed by default once they are finished, open while anything is outstanding.** A client who
 * is fully set up should cost one line on this page; a client who is stuck should not need a click
 * before anyone notices. The disclosure is there because most clients will eventually be in the
 * first group, not because the detail is unimportant.
 *
 * Every label here comes from `@revio/core` — the same words on the hotel's own screen, so a call
 * can quote them.
 */
export function SetupProgressCard({
  setup,
  ageDays,
  stalled,
}: {
  setup: ClientSetup;
  ageDays: number;
  stalled: boolean;
}) {
  const [open, setOpen] = useState(!setup.complete);

  if (setup.products.length === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-white p-4 text-[12.5px] text-ink-500">
        No products enabled, so there is nothing to set up.
      </div>
    );
  }

  const pct = setup.total === 0 ? 0 : Math.round((setup.done / setup.total) * 100);

  return (
    <section className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13.5px] font-bold text-ink-900">Onboarding</h3>
            {setup.complete ? (
              <span className="rounded bg-success-50 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-success-600">
                Set up
              </span>
            ) : stalled ? (
              // Not "how bad" but "how soon" — same severity language as the attention feed.
              <span className="rounded bg-danger-50 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-danger-600">
                Stalled
              </span>
            ) : (
              <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-ink-500">
                In progress
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-ink-500">
            {setup.complete ? (
              <>Every product they bought is ready to trade.</>
            ) : setup.nextStep ? (
              <>
                Next: <span className="font-semibold text-ink-700">{setup.nextStep.title}</span> in{" "}
                {setup.nextStep.product} · client is {ageDays} day{ageDays === 1 ? "" : "s"} old
              </>
            ) : (
              <>Client is {ageDays} day{ageDays === 1 ? "" : "s"} old.</>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${setup.complete ? "bg-success-500" : "bg-brand-600"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="tnum text-[12px] font-semibold text-ink-700">
            {setup.done}/{setup.total}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-surface-border">
          {setup.products.map((p) => (
            <div key={p.key} className="border-b border-surface-border/60 last:border-0">
              <div className="flex items-center gap-2 bg-surface-muted/60 px-4 py-2">
                <span className="text-[12px] font-bold text-ink-800">{p.name}</span>
                <span className="tnum text-[11.5px] text-ink-500">
                  {p.progress.done} of {p.progress.total}
                </span>
                {p.progress.complete && (
                  <Check className="h-3.5 w-3.5 text-success-600" aria-label="complete" />
                )}
              </div>
              <ol className="px-4 py-1.5">
                {p.progress.steps.map((s) => (
                  <li key={s.key} className="flex items-start gap-2.5 py-1.5">
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                        s.done ? "bg-success-500 text-white" : "bg-surface-sunken text-ink-400"
                      }`}
                    >
                      {s.done ? "✓" : ""}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`text-[12.5px] ${s.done ? "text-ink-400 line-through decoration-ink-300" : "text-ink-800"}`}
                      >
                        {s.title}
                      </span>
                      {/* Worth seeing before a call: the expansion sale largely made itself. */}
                      {s.sharedWith && s.sharedWith.length > 0 && (
                        <span className="ml-1.5 text-[11px] text-success-600">
                          shared with {s.sharedWith.join(", ")}
                        </span>
                      )}
                      {s.providedForYou && !s.sharedWith && (
                        <span className="ml-1.5 text-[11px] text-ink-400">set up at onboarding</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <p className="px-4 py-2.5 text-[11px] text-ink-400">
            These are the client's own checklist steps, in their wording. We do not record when each
            step was completed, so this shows how far they have got — not how long they have been stuck.
          </p>
        </div>
      )}
    </section>
  );
}
