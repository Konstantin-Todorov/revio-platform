"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Lock, ShieldCheck } from "lucide-react";
import { extrasTotalMinor, stayTerms, type SellableExtra, type StayTermsPolicy } from "@revio/core";
import { CardPayment, type CardConfig, type Pay } from "./CardPayment";
import { confirmBooking, type BookResult } from "@/lib/actions-book";
import { ExtrasPicker } from "./ExtrasPicker";
import { setExtrasTotal } from "@/lib/extras-store";
import { ActionForm } from "@revio/ui/action-form";
import { SubmitTokenField } from "@revio/ui/submit-token";
import { useGuestKit } from "@/lib/i18n/use-kit";

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
  /** Children's ages, "4,7" — empty when none. */
  ages: string;
  /** The promo code, re-checked on the server — empty when none. */
  promo: string;
  roomTypeId: string;
  ratePlanId: string;
  holdId: string;
}

export function BookingForm({
  stay,
  cancellationPolicy,
  termsDetails,
  expiresAt,
  paymentReady,
  extras,
  nights,
  currency,
  card = null,
  termsPolicy = null,
  base,
  group = null,
  fixedPayNowMinor,
  privacy,
}: {
  /** The hotel's name and its privacy notice, stated beside the box the guest ticks (GDPR Art. 13). */
  privacy: { hotel: string; url: string; external: boolean };
  /** Several rooms: the slots, their picks and their holds, posted with the form. */
  group?: { rooms: string; sel: string; holds: string } | null;
  /** Several rooms: what leaves the card today, summed on the server from each room's own terms. */
  fixedPayNowMinor?: number;
  stay: StaySelection;
  cancellationPolicy: string | null;
  /** The rate's terms, already in the guest's words (`termsWords`). Null when the plan states none. */
  termsDetails: string[] | null;
  /** When the hold lapses. Drives the countdown, and the reason this screen has any urgency at all. */
  expiresAt: string;
  /**
   * Whether the hotel can take a card guarantee (Stripe `charges_enabled` on its own account).
   *
   * False switches this screen to **request-to-book**: the card panel disappears entirely rather
   * than being disabled, because a greyed-out card field asks the guest to wonder what is broken.
   * The promise on the button changes with it — "Request this room" is a different commitment from
   * "Confirm booking", and only one of them is true here.
   */
  paymentReady: boolean;
  /** What the hotel offers. Empty is normal and renders nothing at all. */
  extras: SellableExtra[];
  nights: number;
  /** Currency code, passed down to the picker. Never a formatter — see ExtrasPicker. */
  currency: string;
  /** The card form, when the hotel can take one. Null = request-to-book. */
  card?: CardConfig | null;
  /** The rate's rule and the stay's facts, so "pay now" follows the extras the guest ticks. */
  termsPolicy?: StayTermsPolicy | null;
  base?: { totalMinor: number; firstNightMinor: number; arrival: string; today: string };
}) {
  const { s: t, money } = useGuestKit();
  const s = t.book;
  const payRef = useRef<Pay | null>(null);
  // The card is confirmed with Stripe BEFORE the booking is sent; the booking then verifies it.
  const [state, action, pending] = useActionState<BookResult | null, FormData>(async (prev, fd) => {
    if (card) {
      const paid = payRef.current ? await payRef.current(fd) : { ok: false as const, error: t.errors.card };
      if (!paid.ok) return { ok: false, error: paid.error };
      fd.set("intentId", paid.intentId);
    }
    return confirmBooking(prev, fd);
  }, null);

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

  /*
   * Chosen extras, and the running total.
   *
   * Computed in the browser purely so the summary moves the instant a box is ticked — the SERVER
   * re-derives every amount from the catalogue on submit (`resolveChosenExtras`). This number is a
   * preview of the truth, never the source of it, which is why the form posts ids.
   */
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const extrasMinor = extrasTotalMinor(extras.filter((e) => chosen.has(e.id)), nights);
  // What leaves the card today — the same function the server charges by, on the same total.
  const payNowMinor = fixedPayNowMinor != null
    ? fixedPayNowMinor
    : termsPolicy && base
      ? stayTerms(termsPolicy, { ...base, totalMinor: base.totalMinor + extrasMinor }).payNowMinor
      : 0;
  const toggleExtra = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Publishes to the shared store the summary card reads — see lib/extras-store.
      setExtrasTotal(extrasTotalMinor(extras.filter((e) => next.has(e.id)), nights));
      return next;
    });

  return (
    <ActionForm action={action} state={state} className="space-y-5">
      {group && (
        <>
          <input type="hidden" name="rooms" value={group.rooms} />
          <input type="hidden" name="sel" value={group.sel} />
          <input type="hidden" name="holds" value={group.holds} />
        </>
      )}
      {(Object.keys(stay) as (keyof StaySelection)[]).map((k) => (
        <input key={k} type="hidden" name={k} value={String(stay[k])} />
      ))}

      {/* One-time token: a double press or a retried request confirms one booking, not two. */}
      <SubmitTokenField />
      <HoldCountdown expiresAt={expiresAt} expired={s.holdExpired} holding={s.holding} />

      <section className="card-raised p-5 sm:p-6">
        <h2 className="display text-[1.25rem]">{s.whoTitle}</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={s.firstName} optionalLabel={s.optional} name="firstName" autoComplete="given-name" required
                 value={guest.firstName} onValue={set("firstName")} />
          <Field label={s.lastName} optionalLabel={s.optional} name="lastName" autoComplete="family-name" required
                 value={guest.lastName} onValue={set("lastName")} />
          <Field label={s.email} optionalLabel={s.optional} name="email" type="email" autoComplete="email" required
                 value={guest.email} onValue={set("email")}
                 hint={s.emailHint} />
          <Field label={s.phone} optionalLabel={s.optional} name="phone" type="tel" autoComplete="tel"
                 value={guest.phone} onValue={set("phone")}
                 hint={s.phoneHint} />
        </div>

        <div className="mt-3">
          <label htmlFor="note" className="mb-1.5 block text-[12.5px] font-semibold">
            {s.note} <span className="font-normal" style={{ color: "hsl(var(--ink-faint))" }}>{s.optional}</span>
          </label>
          <textarea
            id="note"
            name="note"
            rows={2}
            maxLength={500}
            value={guest.note}
            onChange={(e) => set("note")(e.target.value)}
            placeholder={s.notePlaceholder}
            className="w-full rounded-[var(--r-sm)] border px-3 py-2 text-[14px] outline-none"
            style={{ borderColor: "hsl(var(--line-strong))", backgroundColor: "hsl(var(--surface))" }}
          />
          <p className="mt-1 text-[12px]" style={{ color: "hsl(var(--ink-faint))" }}>
            {s.noteHint}
          </p>
        </div>
      </section>

      {/*
        The extras slot, filled (K10) from the hotel's OWN catalogue — the same `PosItem` rows the
        front desk posts, so there is no second list to drift. It sits AFTER the room is chosen and
        before the card on purpose: an upsell next to the price on the results page would turn the
        headline figure into a starting price, which is exactly the promise this product makes.
      */}
      <ExtrasPicker
        extras={extras}
        nights={nights}
        chosen={chosen}
        onToggle={toggleExtra}
        currency={currency}
      />

      <section className="card-raised p-5 sm:p-6">
        <h2 className="display text-[1.25rem]">
          {paymentReady ? s.holdingTitle : s.nextTitle}
        </h2>
        <div
          className="mt-4 flex items-start gap-3 rounded-[var(--r-sm)] p-4"
          style={{ backgroundColor: "hsl(var(--brand-wash))" }}
        >
          <Lock size={17} aria-hidden className="mt-0.5 shrink-0" style={{ color: "hsl(var(--brand-text))" }} />
          <div className="text-[13.5px] leading-relaxed">
            {paymentReady && payNowMinor > 0 ? (
              <>
                <p className="font-bold">{s.payNowBold(money(payNowMinor, currency))}</p>
                <p className="mt-1" style={{ color: "hsl(var(--ink-soft))" }}>
                  {s.payNowBody}{" "}
                  <strong className="font-semibold">{s.guaranteeStrong}</strong> {s.guaranteeTail}
                </p>
              </>
            ) : paymentReady ? (
              <>
                <p className="font-bold">{s.guaranteeBold}</p>
                <p className="mt-1" style={{ color: "hsl(var(--ink-soft))" }}>
                  {s.guaranteeBody}{" "}
                  <strong className="font-semibold">{s.guaranteeStrong}</strong> {s.guaranteeTail}
                </p>
              </>
            ) : (
              /* Say what actually happens. "The hotel will confirm" is a weaker promise than an
                 instant booking, and pretending otherwise is how a guest arrives at a room nobody
                 kept for them. The room genuinely is held while they decide, so we say that too. */
              <>
                <p className="font-bold">{s.requestBold}</p>
                <p className="mt-1" style={{ color: "hsl(var(--ink-soft))" }}>
                  {s.requestBody}
                </p>
              </>
            )}
          </div>
        </div>

        {card && (
          <div className="mt-4">
            <CardPayment config={card} amountMinor={payNowMinor} payRef={payRef} notReady={t.errors.card} />
          </div>
        )}

        {termsDetails ? (
          <div className="mt-3 flex items-start gap-2 text-[13px]" style={{ color: "hsl(var(--ink-soft))" }}>
            <ShieldCheck size={15} aria-hidden className="mt-0.5 shrink-0" style={{ color: "hsl(var(--positive))" }} />
            <div>
              <strong className="font-semibold" style={{ color: "hsl(var(--ink))" }}>{s.terms}</strong>
              <ul className="mt-1 space-y-0.5">
                {termsDetails.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </div>
          </div>
        ) : cancellationPolicy && (
          <p className="mt-3 flex items-start gap-2 text-[13px]" style={{ color: "hsl(var(--ink-soft))" }}>
            <ShieldCheck size={15} aria-hidden className="mt-0.5 shrink-0" style={{ color: "hsl(var(--positive))" }} />
            <span>
              <strong className="font-semibold" style={{ color: "hsl(var(--ink))" }}>{s.cancellation}</strong>{" "}
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
            {s.accept}
            {paymentReady ? (payNowMinor > 0 ? s.acceptPay : s.acceptCard) : ""}.
          </span>
        </label>
        <p className="mt-2 pl-[26px] text-[12.5px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>
          {s.privacyNote(privacy.hotel)}{" "}
          <a
            href={privacy.url}
            target="_blank"
            rel={privacy.external ? "noopener noreferrer" : undefined}
            className="link-quiet font-semibold underline"
          >
            {s.privacyLink}
          </a>
        </p>
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
        {pending
          ? paymentReady ? s.confirming : s.sending
          : paymentReady ? s.confirm : s.request}
      </button>
      <p className="text-center text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>
        {paymentReady ? s.confirmHint : s.requestHint}
      </p>
    </ActionForm>
  );
}

function Field({
  label, optionalLabel, name, type = "text", required, autoComplete, hint, value, onValue,
}: {
  label: string;
  optionalLabel: string;
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
          <span className="font-normal" style={{ color: "hsl(var(--ink-faint))" }}> · {optionalLabel}</span>
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
function HoldCountdown({ expiresAt, expired, holding }: { expiresAt: string; expired: string; holding: string }) {
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
        {expired}
      </p>
    );
  }

  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, "0");
  return (
    <p className="text-[13px]" style={{ color: "hsl(var(--ink-soft))" }} role="status">
      {holding}{" "}
      <strong className="nums font-bold" style={{ color: "hsl(var(--ink))" }}>{m}:{s}</strong>.
    </p>
  );
}
