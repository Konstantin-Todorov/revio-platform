import type { ReactNode } from "react";

/**
 * The four surface primitives every staff app draws its screens out of.
 *
 * They lived as four near-identical copies in `apps/*&#47;components/ui/primitives.tsx` — three
 * byte-identical and the operator's differing only by a missing `subtitle`. That is the definition
 * of a shared package: a second caller had already appeared, four times over. The app-local files
 * are now re-export shims, so no call site moved.
 *
 * ## Two surface treatments, and they do not layer
 *
 * `flat` is the original: a 1px border with a tight contact shadow under it. The border does the
 * separating and the shadow is invisible — correct for dense operational screens (the ARI calendar,
 * the housekeeping board, a rates grid), where a visible edge is what lets the eye follow a row
 * across a table.
 *
 * `float` drops the border and separates with a wide, soft blur against a non-white page ground.
 * It reads as premium because nothing is boxed. It is for the screens that are *read* rather than
 * *scanned* — dashboards, analytics, onboarding, auth.
 *
 * Choosing per screen is the point. A borderless card inside a dense table loses the row; a boxed
 * card on a dashboard looks like a spreadsheet. Neither treatment is the better one.
 */
export type Surface = "flat" | "float";

const SURFACE: Record<Surface, string> = {
  flat: "rounded-lg border border-surface-border bg-white shadow-card",
  // No border by design — adding one back cancels the blur and you get a boxed card with a smudge.
  float: "rounded-xl bg-white shadow-float",
};

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE: Record<Tone, string> = {
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  info: "bg-accent-50 text-accent-600",
  neutral: "bg-surface-sunken text-ink-500",
};
const DOT: Record<Tone, string> = {
  success: "bg-success-500", warning: "bg-warning-500", danger: "bg-danger-500",
  info: "bg-accent-500", neutral: "bg-ink-300",
};

/** Status encoded by dot + label — never colour alone (Atlas rule). */
export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${TONE[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
  surface = "float",
}: {
  children: ReactNode;
  className?: string;
  /**
   * Defaults to `float` — the house style. Pass `"flat"` on dense operational screens (the ARI
   * calendar, the housekeeping board, a rates grid), where a visible edge is what lets the eye
   * follow a row across a table. Pass it to `CardHeader` too, or the header loses its rule while
   * the card keeps its border.
   */
  surface?: Surface;
}) {
  return <section className={`${SURFACE[surface]} ${className}`}>{children}</section>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  surface = "float",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  surface?: Surface;
}) {
  // A floated card has no outline, so an internal rule would be the only hard line on it — the
  // padding does the separating instead, and the title gets the room the extra size needs.
  const frame =
    surface === "float"
      ? "px-5 pt-5 pb-3"
      : "border-b border-surface-border px-4 py-3";
  const heading = surface === "float" ? "text-[15px]" : "text-[13.5px]";

  return (
    <div className={`flex items-center justify-between gap-3 ${frame}`}>
      <div>
        <h2 className={`${heading} font-bold tracking-tight text-ink-900`}>{title}</h2>
        {subtitle && <p className="mt-0.5 text-[11.5px] text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
