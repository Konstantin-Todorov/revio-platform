"use client";

import { useActionState } from "react";
import { login, type LoginResult } from "@/lib/actions-auth";

const inputCls =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-[14px] text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginResult | null, FormData>(login, null);

  return (
    <form action={formAction} className="space-y-3.5">
      <label className="block">
        <span className="mb-1 block text-[12.5px] font-semibold text-ink-700">Email</span>
        <input name="email" type="email" required autoComplete="email" className={inputCls} placeholder="you@hotel.com" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[12.5px] font-semibold text-ink-700">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className={inputCls} placeholder="••••••••" />
      </label>

      {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="h-10 w-full rounded-md bg-brand-800 text-[14px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
