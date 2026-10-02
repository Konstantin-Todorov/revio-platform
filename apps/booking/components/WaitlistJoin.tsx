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
        className="mx-auto mt-5 w-full max-w-md rounded-[var(--r)] border p-4 text-left text-[13.5px]"
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
      className="mx-auto mt-5 w-full max-w-md rounded-[var(--r)] border p-5 text-left"
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

      {/* Fields one under the other with their names on top: side by side in a centred column they
          were squeezed to a few characters, and a placeholder that cut off ("Вашето…") left a guest
          guessing what to type. */}
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-[12.5px] font-semibold" htmlFor="wl-name">{s.name}</label>
          <input
            id="wl-name"
            name="name"
            required
            autoComplete="name"
            className="h-11 w-full rounded-[var(--r-sm)] border px-3 text-[15px] outline-none transition-colors focus:border-[hsl(var(--brand))]"
            style={{ borderColor: "hsl(var(--line-strong))", backgroundColor: "hsl(var(--surface))" }}
          />
        </div>
        <div>
          <label className="mb-1 block text-[12.5px] font-semibold" htmlFor="wl-email">{s.email}</label>
          <input
            id="wl-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 w-full rounded-[var(--r-sm)] border px-3 text-[15px] outline-none transition-colors focus:border-[hsl(var(--brand))]"
            style={{ borderColor: "hsl(var(--line-strong))", backgroundColor: "hsl(var(--surface))" }}
          />
        </div>
        <button type="submit" disabled={pending} className="btn btn-brand w-full disabled:opacity-60">
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
