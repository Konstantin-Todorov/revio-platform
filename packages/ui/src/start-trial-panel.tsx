import type { ReactNode } from "react";

/**
 * The screen a hotel sees before it starts its own trial.
 *
 * ## Why a page and not a button in the dropdown
 *
 * Switching a product on is the beginning of something that becomes a bill if they keep it. A menu
 * item that did it on one click would be a commitment made in a hover state — and the promise this
 * whole feature rests on ("nothing starts charging on its own") is only believable if the moment it
 * starts is a moment somebody chose, on a screen that says what happens next.
 *
 * ## Why it lives in `@revio/ui`
 *
 * All three products offer the same trial on the same terms. Three copies of this screen would drift
 * — and the half that drifts is always the promise, not the button. One component, wired by a
 * ten-line route in each app (`docs/UI-STANDARD.md` rule 3).
 *
 * ## What it must never do
 *
 * It never shows a refusal it was not given. `refusal` comes from `canSelfStartTrial`, which is pure
 * and tested; this renders it and does not decide anything itself. A screen that worked out its own
 * eligibility would be a second set of rules, and the second set is the one that gets it wrong.
 */
export function StartTrialPanel({
  productName,
  tagline,
  days,
  promises,
  refusal,
  action,
  cancelHref,
  children,
}: {
  productName: string;
  /** One line on what it does — the same sentence the account menu used to offer it with. */
  tagline: string;
  days: number;
  promises: readonly string[];
  /** Set when they may not start one. The panel then explains instead of offering. */
  refusal?: string | null;
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  /** The hidden fields the app's own action needs. */
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[620px] px-4 py-10">
      <div className="rounded-xl border border-surface-border bg-white p-7 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-ink-400">Free trial</p>
        <h1 className="mt-1.5 text-[22px] font-bold tracking-tight text-ink-900">
          Try {productName} for {days} days
        </h1>
        <p className="mt-2 max-w-[56ch] text-[13.5px] leading-relaxed text-ink-600">{tagline}</p>

        {refusal ? (
          /*
           * A refusal explains and offers the next step; it never simply greys a button out. Somebody
           * who cannot start a trial still deserves to know why and what to do instead — a disabled
           * control with no sentence is the thing people ring up about.
           */
          <div className="mt-6 rounded-lg bg-surface-sunken px-4 py-3.5 text-[13px] leading-relaxed text-ink-700">
            {refusal}
          </div>
        ) : (
          <>
            <ul className="mt-6 space-y-2.5">
              {promises.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-700">
                  <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                  {p}
                </li>
              ))}
            </ul>

            <form action={action} className="mt-7 flex flex-wrap items-center gap-3">
              {children}
              <button
                type="submit"
                className="rounded-md bg-brand-800 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700"
              >
                Start the {days}-day trial
              </button>
              <a
                href={cancelHref}
                className="text-[13px] font-semibold text-ink-500 transition-colors hover:text-ink-800"
              >
                Not now
              </a>
            </form>
          </>
        )}

        {/*
          * The sentence that makes the rest believable, kept last and kept quiet. Leading with "no
          * card required" reads as a sales page; putting it where somebody looks after deciding
          * reads as a fact.
          */}
        <p className="mt-6 border-t border-surface-border pt-4 text-[11.5px] leading-relaxed text-ink-400">
          No card, no contract, and no automatic renewal. If you want to keep it afterwards, reply to
          any Revio email and we will price it with you first.
        </p>
      </div>
    </main>
  );
}
