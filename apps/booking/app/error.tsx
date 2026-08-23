"use client";

/**
 * What a GUEST sees when something breaks mid-booking.
 *
 * This app had no error boundary at all, so a throw anywhere in the flow fell through to Next's
 * default page — a bare, unstyled apology, in front of a paying stranger, on the one screen in the
 * platform that wears the hotel's brand rather than ours. The four staff apps have had boundaries
 * since the production-readiness pass; the public one, which matters most, did not.
 *
 * Three things this copy is careful about, and each is a way guests get hurt by generic error text:
 *
 *  - **It does not claim the booking failed.** The throw may have happened AFTER the reservation was
 *    written — while rendering the confirmation, say. Telling someone their booking did not go
 *    through when it did produces a duplicate booking and a refund conversation.
 *  - **It never suggests re-entering card details.** No card details reach this page in the first
 *    place, and inviting a stranger to re-enter payment information after an error is the shape of
 *    every phishing page they have been trained to distrust.
 *  - **It points at the hotel, not at us.** The guest has a relationship with the hotel and none
 *    with Revio. "Contact support" would send them to the wrong company.
 *
 * The layout has rendered by the time this shows, so the hotel's brand tokens are available and the
 * page still looks like the hotel's own.
 */
export default function BookingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-[34rem] flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">Booking</p>
      <h1 className="display mt-3 text-[2rem]">Something went wrong on our side</h1>
      <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>
        This page didn&rsquo;t load properly. If you had already confirmed a booking, it is safe —
        check your email for the confirmation before trying again.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg px-5 py-2.5 text-[14px] font-semibold"
          style={{ background: "hsl(var(--brand))", color: "hsl(var(--brand-ink))" }}
        >
          Try again
        </button>
      </div>

      {/* The digest is the only thing that makes a guest's report actionable, and it is safe to show:
          it identifies the failure in our logs and reveals nothing about the hotel or its data. */}
      {error.digest && (
        <p className="mt-6 text-[12px]" style={{ color: "hsl(var(--ink-soft))" }}>
          If you contact the hotel about this, quote reference{" "}
          <span className="font-semibold">{error.digest}</span>.
        </p>
      )}
    </main>
  );
}
