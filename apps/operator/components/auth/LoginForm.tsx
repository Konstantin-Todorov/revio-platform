"use client";

import { useActionState } from "react";
import { LoginFields } from "@revio/ui/login-fields";
import { login, type LoginResult } from "@/lib/actions-auth";

/**
 * Sign-in for this product.
 *
 * The fields live in `@revio/ui/login-fields` because these four forms were identical apart from an
 * accent colour and a placeholder — so every omission was made four times, and every fix had to be.
 * What differs per product stays here; what should never differ does not.
 */
export function LoginForm({ justSet = false, defaultEmail }: { justSet?: boolean; defaultEmail?: string }) {
  const [state, formAction, pending] = useActionState<LoginResult | null, FormData>(login, null);

  return (
    <form action={formAction} className="space-y-3.5">
      <LoginFields
        submitClassName="h-10 w-full rounded-md bg-brand-800 hover:bg-brand-700 text-[14px] font-semibold text-white transition-colors disabled:opacity-60"
        inputFocusClassName="focus:border-brand-600"
        emailPlaceholder="operator@revio.app"
        accessNote="Operator accounts are created by a super-admin in Settings. There is no sign-up — if you need access, ask a colleague to invite you."
        pending={pending}
        error={state?.error}
        justSet={justSet}
        {...(defaultEmail ? { defaultEmail } : {})}
      />
    </form>
  );
}
