import type { ReactNode } from "react";

/**
 * The first-run setup checklist, shared by RevioLink, RevioCRS and RevioPMS.
 *
 * A hotel's first login lands on a dashboard with nothing in it. Rather than six zeros and a row of
 * green pills, it gets the shortest honest path to trading. The card disappears for good once every
 * step is done, so an established hotel never sees it.
 *
 * Presentational only — each product computes its own `SetupProgress` from @revio/core.
 */

export interface ChecklistStep {
  key: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  done: boolean;
  /** Another Revio product this hotel runs had already done this — see `@revio/core/onboarding`. */
  inheritedFrom?: string;
  /** Done for them at provisioning rather than by them. */
  providedForYou?: boolean;
}

export interface SetupChecklistProps {
  /** "RevioLink", "RevioCRS", "RevioPMS" — named so the hotel knows which product it's setting up. */
  productName: string;
  /** One line on what being set up gets them — the reward, not the task. */
  promise: string;
  steps: ChecklistStep[];
  done: number;
  total: number;
  /** Rendered top-right — e.g. a "hide" control. Optional. */
  action?: ReactNode;
}

export function SetupChecklist({ productName, promise, steps, done, total, action }: SetupChecklistProps) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const nextKey = steps.find((s) => !s.done)?.key;

  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-brand-600/25 bg-white shadow-card">
      {/* Header — deep brand band so this reads as a welcome, not an error. */}
      <div className="bg-brand-900 px-5 py-4 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold tracking-tight">Welcome to {productName}</h2>
            <p className="mt-0.5 text-[12.5px] text-white/70">{promise}</p>
          </div>
          {action}
        </div>
        <div className="mt-3.5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-success-500 transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="tnum shrink-0 text-[12px] font-semibold text-white/80">
            {done} of {total} done
          </span>
        </div>
      </div>

      <ol className="divide-y divide-surface-border/70">
        {steps.map((s, i) => {
          const isNext = s.key === nextKey;
          return (
            <li
              key={s.key}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 ${isNext ? "bg-brand-50/50" : ""}`}
            >
              {/* Number until done, tick after — progress you can see at a glance. */}
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold ${
                  s.done
                    ? "bg-success-500 text-white"
                    : isNext
                      ? "bg-brand-600 text-white"
                      : "bg-surface-sunken text-ink-400"
                }`}
              >
                {s.done ? <CheckMark /> : i + 1}
              </span>

              <div className="min-w-[14rem] flex-1">
                <div
                  className={`text-[13.5px] font-semibold ${s.done ? "text-ink-400 line-through decoration-ink-300" : "text-ink-900"}`}
                >
                  {s.title}
                </div>
                {!s.done && <div className="mt-0.5 text-[12px] leading-snug text-ink-500">{s.body}</div>}
                {/* The single best moment to show what one shared core buys: these are not copies,
                    they are the same records the other product has been using. */}
                {s.inheritedFrom && (
                  <div className="mt-0.5 text-[12px] leading-snug text-success-600">
                    Already set up in {s.inheritedFrom} — nothing to move across.
                  </div>
                )}
              </div>

              {s.done ? (
                <span className="shrink-0 text-[12px] font-semibold text-success-600">
                  {s.inheritedFrom ? "Already done" : s.providedForYou ? "Set up for you" : "Done"}
                </span>
              ) : (
                <a
                  href={s.href}
                  className={`shrink-0 rounded-md px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
                    isNext
                      ? "bg-brand-800 text-white hover:bg-brand-700"
                      : "border border-surface-border bg-white text-ink-700 hover:bg-surface-muted"
                  }`}
                >
                  {s.cta}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M3 8.5l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
