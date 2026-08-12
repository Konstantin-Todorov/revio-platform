"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type LoginResult } from "@/lib/actions-auth";

const inputCls =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-[14px] text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-accent-600";

export function LoginForm({ justSet = false }: { justSet?: boolean }) {
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

      {justSet && !state?.error && (
        <p className="rounded-md bg-success-50 px-3 py-2 text-[12.5px] font-medium text-success-600">
          Password saved. Sign in with it now.
        </p>
      )}

      {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="h-10 w-full rounded-md bg-accent-600 text-[14px] font-semibold text-white transition-colors hover:bg-accent-500 disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="pt-1 text-center text-[12.5px]">
        <Link href="/forgot-password" className="font-semibold text-brand-700 hover:underline">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
