"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Lock, ShieldCheck } from "lucide-react";
import { confirmBooking, type BookResult } from "@/lib/actions-book";

/**
 * Step 3 — who you are, and the card that holds the room.
 *
 * There are no card fields. That is deliberate, not unfinished: a card guarantee is created through
 * the gateway (@revio/payments), so no card number ever reaches this form, this server or this
 * database. Saying so on screen is also the most reassuring thing on the page — "nothing is charged"
 * is a claim, "we never see your card" is a fact about how it is built.
 *
 * Only identifiers are posted. The price is recomputed server-side from the same engine that quoted
 * it, so editing a hidden field changes what is booked, never what is paid.
 */

export interface StaySelection {
  slug: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  roomTypeId: string;
  ratePlanId: string;
  holdId: string;
}

export function BookingForm({
  stay,
  cancellationPolicy,
  expiresAt,
}: {
  stay: StaySelection;
  cancellationPolicy: string | null;
  /** When the hold lapses. Drives the countdown, and the reason this screen has any urgency at all. */
  expiresAt: string;
}) {
  const [state, action, pending] = useActionState<BookResult | null, FormData>(confirmBooking, null);

  /*
   * The guest's own words are held in React state, not left to the DOM.
   *
   * `<form action={…}>` **resets uncontrolled fields on every dispatch** — that is React's
   * behaviour, not a bug in it. So any rejection the server makes (the hold lapsed while they were
   * typing, the last room went, the card guarantee failed) hands back an error message above four
   * blank boxes. Being asked to retype your name and email at the moment something already went
   * wrong is how a booking becomes an abandoned tab.
   *
   * Controlled inputs are the whole fix: the values survive the round trip, so the guest fixes the
   * one thing that was wrong and presses the button again.
   */
  const [guest, setGuest] = useState({ firstName: "", lastName: "", email: "", phone: "", note: "" });
  const set = (k: keyof typeof guest) => (v: string) => setGuest((g) => ({ ...g, [k]: v }));

  return (
    <form action={action} className="space-y-5">
      {(Object.keys(stay) as (keyof StaySelection)[]).map((k) => (
        <input key={k} type="hidden" name={k} value={String(stay[k])} />
      ))}

      <HoldCountdown expiresAt={expiresAt} />

      <section className="card-raised p-5 sm:p-6">
        <h2 className="display text-[1.25rem]">Who's staying?</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="First name" name="firstName" autoComplete="given-name" required
                 value={guest.firstName} onValue={set("firstName")} />
          <Field label="Last name" name="lastName" autoComplete="family-name" required
                 value={guest.lastName} onValue={set("lastName")} />
          <Field label="Email" name="email" type="email" autoComplete="email" required
                 value={guest.email} onValue={set("email")}
                 hint="Your confirmation goes here." />
          <Field label="Phone" name="phone" type="tel" autoComplete="tel"
                 value={guest.phone} onValue={set("phone")}
                 hint="Only if the hotel needs to reach you." />
        </div>

        <div className="mt-3">
          <label htmlFor="note" className="mb-1.5 block text-[12.5px] font-semibold">
            Anything we should know? <span className="font-normal" style={{ color: "hsl(var(--ink-faint))" }}>Optional</span>
          </label>
          <textarea
            id="note"
            name="note"
            rows={2}
            maxLength={500}
            value={guest.note}
            onChange={(e) => set("note")(e.target.value)}
            placeholder="Late arrival, a quiet room, celebrating something…"
            className="w-full rounded-[var(--r-sm)] border px-3 py-2 text-[14px] outline-none"
            style={{ borderColor: "hsl(var(--line-strong))", backgroundColor: "hsl(var(--surface))" }}
          />
          <p className="mt-1 text-[12px]" style={{ color: "hsl(var(--ink-faint))" }}>
            Requests aren&rsquo;t guaranteed, but the hotel will see this before you arrive.
          </p>
        </div>
      </section>

      {/*
        The extras slot. K5 fills it with the hotel's own catalogue — breakfast, parking, a transfer.
        It sits AFTER the room is chosen and before the card on purpose: putting an upsell next to
        the price on the results page would undermine the one promise this product makes, that the
        first number you see is the number you pay.
      */}

      <section className="card-raised p-5 sm:p-6">
        <h2 className="display text-[1.25rem]">Holding your room</h2>
        <div
          className="mt-4 flex items-start gap-3 rounded-[var(--r-sm)] p-4"
          style={{ backgroundColor: "hsl(var(--brand-wash))" }}
        >
          <Lock size={17} aria-hidden className="mt-0.5 shrink-0" style={{ color: "hsl(var(--brand-text))" }} />
          <div className="text-[13.5px] leading-relaxed">
            <p className="font-bold">Nothing is charged now.</p>
            <p className="mt-1" style={{ color: "hsl(var(--ink-soft))" }}>
              Your card guarantees the room and you settle the whole amount at the hotel.{" "}
              <strong className="font-semibold">Your card details never reach us</strong> — they are
              held by our payment provider, and this booking page never sees a card number.
            </p>
          </div>
        </div>

        {cancellationPolicy && (
          <p className="mt-3 flex items-start gap-2 text-[13px]" style={{ color: "hsl(var(--ink-soft))" }}>
            <ShieldCheck size={15} aria-hidden className="mt-0.5 shrink-0" style={{ color: "hsl(var(--positive))" }} />
            <span>
              <strong className="font-semibold" style={{ color: "hsl(var(--ink))" }}>Cancellation:</strong>{" "}
              {cancellationPolicy}
            </span>
          </p>
        )}

        <label className="mt-4 flex cursor-pointer items-start gap-2.5">
          {/*
            `required` so the BROWSER stops the submit.

            The server checks this too and always will — a client check is a courtesy, not a
            control. But without the attribute the only thing that catches a missed tick is a round
            trip, and a round trip through a server action **resets the form**: the guest gets
            "please accept the conditions" next to four empty fields and has to retype their name,
            their email and their request. That is the single most expensive moment on the site to
            make somebody start again.
          */}
          <input
            type="checkbox"
            name="acceptTerms"
            required
            className="mt-0.5 h-4 w-4 cursor-pointer"
            style={{ accentColor: "hsl(var(--brand))" }}
          />
          <span className="text-[13px] leading-relaxed">
            I accept the booking conditions and the cancellation policy above, and I understand my
            card is used as a guarantee.
          </span>
        </label>
      </section>

      {state?.error && (
        <p
          className="flex items-start gap-2 rounded-[var(--r-sm)] px-4 py-3 text-[13.5px]"
          style={{ backgroundColor: "hsl(var(--caution) / 0.1)", color: "hsl(var(--caution))" }}
          role="alert"
        >
          <AlertCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-brand w-full text-[15px]">
        {pending ? "Confirming…" : "Confirm booking"}
      </button>
      <p className="text-center text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>
        You&rsquo;ll get a confirmation by email straight away.
      </p>
    </form>
  );
}

function Field({
  label, name, type = "text", required, autoComplete, hint, value, onValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
  /** Controlled — see the note in BookingForm about form resets eating the guest's typing. */
  value: string;
  onValue: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-[12.5px] font-semibold">
        {label}
        {!required && (
          <span className="font-normal" style={{ color: "hsl(var(--ink-faint))" }}> · optional</span>
        )}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        className="w-full rounded-[var(--r-sm)] border px-3 py-2.5 text-[14.5px] outline-none"
        style={{ borderColor: "hsl(var(--line-strong))", backgroundColor: "hsl(var(--surface))" }}
      />
      {hint && (
        <p className="mt-1 text-[12px]" style={{ color: "hsl(var(--ink-faint))" }}>{hint}</p>
      )}
    </div>
  );
}

/**
 * How long the room stays theirs.
 *
 * Real urgency, not theatre: the room genuinely is held, and it genuinely is released when this
 * reaches zero. That is the difference between this and the countdowns that made OTAs distrusted —
 * every other claim on this site is honest, and a fake timer here would cost all of them.
 */
function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const end = new Date(expiresAt).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // Rendered only once the client has a real number — a server-rendered countdown would hydrate
  // with a stale value and visibly jump.
  if (left === null) return null;

  if (left === 0) {
    return (
      <p
        className="rounded-[var(--r-sm)] px-4 py-3 text-[13.5px] font-semibold"
        style={{ backgroundColor: "hsl(var(--caution) / 0.1)", color: "hsl(var(--caution))" }}
        role="status"
      >
        Your hold has expired. You can still try to confirm — the room may well be free.
      </p>
    );
  }

  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, "0");
  return (
    <p className="text-[13px]" style={{ color: "hsl(var(--ink-soft))" }} role="status">
      We&rsquo;re holding this room for you for{" "}
      <strong className="nums font-bold" style={{ color: "hsl(var(--ink))" }}>{m}:{s}</strong>.
    </p>
  );
}
