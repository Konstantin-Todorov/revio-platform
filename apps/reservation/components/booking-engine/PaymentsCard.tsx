"use client";

import { useState, useTransition } from "react";
import { CreditCard, ExternalLink, RefreshCw } from "lucide-react";
import { startStripeOnboarding, refreshStripeStatus } from "@/lib/actions-booking-engine";

/**
 * Taking payment — the hotel's own Stripe account.
 *
 * The screen's job is to make one thing obvious: **you can sell right now either way.** Without a
 * connected account the engine still takes bookings, as requests the hotel accepts by hand. That is
 * the difference between a setup step that blocks revenue and one that improves it, and a hotel
 * halfway through Stripe's verification queue should feel the second.
 *
 * So the unconnected state is described as a working mode with a downside, not as an error. No red,
 * no warning triangle — those are for things that are broken, and this is not.
 */
export function PaymentsCard({
  chargesEnabled,
  hasAccount,
  checkedAt,
  mode,
}: {
  chargesEnabled: boolean;
  hasAccount: boolean;
  checkedAt: Date | null;
  /** "mock" when no Stripe test key is configured — say so rather than implying a real connection. */
  mode: "mock" | "stripe_test";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function connect() {
    setError(null);
    start(async () => {
      const res = await startStripeOnboarding();
      if (!res.ok || !res.url) return setError(res.error ?? "Stripe could not start onboarding.");
      // Stripe's link is single-use and short-lived, so it is followed immediately rather than
      // rendered as a link somebody might come back to tomorrow.
      window.location.href = res.url;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          <div>
            <div className="text-[13px] font-bold text-ink-900">
              {chargesEnabled ? "Guests book instantly" : "Guests send requests"}
            </div>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-500">
              {chargesEnabled ? (
                <>
                  Your Stripe account is connected, so a guest&rsquo;s card guarantees the room and the
                  booking is confirmed on the spot. <strong className="font-semibold text-ink-700">
                  The money goes straight to you</strong> — it never passes through Revio.
                </>
              ) : hasAccount ? (
                <>
                  Stripe is still checking your details. Until it finishes, bookings arrive as
                  requests for you to accept — the room is held for the guest in the meantime, so
                  nothing is lost.
                </>
              ) : (
                <>
                  Connect Stripe and guests get an instant confirmation with a card guarantee, paid
                  to you directly. Until then your page still sells: bookings arrive as requests you
                  accept, and the room is held while you decide.
                </>
              )}
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${
            chargesEnabled ? "bg-success-50 text-success-600" : "bg-surface-muted text-ink-500"
          }`}
        >
          {chargesEnabled ? "Connected" : hasAccount ? "Verifying" : "Not connected"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!chargesEnabled && (
          <button
            type="button"
            onClick={connect}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {pending ? "Opening Stripe…" : hasAccount ? "Continue on Stripe" : "Connect Stripe"}
          </button>
        )}
        {hasAccount && (
          <form action={refreshStripeStatus}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Check again
            </button>
          </form>
        )}
      </div>

      {/* Never imply a live connection that does not exist. A demo that claims to be wired to Stripe
          is the kind of thing somebody repeats to a client. */}
      {mode === "mock" && (
        <p className="text-[11.5px] text-ink-400">
          Demo mode — no Stripe key is configured, so connecting is simulated and no real account is
          created.
        </p>
      )}
      {checkedAt && (
        <p className="text-[11.5px] text-ink-400">
          Last checked with Stripe {checkedAt.toLocaleString()}.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-[12px] font-medium text-danger-600">{error}</p>
      )}
    </div>
  );
}
