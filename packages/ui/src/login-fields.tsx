"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * The fields every staff sign-in screen needs, in one place.
 *
 * There were four of these — RevioLink, RevioCRS, RevioPMS and the Operator console — and they were
 * byte-identical apart from an accent colour and a placeholder. Four copies meant every omission was
 * made four times, and all four were missing the same things: no way to reveal a password, nothing
 * announced to a screen reader when a sign-in failed, no `aria-invalid`, and no warning about the
 * single most common reason a correct password is rejected.
 *
 * There is deliberately **no sign-up link**. Hotel and operator accounts are provisioned — by us for
 * a hotel's owner, by a super-admin for operator staff — so a "create an account" link would lead
 * nowhere. Somebody stuck at this screen is told what to do instead of being left to guess.
 */

export interface LoginFieldsProps {
  /** Tailwind classes for the primary button; each product carries its own accent. */
  submitClassName: string;
  /** Tailwind focus-border class for inputs, matching the same accent. */
  inputFocusClassName: string;
  emailPlaceholder: string;
  /** Rendered under the form — how somebody without an account gets one. */
  accessNote: React.ReactNode;
  pending: boolean;
  error?: string;
  /** Shown after a password reset completes, so the person knows the new one is live. */
  justSet?: boolean;
  forgotHref?: string;
}

export function LoginFields({
  submitClassName,
  inputFocusClassName,
  emailPlaceholder,
  accessNote,
  pending,
  error,
  justSet = false,
  forgotHref = "/forgot-password",
}: LoginFieldsProps) {
  const [reveal, setReveal] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const inputCls = `h-10 w-full rounded-md border bg-white px-3 text-[14px] text-ink-900 outline-none transition-colors placeholder:text-ink-400 ${inputFocusClassName}`;
  const borderCls = error ? "border-danger-500" : "border-surface-border";

  return (
    <>
      <label className="block" htmlFor={emailId}>
        <span className="mb-1 block text-[12.5px] font-semibold text-ink-700">Email</span>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          // Both fields are marked, not just the password: the server deliberately does not say
          // WHICH was wrong (that would confirm an address exists), so highlighting one would be a
          // guess the interface is not entitled to make.
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${inputCls} ${borderCls}`}
          placeholder={emailPlaceholder}
        />
      </label>

      <label className="block" htmlFor={passwordId}>
        <span className="mb-1 block text-[12.5px] font-semibold text-ink-700">Password</span>
        <div className="relative">
          <input
            id={passwordId}
            name="password"
            type={reveal ? "text" : "password"}
            required
            autoComplete="current-password"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            // Caps Lock is the commonest reason a correct password is refused, and the one thing the
            // person cannot see themselves while the characters are dots.
            onKeyUp={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
            onBlur={() => setCapsLock(false)}
            className={`${inputCls} ${borderCls} pr-10`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            // A control that toggles gets `aria-pressed`, and its label says what the NEXT press
            // does — "Show password" while hidden — which is what a screen-reader user needs.
            aria-pressed={reveal}
            aria-label={reveal ? "Hide password" : "Show password"}
            // Never in the tab order between the password and the submit button: a keyboard user
            // tabbing out of the password expects to reach "Sign in", not a toggle.
            tabIndex={-1}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-2 text-ink-400 transition-colors hover:text-ink-700"
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {capsLock && (
          <p className="mt-1 text-[11.5px] font-medium text-warning-600">Caps Lock is on.</p>
        )}
      </label>

      {/* Unticked by default on purpose: the front desk is a shared machine with guests standing at
          it, and a box that remembers by default is how a terminal ends up permanently signed in. */}
      <label className="flex items-center gap-2 pt-0.5">
        <input type="checkbox" name="remember" className="h-4 w-4 rounded border-surface-border" />
        <span className="text-[12.5px] text-ink-600">Keep me signed in on this device</span>
      </label>

      {justSet && !error && (
        <p className="rounded-md bg-success-50 px-3 py-2 text-[12.5px] font-medium text-success-600">
          Password saved. Sign in with it now.
        </p>
      )}

      {error && (
        // `role="alert"` is the whole point: without it a failed sign-in is a silent visual change,
        // and a screen-reader user is left waiting for something that already happened.
        <p id={errorId} role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className={submitClassName}>
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="pt-1 text-center text-[12.5px]">
        <a href={forgotHref} className="font-semibold text-brand-700 hover:underline">
          Forgot your password?
        </a>
      </p>

      <p className="text-center text-[11.5px] leading-relaxed text-ink-400">{accessNote}</p>
    </>
  );
}
