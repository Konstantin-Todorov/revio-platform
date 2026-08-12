import type { ReactNode } from "react";

/**
 * The chrome around a first-run screen: progress, heading, one decision, a way forward.
 *
 * **Deliberately full-screen with no sidebar.** The hotel has just set a password and has never seen
 * this software; a navigation rail at that moment is an invitation to wander into the calendar and
 * never come back. Everything they need is on the screen in front of them, and the nav returns the
 * moment setup ends.
 *
 * Presentational only. Each product supplies its own steps (from `welcomeFlow` in `@revio/core`) and
 * its own form — the shell never knows what a step does, which is why one component serves three
 * products whose setup has almost nothing in common.
 */

export interface WelcomeShellStep {
  key: string;
  title: string;
}

export interface WelcomeShellProps {
  /** "RevioLink" — named, because a hotel with three products needs to know which it is setting up. */
  productName: string;
  steps: WelcomeShellStep[];
  currentKey: string;
  /** Heading for this screen. */
  title: string;
  /** One sentence under it. */
  lead: string;
  /** Where "I'll do this later" goes. Absent ⇒ no skip offered, which is the case for Go live. */
  skipHref?: string;
  /** The step's own form, including its submit button. */
  children: ReactNode;
  /** Optional aside rendered under the form — reassurance, or what happens next. */
  footnote?: ReactNode;
}

export function WelcomeShell({
  productName,
  steps,
  currentKey,
  title,
  lead,
  skipHref,
  children,
  footnote,
}: WelcomeShellProps) {
  const current = Math.max(0, steps.findIndex((s) => s.key === currentKey));
  const isLast = current === steps.length - 1;

  return (
    <div className="min-h-screen bg-surface-muted">
      {/* Progress rail. Segments rather than a percentage: a hotelier wants to know how many screens
          are left, not that they are 43% of the way through something unspecified. */}
      <div className="border-b border-surface-border bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-4">
          <span className="shrink-0 text-[12.5px] font-bold text-ink-900">{productName}</span>
          <span className="shrink-0 text-[12px] text-ink-400">setup</span>

          <ol className="ml-auto flex items-center gap-1.5" aria-label={`Step ${current + 1} of ${steps.length}`}>
            {steps.map((s, i) => (
              <li
                key={s.key}
                title={s.title}
                aria-current={i === current ? "step" : undefined}
                className={`h-1.5 rounded-full transition-all ${
                  i < current
                    ? "w-6 bg-success-500"
                    : i === current
                      ? "w-10 bg-brand-700"
                      : "w-6 bg-surface-sunken"
                }`}
              />
            ))}
          </ol>
          <span className="tnum shrink-0 text-[12px] font-semibold text-ink-500">
            {current + 1} of {steps.length}
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink-900 sm:text-[30px]">
          {title}
        </h1>
        <p className="mt-2 max-w-prose text-[14.5px] leading-relaxed text-ink-500">{lead}</p>

        <div className="mt-8">{children}</div>

        {footnote && <div className="mt-6 text-[12.5px] leading-relaxed text-ink-500">{footnote}</div>}

        {/* Skip sits below and quiet — available, never the obvious choice. A skipped step reappears
            on the dashboard checklist, so nothing is lost by taking it. */}
        {skipHref && !isLast && (
          <div className="mt-8 border-t border-surface-border pt-5">
            <a
              href={skipHref}
              className="text-[13px] font-semibold text-ink-500 underline-offset-2 hover:text-ink-700 hover:underline"
            >
              I&rsquo;ll do this later
            </a>
            <span className="ml-2 text-[12.5px] text-ink-400">— it stays on your checklist.</span>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * The primary action on a first-run screen. One per screen, and it says what happens rather than
 * "Next" — a button that names its consequence is the cheapest way to stop someone clicking through
 * a step they meant to read.
 */
export function WelcomeContinue({
  label,
  pending,
  tone = "brand",
}: {
  label: string;
  pending?: boolean;
  /** `go` is reserved for the one irreversible action: putting rooms on sale. */
  tone?: "brand" | "go";
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`h-11 w-full rounded-md px-5 text-[14.5px] font-semibold text-white transition-colors disabled:opacity-60 sm:w-auto ${
        tone === "go" ? "bg-success-600 hover:bg-success-700" : "bg-brand-800 hover:bg-brand-700"
      }`}
    >
      {pending ? "Saving…" : label}
    </button>
  );
}
