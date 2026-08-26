"use client";

import { useActionState } from "react";
import { requestReset, setPassword, type AccountResult } from "@/lib/actions-account";
import { SetPasswordFields } from "@revio/ui/set-password-fields";

const inputCls =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-[14px] text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600";
const btnCls =
  "h-10 w-full rounded-md bg-brand-800 text-[14px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AccountResult | null, FormData>(requestReset, null);

  // Deliberately the same panel whether or not the address exists.
  if (state?.sent) {
    return (
      <div className="rounded-md border border-surface-border bg-white px-4 py-3.5 text-[13px] text-ink-700">
        <p className="font-semibold text-ink-900">Check your email</p>
        <p className="mt-1 text-ink-500">
          If that address has an account, a reset link is on its way. It works once and expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3.5">
      <label className="block">
        <span className="mb-1 block text-[12.5px] font-semibold text-ink-700">Email</span>
        <input name="email" type="email" required autoComplete="email" className={inputCls} placeholder="you@hotel.com" />
      </label>
      <button type="submit" disabled={pending} className={btnCls}>
        {pending ? "Sending…" : "Email me a link"}
      </button>
    </form>
  );
}

export function SetPasswordForm({
  token,
  purpose,
  email,
}: {
  token: string;
  purpose: "invite" | "reset";
  email: string;
}) {
  const [state, formAction, pending] = useActionState<AccountResult | null, FormData>(setPassword, null);

  return (
    <form action={formAction} className="space-y-3.5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="purpose" value={purpose} />
      <SetPasswordFields
        email={email}
        purpose={purpose}
        submitClassName="h-10 w-full rounded-md bg-accent-600 hover:bg-accent-500 text-[14px] font-semibold text-white transition-colors disabled:opacity-60"
        inputFocusClassName="focus:border-accent-600"
        pending={pending}
        {...(state?.error ? { error: state.error } : {})}
      />
    </form>
  );
}
