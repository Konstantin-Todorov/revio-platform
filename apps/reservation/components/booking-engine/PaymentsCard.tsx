"use client";

import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { bookingEngine as beDict } from "@/lib/i18n/booking-engine";

import { useState, useTransition } from "react";
import { Check, CreditCard, ExternalLink, RefreshCw, X } from "lucide-react";
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
export interface LiveConnectStatus {
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  businessName: string | null;
  email: string | null;
  currentlyDue: string[];
  pastDue: string[];
  disabledReason: string | null;
  error: string | null;
}

/** Stripe's requirement codes → what a hotelier recognises. Grouped, so ten codes read as three things. */
function requirementGroups(codes: string[]): Array<"bank" | "terms" | "business" | "identity" | "person" | "company" | "owners" | "other"> {
  const out = new Set<"bank" | "terms" | "business" | "identity" | "person" | "company" | "owners" | "other">();
  for (const c of codes) {
    if (c.startsWith("external_account")) out.add("bank");
    else if (c.startsWith("tos_acceptance")) out.add("terms");
    else if (c.startsWith("business_profile")) out.add("business");
    else if (c.includes("verification.document") || c.includes("verification.additional_document")) out.add("identity");
    else if (c.startsWith("individual") || c.startsWith("representative") || c.startsWith("person_")) out.add("person");
    else if (c.startsWith("company")) out.add("company");
    else if (/^(owners|directors|executives)/.test(c)) out.add("owners");
    else out.add("other");
  }
  return [...out];
}

export function PaymentsCard({
  chargesEnabled,
  hasAccount,
  checkedAt,
  mode,
  stale = false,
  status = null,
  storedDisagrees = false,
}: {
  /** An id from demo mode while real keys are configured: not an account — connect again. */
  stale?: boolean;
  /** What Stripe says right now. Null before any account exists. */
  status?: LiveConnectStatus | null;
  /** The booking page's stored flag is behind Stripe — "Check again" brings it up to date. */
  storedDisagrees?: boolean;
  chargesEnabled: boolean;
  hasAccount: boolean;
  checkedAt: Date | null;
  /** "mock" when no Stripe test key is configured — say so rather than implying a real connection. */
  mode: "mock" | "stripe_test";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const locale = useLocale();
  const P = translate(beDict, locale).payments;

  function connect() {
    setError(null);
    start(async () => {
      const res = await startStripeOnboarding();
      if (!res.ok || !res.url) return setError(res.error ?? P.failed);
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
              {chargesEnabled ? P.instant : P.requests}
            </div>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-500">
              {chargesEnabled ? (
                <>
                  {P.connectedLead}<strong className="font-semibold text-ink-700">{P.connectedBold}</strong>{P.connectedTail}
                </>
              ) : hasAccount ? (
                <>
                  {P.verifying}
                </>
              ) : (
                <>
                  {P.notConnected}
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
          {chargesEnabled ? P.badge.connected : hasAccount ? P.badge.verifying : P.badge.none}
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
            {pending ? P.opening : hasAccount ? P.continue : P.connect}
          </button>
        )}
        {hasAccount && (
          <form action={refreshStripeStatus}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" /> {P.checkAgain}
            </button>
          </form>
        )}
      </div>

      {stale && (
        <p className="rounded-md bg-warning-50 px-3 py-2 text-[12.5px] font-medium text-warning-700">{P.stale}</p>
      )}

      {/* The checklist a hotelier actually asks about: is it my account, does Stripe have what it
          needs, can it take cards, will it pay me — and if not, exactly what is missing. */}
      {status && (
        <div className="rounded-lg border border-surface-border">
          {(status.businessName || status.email) && (
            <p className="border-b border-surface-border px-3.5 py-2.5 text-[12.5px] text-ink-600">
              {P.account}: <strong className="font-semibold text-ink-900">{status.businessName ?? "—"}</strong>
              {status.email ? ` · ${status.email}` : ""}
            </p>
          )}
          <ul className="space-y-1.5 px-3.5 py-3 text-[12.5px]">
            {([
              [status.detailsSubmitted, P.check.details],
              [chargesEnabled, P.check.charges],
              [status.payoutsEnabled, P.check.payouts],
            ] as const).map(([ok, label]) => (
              <li key={label} className="flex items-center gap-2">
                {ok
                  ? <Check className="h-4 w-4 shrink-0 text-success-600" aria-label={P.yes} />
                  : <X className="h-4 w-4 shrink-0 text-warning-600" aria-label={P.no} />}
                <span className={ok ? "text-ink-700" : "font-semibold text-ink-900"}>{label}</span>
              </li>
            ))}
          </ul>
          {(status.currentlyDue.length > 0 || status.pastDue.length > 0) && (
            <div className="border-t border-surface-border px-3.5 py-3 text-[12.5px]">
              <p className="font-semibold text-ink-900">{status.pastDue.length > 0 ? P.pastDueTitle : P.dueTitle}</p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-ink-600">
                {requirementGroups([...status.pastDue, ...status.currentlyDue]).map((g) => <li key={g}>{P.req[g]}</li>)}
              </ul>
              <p className="mt-2 text-[12px] text-ink-500">{P.dueHow}</p>
            </div>
          )}
          {status.error && (
            <p className="border-t border-surface-border px-3.5 py-2.5 text-[12px] text-danger-600">{P.stripeSaid(status.error)}</p>
          )}
        </div>
      )}
      {storedDisagrees && <p className="text-[12px] text-ink-500">{P.storedBehind}</p>}
      {mode === "stripe_test" && <p className="text-[11.5px] font-semibold text-warning-700">{P.testMode}</p>}

      {/* Never imply a live connection that does not exist. A demo that claims to be wired to Stripe
          is the kind of thing somebody repeats to a client. */}
      {mode === "mock" && (
        <p className="text-[11.5px] text-ink-400">
          {P.demo}
        </p>
      )}
      {checkedAt && (
        <p className="text-[11.5px] text-ink-400">
          {P.lastChecked(checkedAt.toLocaleString(locale === "en" ? undefined : "bg-BG"))}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-[12px] font-medium text-danger-600">{error}</p>
      )}
    </div>
  );
}
