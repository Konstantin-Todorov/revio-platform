"use client";

import { useEffect, useMemo, useState, type MutableRefObject } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe, type StripeElementLocale } from "@stripe/stripe-js";
import { startCardPayment } from "@/lib/actions-book";

/**
 * The card, entered in Stripe's own Payment Element — an iframe served by Stripe, so no card number
 * ever touches this page, our server or our database. It handles 3-D Secure in place, and shows
 * Apple Pay / Google Pay first on a device that has them.
 *
 * The card is charged on the HOTEL's Stripe account (`stripeAccount`), so the money settles to them.
 *
 * `payRef` is how the form's submit reaches in: submit the fields → ask the server for an intent
 * (it re-derives the amount) → confirm it here → hand the intent id back for the booking to verify.
 */
export type PayOutcome = { ok: true; intentId: string } | { ok: false; error: string };
export type Pay = (fd: FormData) => Promise<PayOutcome>;

export interface CardConfig {
  publishableKey: string;
  /** The hotel's connected account; null only in local platform-test mode. */
  account: string | null;
  currency: string;
  locale: string;
}

const cache = new Map<string, Promise<Stripe | null>>();
function stripeFor(pk: string, account: string | null): Promise<Stripe | null> {
  const k = `${pk}:${account ?? ""}`;
  if (!cache.has(k)) cache.set(k, loadStripe(pk, account ? { stripeAccount: account } : undefined));
  return cache.get(k)!;
}

/** Reads the page's own brand colour so the card fields wear the hotel's colour, not Stripe's blue. */
function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v.replace(/\s+/g, " ")})` : fallback;
}

export function CardPayment({
  config, amountMinor, payRef, notReady,
}: {
  config: CardConfig;
  /** Taken now. 0 = a guarantee: the card is saved, nothing is charged. */
  amountMinor: number;
  payRef: MutableRefObject<Pay | null>;
  notReady: string;
}) {
  const [kind] = useState<"payment" | "setup">(amountMinor > 0 ? "payment" : "setup");
  const stripe = useMemo(() => stripeFor(config.publishableKey, config.account), [config.publishableKey, config.account]);
  const [appearance, setAppearance] = useState<{ variables: Record<string, string> } | undefined>(undefined);
  useEffect(() => {
    setAppearance({
      variables: {
        colorPrimary: cssVar("--brand", "#1f2937"),
        colorText: cssVar("--ink", "#1c2434"),
        borderRadius: "10px",
        fontSizeBase: "15px",
      },
    });
  }, []);

  // The options must describe the same intent the server will create: manual capture and a card
  // saved for later for a payment; off-session use for a guarantee.
  const options =
    kind === "payment"
      ? { mode: "payment" as const, amount: Math.max(1, amountMinor), currency: config.currency.toLowerCase(),
          captureMethod: "manual" as const, setupFutureUsage: "off_session" as const, paymentMethodTypes: ["card"] }
      : { mode: "setup" as const, currency: config.currency.toLowerCase(), paymentMethodTypes: ["card"] };

  if (!appearance) return <div className="h-[168px]" aria-hidden />;
  return (
    <Elements stripe={stripe} options={{ ...options, appearance, locale: config.locale as StripeElementLocale }}>
      <CardFields kind={kind} amountMinor={amountMinor} payRef={payRef} notReady={notReady} />
    </Elements>
  );
}

function CardFields({ kind, amountMinor, payRef, notReady }: {
  kind: "payment" | "setup"; amountMinor: number; payRef: MutableRefObject<Pay | null>; notReady: string;
}) {
  const stripe = useStripe();
  const elements = useElements();

  // Extras move the amount; the wallet sheets (Apple Pay, Google Pay) show it, so keep it true.
  useEffect(() => {
    if (elements && kind === "payment" && amountMinor > 0) elements.update({ amount: amountMinor });
  }, [elements, kind, amountMinor]);

  useEffect(() => {
    payRef.current = async (fd) => {
      if (!stripe || !elements) return { ok: false, error: notReady };
      // First, before any network call: wallets need the guest's tap to still be "fresh".
      const submitted = await elements.submit();
      if (submitted.error) return { ok: false, error: submitted.error.message ?? notReady };
      const start = await startCardPayment(fd);
      if (!start.ok) return { ok: false, error: start.error };
      const returnUrl = window.location.href;
      if (start.kind === "payment") {
        const r = await stripe.confirmPayment({ elements, clientSecret: start.clientSecret, redirect: "if_required", confirmParams: { return_url: returnUrl } });
        if (r.error) return { ok: false, error: r.error.message ?? notReady };
        return { ok: true, intentId: r.paymentIntent.id };
      }
      const r = await stripe.confirmSetup({ elements, clientSecret: start.clientSecret, redirect: "if_required", confirmParams: { return_url: returnUrl } });
      if (r.error) return { ok: false, error: r.error.message ?? notReady };
      return { ok: true, intentId: r.setupIntent.id };
    };
    return () => { payRef.current = null; };
  }, [stripe, elements, payRef, notReady]);

  return <PaymentElement options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }} />;
}
