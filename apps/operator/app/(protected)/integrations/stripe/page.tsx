import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDashed, ExternalLink, XCircle } from "lucide-react";
import { Card, PageHeader, StatusPill } from "@/components/ui/primitives";
import { getStripeConnection, stripeModeStatus, type StripeConnection } from "@/lib/integrations";
import { getOperatorSession } from "@/lib/session";
import { StripeModeSwitch } from "@/components/integrations/StripeModeSwitch";
import { testStripeConnection, removeStripeKey } from "@/lib/actions-integrations";
import { StripeKeyDialog } from "@/components/integrations/StripeKeyDialog";
import type { StripeMode } from "@/lib/stripe-key";

export const dynamic = "force-dynamic";

/**
 * The Stripe connection: what is installed, what Stripe says about it, and what is still missing.
 *
 * ## Both modes are shown at once, on purpose
 *
 * The alternative — one panel with a mode switch — hides the fact that sandbox and live are
 * **different accounts holding different data**. Customer ids, payment methods and intents created
 * under one do not exist under the other, so "switching" is not a view change, it is a change of
 * which account the platform is talking to. Two panels side by side make that structural rather than
 * something to remember.
 *
 * ## Why the readiness list is not a green tick
 *
 * A key that authenticates is not a working payment setup. It can lack a publishable key (no payment
 * form), lack a webhook secret (we never hear that a payment succeeded), or belong to an account
 * Stripe has not finished verifying (`charges_enabled: false`). Each of those fails at a different
 * moment and none of them fails at the moment you paste the key — so they are listed as steps with
 * their own state, and the panel is honest about being partly done.
 */

function ago(d: Date): string {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: 2 }).format(minor / 100);
}

/** One readiness step. `null` means "not applicable yet", which is not the same as failing. */
function Step({ done, label, detail }: { done: boolean | null; label: string; detail: string }) {
  const Icon = done === true ? CheckCircle2 : done === false ? XCircle : CircleDashed;
  const tone = done === true ? "text-success-600" : done === false ? "text-danger-600" : "text-ink-300";
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <Icon className={`mt-[1px] h-4 w-4 shrink-0 ${tone}`} />
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-ink-800">{label}</div>
        <div className="text-[11.5px] leading-relaxed text-ink-400">{detail}</div>
      </div>
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-[12.5px] font-semibold text-ink-800">{value}</dd>
    </div>
  );
}

