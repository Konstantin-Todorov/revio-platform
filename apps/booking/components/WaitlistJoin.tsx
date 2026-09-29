"use client";

import { useActionState } from "react";
import { joinWaitlist, type JoinResult } from "@/lib/actions-waitlist";
import { ActionForm } from "@revio/ui/action-form";
import { useGuestKit } from "@/lib/i18n/use-kit";

/**
 * "Tell me if a room opens."
 *
 * Sits **beside** the alternative stays, never instead of them. Alternatives convert today; a
 * waitlist converts maybe, and replacing a real bookable option with a maybe would trade revenue
 * for a mailing list.
 *
 * ## What it deliberately does not say
 *
 * No queue position. The position is real and derived from `createdAt`, but it moves for reasons a
 * guest cannot see — someone ahead converts, someone else cancels — and a number that goes **up**
 * reads as a bug in our software rather than as somebody else's good luck.
 *
 * No "we'll find you something". We say what is true: if a room opens for these dates, we email,
 * and it is held long enough to book. Everything else is the hotel's to promise, not ours.
 */
export function WaitlistJoin({
  slug,
  checkIn,
  checkOut,
  guests,
  nights,
}: {
  slug: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
}) {
  const [state, action, pending] = useActionState<JoinResult | null, FormData>(joinWaitlist, null);
  const { s: t } = useGuestKit();
  const s = t.waitlist;

  if (state?.ok) {
    return (
      <div
        className="mt-5 rounded-[var(--r-md)] border p-4 text-[13.5px]"
        style={{ borderColor: "hsl(var(--line))", backgroundColor: "hsl(var(--surface-sunk))" }}
        role="status"
      >
        <strong className="block text-[14px]" style={{ color: "hsl(var(--brand-text))" }}>
          {s.joinedTitle}
        </strong>
        <span style={{ color: "hsl(var(--ink-soft))" }}>{state.message}</span>
      </div>
    );
  }

  return (
    <ActionForm
      action={action} state={state}
      className="mt-5 rounded-[var(--r-md)] border p-4"
      style={{ borderColor: "hsl(var(--line))", backgroundColor: "hsl(var(--surface-sunk))" }}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="checkIn" value={checkIn} />
      <input type="hidden" name="checkOut" value={checkOut} />
      <input type="hidden" name="guests" value={guests} />

      <p className="text-[14px] font-semibold" style={{ color: "hsl(var(--brand-text))" }}>
        {s.title}
      </p>
      <p className="mt-0.5 text-[13px]" style={{ color: "hsl(var(--ink-soft))" }}>
        {s.body(nights)}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="sr-only" htmlFor="wl-name">{s.name}</label>
        <input
          id="wl-name"
          name="name"
          required
          autoComplete="name"
          placeholder={s.name}
          className="h-10 w-full rounded-[var(--r-sm)] border px-3 text-[14px] outline-none transition-colors focus:border-[hsl(var(--brand))]"
          style={{ borderColor: "hsl(var(--line-strong))", backgroundColor: "hsl(var(--surface))" }}
        />
        <label className="sr-only" htmlFor="wl-email">{s.email}</label>
        <input
          id="wl-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="h-10 w-full rounded-[var(--r-sm)] border px-3 text-[14px] outline-none transition-colors focus:border-[hsl(var(--brand))]"
          style={{ borderColor: "hsl(var(--line-strong))", backgroundColor: "hsl(var(--surface))" }}
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-[var(--r-sm)] px-4 text-[14px] font-semibold text-white transition-colors disabled:opacity-60"
          style={{ backgroundColor: "hsl(var(--brand))" }}
        >
          {pending ? s.adding : s.tellMe}
        </button>
      </div>

      {state?.error && (
        <p className="mt-2 text-[12.5px]" role="alert" style={{ color: "hsl(var(--danger, 0 70% 45%))" }}>
          {state.error}
        </p>
      )}
    </ActionForm>
  );
}
