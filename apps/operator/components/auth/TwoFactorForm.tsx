"use client";

import { useActionState } from "react";
import { OtpInput } from "@revio/ui/otp-input";
import { verifyTwoFactor, type LoginResult } from "@/lib/actions-auth";

const inputCls =
  "h-12 w-full rounded-md border border-surface-border bg-white px-3 text-center text-[20px] font-semibold tracking-[0.4em] text-ink-900 outline-none transition-colors placeholder:tracking-normal placeholder:text-[14px] placeholder:font-normal placeholder:text-ink-400 focus:border-brand-600";

export function TwoFactorForm() {
  const [state, formAction, pending] = useActionState<LoginResult | null, FormData>(verifyTwoFactor, null);

  return (
    <form action={formAction} className="space-y-3.5">
      <label className="block">
        <span className="mb-1 block text-[12.5px] font-semibold text-ink-700">Authentication code</span>
        {/* Submits itself on the sixth digit — this screen exists to receive a code and nothing
            else, so making someone reach for a button afterwards is a step for its own sake. */}
        <OtpInput className={inputCls} ariaDescribedBy="code-hint" />
      </label>
      <p id="code-hint" className="text-[12px] text-ink-500">
        Open your authenticator app and enter the current six-digit code — it submits on the last digit.
        You can also use one of your recovery codes.
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
