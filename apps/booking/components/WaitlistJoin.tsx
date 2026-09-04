"use client";

import { useActionState } from "react";
import { joinWaitlist, type JoinResult } from "@/lib/actions-waitlist";

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

  if (state?.ok) {
    return (
      <div
        className="mt-5 rounded-[var(--r-md)] border p-4 text-[13.5px]"
        style={{ borderColor: "hsl(var(--line))", backgroundColor: "hsl(var(--surface-sunk))" }}
        role="status"
      >
        <strong className="block text-[14px]" style={{ color: "hsl(var(--brand-text))" }}>
          You&rsquo;re on the list
        </strong>
        <span style={{ color: "hsl(var(--ink-soft))" }}>{state.message}</span>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="mt-5 rounded-[var(--r-md)] border p-4"
      style={{ borderColor: "hsl(var(--line))", backgroundColor: "hsl(var(--surface-sunk))" }}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="checkIn" value={checkIn} />
      <input type="hidden" name="checkOut" value={checkOut} />
      <input type="hidden" name="guests" value={guests} />

      <p className="text-[14px] font-semibold" style={{ color: "hsl(var(--brand-text))" }}>
        We can tell you if something opens up
      </p>
      <p className="mt-0.5 text-[13px]" style={{ color: "hsl(var(--ink-soft))" }}>
        For {nights === 1 ? "that night" : `those ${nights} nights`}. One email, only if a room
        actually becomes free.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="sr-only" htmlFor="wl-name">Your name</label>
        <input
          id="wl-name"
          name="name"
          required
          autoComplete="name"
          placeholder="Your name"
          className="h-10 w-full rounded-[var(--r-sm)] border px-3 text-[14px] outline-none transition-colors focus:border-[hsl(var(--brand))]"
          style={{ borderColor: "hsl(var(--line-strong))", backgroundColor: "hsl(var(--surface))" }}
        />
        <label className="sr-only" htmlFor="wl-email">Email address</label>
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
          {pending ? "Adding…" : "Tell me"}
        </button>
      </div>

      {state?.error && (
        <p className="mt-2 text-[12.5px]" role="alert" style={{ color: "hsl(var(--danger, 0 70% 45%))" }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
