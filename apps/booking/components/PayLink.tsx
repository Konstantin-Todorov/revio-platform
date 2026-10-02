"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeElementLocale } from "@stripe/stripe-js";
import { cssVar, stripeFor, type CardConfig } from "./CardPayment";
import { confirmLinkPayment, startLinkPayment } from "@/lib/actions-paylink";
import { useGuestKit } from "@/lib/i18n/use-kit";

/**
 * The card for a payment link: Stripe's own Payment Element (no card number reaches us), the amount
 * charged when the guest presses Pay — the booking already exists, so there is nothing to wait for.
 */
export function PayLink({ slug, token, amountMinor, config, payLabel }: {
  slug: string; token: string; amountMinor: number; config: CardConfig; payLabel: string;
}) {
  const stripe = useMemo(() => stripeFor(config.publishableKey, config.account), [config.publishableKey, config.account]);
  const [appearance, setAppearance] = useState<{ variables: Record<string, string> } | undefined>();
  useEffect(() => {
    setAppearance({ variables: { colorPrimary: cssVar("--brand", "#1f2937"), colorText: cssVar("--ink", "#1c2434"), borderRadius: "10px", fontSizeBase: "15px" } });
  }, []);
  if (!appearance) return <div className="h-[220px]" aria-hidden />;
  return (
    <Elements
      stripe={stripe}
      options={{ mode: "payment", amount: amountMinor, currency: config.currency.toLowerCase(), paymentMethodTypes: ["card"], appearance, locale: config.locale as StripeElementLocale }}
    >
      <Fields slug={slug} token={token} payLabel={payLabel} />
    </Elements>
  );
}

function Fields({ slug, token, payLabel }: { slug: string; token: string; payLabel: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { s } = useGuestKit();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    try {
      const submitted = await elements.submit();
      if (submitted.error) { setError(submitted.error.message ?? s.pay.failed); return; }
      const start = await startLinkPayment(slug, token);
      if (!start.ok) { setError(start.error); return; }
      const r = await stripe.confirmPayment({ elements, clientSecret: start.clientSecret, redirect: "if_required", confirmParams: { return_url: window.location.href } });
      if (r.error) { setError(r.error.message ?? s.pay.failed); return; }
      const done = await confirmLinkPayment(slug, token, r.paymentIntent.id);
      if (!done.ok) { setError(done.error); return; }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-6 p-5">
      <PaymentElement options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto", link: "never" } }} />
      {error && <p className="mt-3 text-[13px] font-semibold" style={{ color: "hsl(var(--caution))" }} role="alert">{error}</p>}
      <button type="button" onClick={pay} disabled={busy || !stripe} className="btn btn-brand mt-4 w-full">
        {busy ? s.pay.paying : payLabel}
      </button>
    </div>
  );
}