function ModePanel({ conn, inUse }: { conn: StripeConnection; inUse: boolean }) {
  const live = conn.mode === "live";
  const a = conn.account;
  /*
   * Our invoices are priced and charged in EUR (`pricing.ts`, `Invoice.currency`). Stripe will take
   * a EUR charge on an account of any default currency and convert on payout — so a mismatch is not
   * a fault, it is a conversion the founder should know about rather than discover in a payout.
   */
  const currencyDiffers = !!a?.defaultCurrency && a.defaultCurrency !== "EUR";

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-bold text-ink-900">{live ? "Live" : "Sandbox"}</h3>
            {/* Live is red wherever it appears. It is the word that means real cards. */}
            {live && (
              <span className="rounded bg-danger-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-danger-700">
                real money
              </span>
            )}
            {inUse && <StatusPill tone={live ? "danger" : "neutral"}>in use</StatusPill>}
            {!conn.configured ? (
              <StatusPill tone="neutral">not set up</StatusPill>
            ) : conn.credentialProblem ? (
              <StatusPill tone="danger">cannot decrypt</StatusPill>
            ) : conn.lastCheckOk === null ? (
              <StatusPill tone="warning">never tested</StatusPill>
            ) : (
              <StatusPill tone={conn.lastCheckOk ? "success" : "danger"}>{conn.lastCheckOk ? "working" : "rejected"}</StatusPill>
            )}
          </div>
          <p className="mt-1 text-[11.5px] text-ink-400">
            {live
              ? "Charges real cards. Nothing here should be switched on until a rehearsal in sandbox has worked end to end."
              : "Test cards only. Nothing that happens here moves money, which is what makes it safe to rehearse in."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {conn.configured && (
            <form action={testStripeConnection}>
              <input type="hidden" name="mode" value={conn.mode} />
              <button
                type="submit"
                className="rounded-md border border-surface-border px-2.5 py-1 text-[11.5px] font-semibold text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-700"
              >
                Check now
              </button>
            </form>
          )}
          <StripeKeyDialog mode={conn.mode as StripeMode} hasKey={conn.configured} />
        </div>
      </div>

      {conn.configured && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="tnum rounded bg-surface-sunken px-2 py-1 text-[11.5px] font-semibold text-ink-700">{conn.hint}</span>
          {conn.updatedBy && (
            <span className="text-[11px] text-ink-400">
              set by {conn.updatedBy}
              {conn.updatedAt && ` · ${ago(conn.updatedAt)}`}
            </span>
          )}
        </div>
      )}

      {conn.lastCheckMessage && (
        <p
          className={`mb-3 rounded-md px-3 py-2 text-[12px] leading-relaxed ${
            conn.lastCheckOk === false
              ? "bg-danger-50 text-danger-700"
              : conn.lastCheckOk === null
                ? "bg-warning-50 text-warning-700"
                : "bg-surface-sunken text-ink-600"
          }`}
        >
          {conn.lastCheckMessage}
          {conn.lastCheckedAt && <span className="opacity-70"> · {ago(conn.lastCheckedAt)}</span>}
        </p>
      )}

      {conn.credentialProblem && (
        <p className="mb-3 rounded-md bg-danger-50 px-3 py-2 text-[12px] leading-relaxed text-danger-700">
          {conn.credentialProblem}
        </p>
      )}

      {/* What Stripe itself said, last time we asked. Recorded rather than fetched on render: one
          live API call per page load would make our console as slow as Stripe's worst minute. */}
      {a && (
        <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-md bg-surface-sunken px-3 py-3">
          <Fact label="Account" value={a.displayName ?? a.accountId} />
          <Fact label="Account id" value={a.displayName ? a.accountId : null} />
          <Fact label="Country" value={a.country} />
          <Fact label="Default currency" value={a.defaultCurrency} />
          <Fact label="Email" value={a.email} />
          {a.balances.length > 0 && (
            <div className="col-span-2">
              <dt className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400">Balance</dt>
              <dd className="mt-0.5 space-y-0.5">
                {a.balances.map((b) => (
                  <div key={b.currency} className="tnum text-[12.5px] font-semibold text-ink-800">
                    {money(b.availableMinor, b.currency)} available
                    {b.pendingMinor !== 0 && (
                      <span className="font-normal text-ink-400"> · {money(b.pendingMinor, b.currency)} pending</span>
                    )}
                  </div>
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}

      {currencyDiffers && (
        <p className="mb-3 rounded-md bg-warning-50 px-3 py-2 text-[12px] leading-relaxed text-warning-700">
          This Stripe account settles in <strong className="font-semibold">{a!.defaultCurrency}</strong>,
          and we invoice in EUR. Charges are still taken in EUR — Stripe converts on payout, at its
          own rate and fee. Nothing is broken; it is the difference between what a hotel is billed
          and what lands in the bank.
        </p>
      )}

      <ul className="border-t border-surface-border pt-2">
        <Step
          done={conn.configured ? (conn.secretState === "decryption_error" ? false : conn.lastCheckOk) : null}
          label="Server API key"
          detail={
            conn.secretState === "decryption_error"
              ? "Stored, but unreadable with the current CONNECTIVITY_SECRET. Repair the rotation or replace it."
              : conn.configured
              ? "Stored encrypted (AES-256-GCM) and never shown again. Prefer a restricted rk_ key with only the permissions this path needs."
              : "Not set. Create a restricted API key in Stripe with Account read, Balance read and Checkout Sessions write."
          }
        />
        <Step
          done={conn.configured ? a?.chargesEnabled ?? null : null}
          label="Stripe will accept charges"
          detail={
            a?.chargesEnabled === false
              ? "Stripe says no — verification is still outstanding on this account. Finish it in the Stripe dashboard."
              : a?.chargesEnabled
                ? "Stripe confirms this account can take payments."
                : "Unknown until the connection is checked. This is Stripe's opinion, never ours."
          }
        />
        <Step
          done={conn.configured ? !!conn.publishableKey : null}
          label="Publishable key"
          detail={
            conn.publishableKey
              ? "Stored for a future embedded form; Stripe-hosted Checkout does not use it."
              : "Optional. Stripe-hosted Checkout does not need a publishable key."
          }
        />
        <Step
          done={conn.configured ? (conn.webhookSecretState === "decryption_error" ? false : conn.hasWebhookSecret) : null}
          label="Webhook signing secret"
          detail={
            conn.webhookSecretState === "decryption_error"
              ? "Stored, but unreadable with the current CONNECTIVITY_SECRET. Genuine payment events cannot be verified."
              : conn.hasWebhookSecret
              ? "Incoming events can be verified as genuinely from Stripe."
              : "Not set. Until it is, we would never hear that a payment succeeded — and an unverified webhook is an open write endpoint wearing Stripe's name."
          }
        />
      </ul>

      {conn.configured && (
        <form action={removeStripeKey} className="mt-2 border-t border-surface-border pt-2">
          <input type="hidden" name="mode" value={conn.mode} />
          <button
            type="submit"
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
          >
            Remove this key
          </button>
        </form>
      )}
    </Card>
  );
}

export default async function StripePage() {
  const [test, live, modeStatus, session] = await Promise.all([
    getStripeConnection("test"),
    getStripeConnection("live"),
    stripeModeStatus(),
    getOperatorSession(),
  ]);

  return (
    <div>
      <Link
        href="/integrations"
        className="mb-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-400 transition-colors hover:text-ink-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Integrations
      </Link>

      <PageHeader
        title="Stripe"
        subtitle="Our own Stripe account, so a hotel can pay its subscription by card instead of being chased for a bank transfer."
      />

      {/*
        * Whose account this is, said first.
        *
        * There are two entirely different Stripe stories in this platform and confusing them is
        * expensive: THIS one is our account collecting our subscription revenue. The other is a
        * hotel's own account collecting from its guests, which is Connect and deliberately never
        * touches our balance. Somebody arriving here needs to know which page they are on.
        */}
      <div className="mb-4 max-w-[74ch] rounded-md border border-surface-border bg-surface-sunken px-3.5 py-3">
        <p className="text-[12.5px] leading-relaxed text-ink-600">
          <strong className="font-semibold text-ink-800">This is our own account</strong> — money from
          hotels paying us. It is a different thing from the hotel&rsquo;s own Stripe account that
          takes deposits from its guests: that one is Connect, the funds never enter our balance, and
          it is configured per hotel.
        </p>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-500">
          Keys are pasted here, encrypted before they are stored, and never shown again — only the
          last four characters. They are tested against Stripe before being saved, and a key Stripe
          rejects is refused rather than kept.
        </p>
      </div>

      {/* Which environment is in use, above both panels: it is the question somebody arriving here
          needs answered before they read anything else on the page. */}
      <StripeModeSwitch
        mode={modeStatus.mode}
        problem={modeStatus.problem}
        canEdit={session?.role === "super_admin"}
        liveReady={
          live.configured
          && live.lastCheckOk === true
          && live.account?.chargesEnabled === true
          && live.secretState === "ready"
          && live.webhookSecretState === "ready"
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <ModePanel conn={test} inUse={modeStatus.mode === "test"} />
        <ModePanel conn={live} inUse={modeStatus.mode === "live"} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[11.5px]">
        <a
          href="https://dashboard.stripe.com/test/apikeys"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 font-semibold text-accent-600 hover:underline"
        >
          Stripe test API keys <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <a
          href="https://dashboard.stripe.com/apikeys"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 font-semibold text-accent-600 hover:underline"
        >
          Stripe live API keys <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <p className="mt-3 max-w-[74ch] text-[11.5px] leading-relaxed text-ink-400">
        A test key and a live key belong to separate accounts that cannot see each other&rsquo;s data.
        Customers, saved cards and payment intents created in one do not exist in the other, so
        moving from sandbox to live does not carry anything across — anything stored has to be
        collected again.
      </p>
    </div>
  );
}
