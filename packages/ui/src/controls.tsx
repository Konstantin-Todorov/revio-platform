import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";

/**
 * The control kit.
 *
 * These are server-safe on purpose — no `"use client"`, no state. Every one is markup plus classes,
 * so a screen can use them without shipping JavaScript for a button. The two controls that genuinely
 * need state (`Menu`, `Tabs`) live in their own client modules beside this one.
 *
 * ## Every control obeys the two motion rules
 *
 * 1. **Never transition colour alone.** Each has elevation or transform in its transition, so
 *    pointing at it produces weight rather than a hue change.
 * 2. **A visible `:focus-visible` ring.** The global rule in each app's `globals.css` covers anything
 *    that does not opt out; these declare their own where the shape needs a better-fitting ring than
 *    a rectangle outline.
 *
 * ## Why a kit at all, given the global rules already reached everything
 *
 * The global rules fixed the *elements that exist*. They cannot make the next screen consistent —
 * two developers writing a "secondary button" from scratch produce two different heights, two
 * radii and two hover states, which is how the product drifted in the first place. This is the
 * answer to "what should I type", not a retrofit.
 */

/* ─────────────────────────────────────────────────────────────── button ── */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-semibold " +
  "outline-none transition-colors duration-fast ease-standard " +
  "active:translate-y-px active:scale-[.985] active:duration-75 " +
  "disabled:pointer-events-none disabled:opacity-45";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand-800 text-white hover:bg-brand-700 hover:shadow-raised hover:-translate-y-px focus-visible:shadow-focus",
  secondary:
    "border border-surface-border bg-white text-ink-700 hover:bg-surface-page hover:border-ink-300 " +
    "hover:shadow-float hover:-translate-y-px focus-visible:shadow-focus",
  ghost: "text-ink-500 hover:bg-surface-muted hover:text-ink-900 focus-visible:shadow-focus",
  danger: "bg-danger-600 text-white hover:bg-danger-500 hover:shadow-raised hover:-translate-y-px focus-visible:shadow-focus-danger",
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[12.5px]",
  md: "h-9 px-3.5 text-[13px]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      // `data-tone` lets the global danger focus-ring rule find destructive controls anywhere,
      // including ones not built from this component.
      data-tone={variant === "danger" ? "danger" : undefined}
      className={`${BTN_BASE} ${BTN_SIZE[size]} ${BTN_VARIANT[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────── field ── */

/**
 * A labelled text input.
 *
 * The label is a real `<label>` above the field rather than a placeholder doing double duty: a
 * placeholder disappears the moment someone types, so a half-filled form stops saying what its
 * values are — which matters most on the long forms this product is full of.
 */
export function Field({
  label,
  hint,
  error,
  className = "",
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const fid = id ?? `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={fid} className="text-[12px] font-semibold text-ink-700">
        {label}
      </label>
      <input
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fid}-msg` : undefined}
        className={
          "h-9 w-full rounded-md border bg-white px-3 text-[13.5px] text-ink-900 outline-none " +
          "transition-colors duration-fast ease-standard placeholder:text-ink-400 " +
          "focus:shadow-focus disabled:bg-surface-muted disabled:text-ink-400 " +
          (error ? "border-danger-600 focus:border-danger-600" : "border-surface-border hover:border-ink-300 focus:border-brand-600")
        }
        {...rest}
      />
      {(error || hint) && (
        <p id={`${fid}-msg`} className={`text-[11.5px] ${error ? "text-danger-600" : "text-ink-400"}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  className = "",
  id,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  const fid = id ?? `s-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={fid} className="text-[12px] font-semibold text-ink-700">
        {label}
      </label>
      <select
        id={fid}
        className={
          "h-9 w-full cursor-pointer rounded-md border border-surface-border bg-white px-2.5 text-[13.5px] " +
          "text-ink-900 outline-none transition-colors duration-fast ease-standard " +
          "hover:border-ink-300 focus:border-brand-600 focus:shadow-focus"
        }
        {...rest}
      >
        {children}
      </select>
      {hint && <p className="text-[11.5px] text-ink-400">{hint}</p>}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────── chip ── */

/**
 * A filter chip.
 *
 * `aria-pressed` rather than a `checked` look: this is a toggle button, and a screen reader should
 * say "pressed" instead of leaving the state to colour, which is the same reason StatusPill carries
 * a dot as well as a tint.
 */
export function Chip({
  active = false,
  count,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-semibold " +
        "outline-none transition-colors duration-fast ease-standard focus-visible:shadow-focus " +
        "hover:-translate-y-px hover:shadow-float " +
        (active
          ? "border-brand-800 bg-brand-800 text-white "
          : "border-surface-border bg-white text-ink-600 hover:border-ink-300 ") +
        className
      }
      {...rest}
    >
      {children}
      {count != null && <span className="tnum text-[11px] opacity-70">{count}</span>}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────── switch/box ── */

export function Switch({
  label,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-700 ${className}`}>
      <span className="relative inline-flex">
        <input type="checkbox" className="peer sr-only" {...rest} />
        <span
          className={
            "h-5 w-9 rounded-full bg-ink-300 transition-colors duration-base ease-standard " +
            "peer-checked:bg-success-500 peer-focus-visible:shadow-focus"
          }
        />
        <span
          aria-hidden="true"
          className={
            "pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm " +
            "transition-transform duration-base ease-standard peer-checked:translate-x-4"
          }
        />
      </span>
      {label}
    </label>
  );
}

export function Checkbox({
  label,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-700 ${className}`}>
      <input
        type="checkbox"
        className={
          "h-4 w-4 shrink-0 cursor-pointer rounded border-surface-border text-brand-600 " +
          "outline-none transition-colors duration-fast ease-standard focus-visible:shadow-focus"
        }
        {...rest}
      />
      {label}
    </label>
  );
}
