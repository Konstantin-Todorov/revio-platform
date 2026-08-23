"use client";

import { useActionState } from "react";
import { verifyTwoFactor, type LoginResult } from "@/lib/actions-auth";

const inputCls =
  "h-12 w-full rounded-md border border-surface-border bg-white px-3 text-center text-[20px] font-semibold tracking-[0.4em] text-ink-900 outline-none transition-colors placeholder:tracking-normal placeholder:text-[14px] placeholder:font-normal placeholder:text-ink-400 focus:border-brand-600";

export function TwoFactorForm() {
  const [state, formAction, pending] = useActionState<LoginResult | null, FormData>(verifyTwoFactor, null);

  return (
    <form action={formAction} className="space-y-3.5">
      <label className="block">
        <span className="mb-1 block text-[12.5px] font-semibold text-ink-700">Authentication code</span>
        <input
          name="code"
          required
          /* `one-time-code` is what lets a phone offer the code from the SMS/authenticator sheet, and
             `autoFocus` matters here more than anywhere: this screen exists to be typed into and
             nothing else is on it. */
          autoComplete="one-time-code"
          autoFocus
          /* NOT inputMode="numeric": a recovery code is letters and a dash, and forcing a number pad
             would make the fallback path unusable on the device most likely to need it. */
          className={inputCls}
          placeholder="123456"
          aria-describedby="code-hint"
        />
      </label>
      <p id="code-hint" className="text-[12px] text-ink-500">
        Open your authenticator app and enter the current six-digit code. You can also use one of your
        recovery codes.
      </p>

      {state?.error && (
        <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-10 w-full rounded-md bg-brand-800 text-[14px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Checking…" : "Verify"}
      </button>
    </form>
  );
}
