import type { TrialBanner } from "@revio/core";
import { SubmitButton } from "./submit-button.js";

/**
 * The strip a hotel sees at the top of a product they are trying.
 *
 * ## The shape it borrows
 *
 * A subscription notice, the way every piece of software the hotel already uses shows one: one
 * line, at the top, with the count and the way out. `docs/UI-STANDARD.md` rule 1 — departing from
 * the familiar shape has to buy something, and here it buys nothing.
 *
 * ## Why the count is also a bar
 *
 * Rule 2: say it before it is read. "23 days left" has to be parsed; a bar that is a fifth full is
 * understood before the eye reaches the words. As it empties it also changes colour on exactly the
 * days the reminder emails go out, so the strip and the inbox never disagree about how urgent this
 * is.
 *
 * ## Why it is not sticky, and not a modal
 *
 * It sits at the top of the page and scrolls away with it. A bar that follows a receptionist down
 * every screen all month is an obstruction, and a modal in front of a front desk with a guest
 * waiting is worse than the expiry it warns about. Seeing it on arrival at every screen is enough.
 *
 * One component for all three products (rule 3). The only per-product thing is the name, which
 * comes from `@revio/core`.
 */
export function TrialStrip({
  banner,
  keepAction,
}: {
  banner: TrialBanner;
  /** Tells us they want to keep it. Omitted where the signed-in person may not ask. */
  keepAction?: (formData: FormData) => void | Promise<void>;
}) {
  const TONE = {
    calm: {
      wrap: "border-surface-border bg-surface",
      accent: "bg-brand-700",
      track: "bg-surface-sunken",
      head: "text-ink-900",
      pill: "bg-brand-50 text-brand-800",
    },
    warning: {
      wrap: "border-warning-200 bg-warning-50",
      accent: "bg-warning-600",
      track: "bg-warning-100",
      head: "text-warning-800",
      pill: "bg-warning-100 text-warning-800",
    },
    urgent: {
      wrap: "border-danger-200 bg-danger-50",
      accent: "bg-danger-600",
      track: "bg-danger-100",
      head: "text-danger-700",
      pill: "bg-danger-100 text-danger-700",
    },
  }[banner.tone];

  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 ${TONE.wrap}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${TONE.pill}`}>
              Free trial
            </span>
            <span className={`text-[13.5px] font-semibold ${TONE.head}`}>{banner.headline}</span>
          </div>
          <p className="mt-1 max-w-[74ch] text-[12.5px] leading-relaxed text-ink-600">{banner.detail}</p>
        </div>

        {banner.cta && keepAction && (
          <form action={keepAction} className="shrink-0">
            <SubmitButton
              pendingLabel="Sending…"
              className="rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700"
            >
              {banner.cta}
            </SubmitButton>
          </form>
        )}
      </div>

      {/*
        The count, said again without words. `aria-hidden` because the headline above already states
        it exactly — a screen reader announcing a progress bar here would read the same fact twice.
      */}
      <div aria-hidden="true" className={`mt-2.5 h-1 w-full overflow-hidden rounded-full ${TONE.track}`}>
        <div
          className={`h-full rounded-full transition-[width] ${TONE.accent}`}
          style={{ width: `${Math.round(banner.elapsed * 100)}%` }}
        />
      </div>
    </div>
  );
}
