"use client";

import { useActionState, useState } from "react";
import { TurnstileField } from "@revio/ui/turnstile";
import { ArrowRight, BedDouble, CalendarCheck, Radio } from "lucide-react";
import { submitSignup, type SignupResult } from "@/lib/actions-signup";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { signup as signupDict } from "@/lib/i18n/signup";

/**
 * The one question a hotel is asked before it sees anything.
 *
 * ⚠️ **It is phrased in the hotel's words, never in ours.** "Which product do you want?" asks
 * somebody who has never heard of us to self-diagnose using a vocabulary they do not have, and they
 * can answer wrong. "What do you need most right now?" is a question a hotelier can always answer.
 *
 * ⚠️ **And it does not decide what they get — it decides where they land.** The trial covers all
 * three either way, which is the sentence under the options, because a hotel given the other two
 * silently will never find them. There is no wrong answer here, and saying so is the point.
 */
const NEEDS = [
  {
    key: "cm",
    icon: Radio,
    product: "RevioLink",
  },
  {
    key: "crs",
    icon: CalendarCheck,
    product: "RevioCRS",
    // ⚠️ Not "commission-free" — see the note on the signup page. We charge 2% on RevioDirect.
  },
  {
    key: "pms",
    icon: BedDouble,
    product: "RevioPMS",
  },
] as const;

const inputCls =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-[13.5px] text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-600";

export function SignupForm({ defaultEmail = "", siteKey }: { defaultEmail?: string; siteKey?: string | undefined }) {
  const [state, formAction, pending] = useActionState<SignupResult | null, FormData>(submitSignup, null);
  const [intent, setIntent] = useState<string>("cm");
  const f = translate(signupDict, useLocale()).form;

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">{f.hotel}</span>
          <input name="hotelName" required autoComplete="organization" placeholder={f.hotelPlaceholder} className={inputCls} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">{f.name}</span>
            <input name="ownerName" required autoComplete="name" placeholder={f.namePlaceholder} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">{f.email}</span>
            <input name="email" type="email" required autoComplete="email" defaultValue={defaultEmail} placeholder={f.emailPlaceholder} className={inputCls} />
          </label>
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
          {f.need}
        </legend>
        <input type="hidden" name="intent" value={intent} />
        <div className="space-y-1.5">
          {NEEDS.map((n) => {
            const on = intent === n.key;
            const Icon = n.icon;
            return (
              <button
                key={n.key}
                type="button"
                onClick={() => setIntent(n.key)}
                aria-pressed={on}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  on ? "border-brand-600 bg-brand-50" : "border-surface-border bg-white hover:border-ink-300"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                    on ? "bg-brand-700 text-white" : "bg-surface-sunken text-ink-400"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className={`block text-[13.5px] font-semibold ${on ? "text-brand-800" : "text-ink-800"}`}>
                    {f.needs[n.key].need}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-ink-500">
                    {f.needs[n.key].detail} <span className="text-ink-400">— {n.product}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] leading-snug text-ink-500">
          {f.allThreeBefore}<strong className="font-semibold text-ink-700">{f.allThreeStrong}</strong>{f.allThreeAfter}
        </p>
      </fieldset>

      {/* Renders nothing until a site key exists, so this ships safely before the keys do. */}
      <TurnstileField siteKey={siteKey} />

      {state?.error && (
        <p role="alert" className="rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2 text-[12.5px] text-danger-700">
          {state.error}
        </p>
      )}

      <button
        disabled={pending}
        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-brand-800 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? f.working : f.submit}
        {!pending && <ArrowRight className="h-4 w-4" />}
      </button>

      <p className="text-center text-[11.5px] leading-snug text-ink-400">
        {f.noCard}
      </p>
    </form>
  );
}
