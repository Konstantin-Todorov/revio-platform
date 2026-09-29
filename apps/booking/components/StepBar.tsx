import { Check } from "lucide-react";
import type { GuestStrings } from "@/lib/i18n/guest";

/**
 * Where the guest is in the booking, and how much is left.
 *
 * Booking abandonment is largely a fear of open-endedness — people stop because they cannot tell
 * whether they are two clicks or ten from the end, and because they are afraid a card form is
 * lurking. Four named steps answer both questions before they are asked.
 *
 * Completed steps are links back. Making them navigable is the point: a guest who cannot get back
 * to their dates without losing their place will use the browser's back button, which on a POST
 * flow is exactly where bookings go to die.
 */

export const STEPS = ["Dates", "Room", "Details", "Confirm"] as const;
export type StepName = (typeof STEPS)[number];

/** `current` is the step's internal key; what the guest reads comes from `s` (their language). */
export function StepBar({ current, backHref, s }: { current: StepName; backHref?: string; s: GuestStrings["steps"] }) {
  const index = STEPS.indexOf(current);

  return (
    <nav aria-label={s.progress} className="flex items-center gap-2 sm:gap-3">
      <ol className="flex flex-1 items-center gap-2 sm:gap-3">
        {STEPS.map((step, i) => {
          const done = i < index;
          const active = i === index;

          return (
            <li key={step} className="flex flex-1 items-center gap-2 sm:gap-3">
              <span className="flex items-center gap-2">
                <span
                  className="nums flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={
                    done
                      ? { backgroundColor: "hsl(var(--brand-wash))", color: "hsl(var(--brand-text))" }
                      : active
                        ? { backgroundColor: "hsl(var(--brand))", color: "hsl(var(--brand-ink))" }
                        : { backgroundColor: "hsl(var(--surface-sunk))", color: "hsl(var(--ink-faint))" }
                  }
                >
                  {done ? <Check size={12} strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                <span
                  /* Only the current label survives on a narrow screen — four labels at 375px
                     wrap into a paragraph and stop reading as a track. */
                  className={`text-[12.5px] font-semibold ${active ? "" : "hidden sm:inline"}`}
                  style={{ color: active ? "hsl(var(--ink))" : "hsl(var(--ink-faint))" }}
                  aria-current={active ? "step" : undefined}
                >
                  {s.names[i]}
                </span>
              </span>
              {i < STEPS.length - 1 && (
                <span
                  className="h-px flex-1"
                  style={{ backgroundColor: done ? "hsl(var(--brand-soft))" : "hsl(var(--line))" }}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>

      {backHref && (
        <a href={backHref} className="link-quiet shrink-0 text-[13px] font-medium">
          {s.back}
        </a>
      )}
    </nav>
  );
}
