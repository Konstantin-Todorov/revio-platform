import { hotelBillingAccount, hotelBillingIdentity, hotelInvoices, revioPaymentDetails } from "@revio/db";
import {
  PRODUCT_BY_KEY, billableEntitlements, billingIdentityPrompt, priceBreakdown, tierForRooms,
} from "@revio/core";
import { BillingPanel } from "@revio/ui/billing-panel";
import { BillingIdentityForm } from "@revio/ui/billing-identity-form";
import { saveBillingIdentity } from "@/lib/actions-billing-identity";
import { getSession } from "@/lib/session";
import { isTrialDecider } from "@revio/core";

export const dynamic = "force-dynamic";

/**
 * The hotel's own billing section, inside RevioCRS.
 *
 * ## Why the same screen is in all three products
 *
 * There is one account, not three. A hotel running RevioCRS and one other product has a single
 * subscription, a single monthly figure and a single run of invoices, so whichever product they
 * happen to have open must answer the question the same way. Three implementations of one bill
 * would drift, and the half that drifts is always the number.
 *
 * ## Why it is gated
 *
 * `manageSubscription` — the same capability that decides who may start a trial. What the company
 * pays is not a secret from a receptionist so much as none of their business, and showing an
 * unexplained invoice to somebody who cannot act on it only produces a question for their manager.
 *
 * ## Where the figures come from
 *
 * `priceBreakdown` in `@revio/core` — **the function that generates the invoice**. The pricing
 * model moved out of the operator app on 2026-09-11 for exactly this reason. Trials are subtracted
 * by `billableEntitlements`, which was written the same day after finding that the invoice loop
 * charged for products that were supposed to be free.
 */
export default async function BillingSettingsPage() {
  const session = await getSession();
  if (!session) return null;

  if (!isTrialDecider(session.role)) {
    return (
      <div className="rounded-xl border border-surface-border bg-white p-6">
        <h1 className="text-[15px] font-semibold text-ink-900">Billing is kept to the account owner</h1>
        <p className="mt-1.5 max-w-[56ch] text-[13px] leading-relaxed text-ink-600">
          What this hotel pays, and the invoices behind it, are visible to the owner and to admins.
          Ask one of them if you need a copy of an invoice.
        </p>
      </div>
    );
  }

  const [account, invoices, payment, identity] = await Promise.all([
    hotelBillingAccount(session.tenantId),
    hotelInvoices(session.tenantId),
    revioPaymentDetails(),
    hotelBillingIdentity(session.tenantId),
  ]);
  if (!account) return null;

  const onTrial = account.trials.map((t) => t.product);
  const breakdown = priceBreakdown(account.plan, billableEntitlements(account.entitlements, onTrial));
  const tier = tierForRooms(account.rooms);

  /*
   * ⚠️ Company details come FIRST on this page when they are missing, above what they pay.
   *
   * Until this row exists we cannot issue them an invoice at all — `issueInvoice` refuses and
   * `decideVat` blocks rather than guess a country. Showing them a tidy monthly figure above an
   * unanswered form would imply the billing side is finished when it is the one thing that is not.
   */
  const prompt = billingIdentityPrompt(identity);
  const identityValues = {
    legalName: identity?.legalName ?? "",
    country: identity?.country ?? "",
    companyId: identity?.companyId ?? "",
    vatId: identity?.vatId ?? "",
    addressLine: identity?.addressLine ?? "",
    city: identity?.city ?? "",
    postCode: identity?.postCode ?? "",
    billingEmail: identity?.billingEmail ?? "",
    attention: identity?.attention ?? "",
  };

  const identityCard = (
    <section
      className={`rounded-xl border p-5 ${prompt ? "border-warning-200 bg-warning-50" : "border-surface-border bg-white"}`}
    >
      <h2 className="text-[13.5px] font-semibold text-ink-900">Your company details</h2>
      {/*
        The sentence that stops the wrong company ending up on a tax document. This product also
        holds the identity a hotel uses to invoice its OWN guests, and the two forms look identical.
      */}
      <p className="mt-1 max-w-[68ch] text-[12.5px] leading-relaxed text-ink-600">
        These go on the invoices <strong>Revio issues to you</strong> — not on the invoices you issue
        your guests, which are set up separately under your property.
      </p>
      {prompt && (
        <p className="mt-3 rounded-md border border-warning-200 bg-white px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warning-800">
          {prompt}
        </p>
      )}
      <div className="mt-4">
        <BillingIdentityForm
          values={identityValues}
          action={saveBillingIdentity}
          selfServedAt={identity?.selfServedAt ?? null}
        />
      </div>
    </section>
  );

  return (
    <div className="space-y-4">
      {prompt && identityCard}
      <BillingPanel
      breakdown={breakdown}
      planLabel={tier.label}
      rooms={account.rooms}
      trials={account.trials.map((t) => ({
        name: PRODUCT_BY_KEY[t.product as "cm" | "crs" | "pms"]?.name ?? t.product,
        endsAt: t.endsAt,
      }))}
      invoices={invoices}
      payment={payment}
    />
      {/* Complete: it moves below the bill, where it is a record to correct rather than a task. */}
      {!prompt && identityCard}
    </div>
  );
}
