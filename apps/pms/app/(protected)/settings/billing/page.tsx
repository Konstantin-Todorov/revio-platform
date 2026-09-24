import { hotelBillingAccount, hotelBillingIdentity, hotelInvoices, revioPaymentDetails } from "@revio/db";
import {
  PRODUCT_BY_KEY, billableEntitlements, billingIdentityGap, priceBreakdown, tierForRooms,
} from "@revio/core";
import { billingStrings } from "@revio/ui/billing-strings";
import { fill } from "@revio/ui/i18n";
import { i18n } from "@/lib/i18n/server";
import { BillingPanel } from "@revio/ui/billing-panel";
import { BillingIdentityForm } from "@revio/ui/billing-identity-form";
import { saveBillingIdentity } from "@/lib/actions-billing-identity";
import { getSession } from "@/lib/session";
import { isTrialDecider } from "@revio/core";

export const dynamic = "force-dynamic";

/**
 * The hotel's own billing section, inside RevioPMS.
 *
 * ## Why the same screen is in all three products
 *
 * There is one account, not three. A hotel running RevioPMS and one other product has a single
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
  // The layout already redirects a signed-out visitor; this is belt and braces and renders nothing
  // only in a state that cannot be reached through a browser.
  if (!session) return null;
  const { t, locale } = await i18n();
  const b = t(billingStrings);

  if (!isTrialDecider(session.role)) {
    return (
      <div className="rounded-xl border border-surface-border bg-white p-6">
        <h1 className="text-[15px] font-semibold text-ink-900">{b.page.keptTitle}</h1>
        <p className="mt-1.5 max-w-[56ch] text-[13px] leading-relaxed text-ink-600">{b.page.keptBody}</p>
      </div>
    );
  }

  const [account, invoices, payment, identity] = await Promise.all([
    hotelBillingAccount(session.tenantId),
    hotelInvoices(session.tenantId),
    revioPaymentDetails(),
    hotelBillingIdentity(session.tenantId),
  ]);
  /*
   * ⚠️ Never render nothing.
   *
   * This was `return null`, and on 2026-09-11 that turned a data problem into a blank page: the
   * reader had no way to tell a screen that failed from a screen with nothing on it. (The cause was
   * `@revio/db` querying through the raw Prisma client, so row-level security returned zero rows
   * silently — see `scripts/perimeter-lint.mjs`.) A screen that cannot answer must say so.
   */
  if (!account) {
    return (
      <div className="rounded-xl border border-danger-200 bg-danger-50 p-6">
        <h1 className="text-[15px] font-semibold text-danger-700">{b.page.failedTitle}</h1>
        <p className="mt-1.5 max-w-[56ch] text-[13px] leading-relaxed text-ink-700">{b.page.failedBody}</p>
      </div>
    );
  }

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
  // Worded here from core's facts (`billingIdentityGap`), so it is said in the reader's language.
  const gap = billingIdentityGap(identity);
  const prompt = !gap
    ? null
    : gap.code === "missing"
      ? b.page.promptMissing
      : fill(b.page.promptIncomplete, {
          // Lower-cased mid-sentence — but never an abbreviation: "VAT number", "ЕИК".
          fields: gap.fields
            .map((f) => b.form.fields[f])
            .map((w) => (/^\p{Lu}\p{Ll}/u.test(w) ? w[0]!.toLocaleLowerCase(locale) + w.slice(1) : w))
            .join(", "),
        });
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
      <h2 className="text-[13.5px] font-semibold text-ink-900">{b.page.companyTitle}</h2>
      {/*
        The sentence that stops the wrong company ending up on a tax document. This product also
        holds the identity a hotel uses to invoice its OWN guests, and the two forms look identical.
      */}
      <p className="mt-1 max-w-[68ch] text-[12.5px] leading-relaxed text-ink-600">
        {b.page.companyBefore}<strong>{b.page.companyStrong}</strong>{b.page.companyAfter}
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
      planLabel={b.tiers[tier.plan as keyof typeof b.tiers] ?? tier.label}
      rooms={account.rooms}
      trials={account.trials.map((t) => ({
        name: PRODUCT_BY_KEY[t.product as "cm" | "crs" | "pms"]?.name ?? t.product,
        endsAt: t.endsAt,
      }))}
      invoices={invoices}
      payment={payment}
      locale={locale}
    />
      {/* Complete: it moves below the bill, where it is a record to correct rather than a task. */}
      {!prompt && identityCard}
    </div>
  );
}
