"use client";

import { useActionState, useState } from "react";
import { ArrowRight, BedDouble, CalendarCheck, Radio } from "lucide-react";
import { submitSignup, type SignupResult } from "@/lib/actions-signup";

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
    need: "Stop the OTAs double-booking my rooms",
    product: "RevioLink",
    detail: "Availability, rates and restrictions pushed to every channel, bookings pulled back.",
  },
  {
    key: "crs",
    icon: CalendarCheck,
    need: "Take bookings direct and keep them in order",
    product: "RevioCRS",
    // ⚠️ Not "commission-free" — see the note on the signup page. We charge 2% on RevioDirect.
    detail: "Every reservation from every source, plus your own direct booking page.",
  },
  {
    key: "pms",
    icon: BedDouble,
    need: "Run the front desk and housekeeping",
    product: "RevioPMS",
    detail: "Check-in and out, room status, folios and the night audit.",
  },
] as const;

const inputCls =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-[13.5px] text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-600";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<SignupResult | null, FormData>(submitSignup, null);
  const [intent, setIntent] = useState<string>("cm");

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">Your hotel</span>
          <input name="hotelName" required autoComplete="organization" placeholder="Hotel Cabacum Beach" className={inputCls} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">Your name</span>
            <input name="ownerName" required autoComplete="name" placeholder="Maria Ivanova" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">Work email</span>
            <input name="email" type="email" required autoComplete="email" placeholder="you@yourhotel.com" className={inputCls} />
          </label>
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
          What do you need most right now?
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
                    {n.need}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-ink-500">
                    {n.detail} <span className="text-ink-400">— {n.product}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] leading-snug text-ink-500">
          You get <strong className="font-semibold text-ink-700">all three for 30 days</strong> whichever you pick —
          this only decides where we open first. They share one login and one set of rooms and rates, so there is
          nothing to move if you keep more than one.
        </p>
      </fieldset>

      {state?.error && (
        <p role="alert" className="rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2 text-[12.5px] text-danger-700">
          {state.error}
        </p>
      )}

      <button
        disabled={pending}
        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-brand-800 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Setting things up…" : "Start my free trial"}
        {!pending && <ArrowRight className="h-4 w-4" />}
      </button>

      <p className="text-center text-[11.5px] leading-snug text-ink-400">
        No card needed. We'll email you a link to confirm your address and choose a password.
      </p>
    </form>
  );
}
