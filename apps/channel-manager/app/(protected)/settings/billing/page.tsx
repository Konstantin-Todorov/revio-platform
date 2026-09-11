import { hotelBillingAccount, hotelInvoices, revioPaymentDetails } from "@revio/db";
import { PRODUCT_BY_KEY, billableEntitlements, priceBreakdown, tierForRooms } from "@revio/core";
import { BillingPanel } from "@revio/ui/billing-panel";
import { getSession } from "@/lib/session";
import { isTrialDecider } from "@revio/core";

export const dynamic = "force-dynamic";

/**
 * The hotel's own billing section, inside RevioLink.
 *
 * ## Why the same screen is in all three products
 *
 * There is one account, not three. A hotel running RevioLink and one other product has a single
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

  const [account, invoices, payment] = await Promise.all([
    hotelBillingAccount(session.tenantId),
    hotelInvoices(session.tenantId),
    revioPaymentDetails(),
  ]);
  if (!account) return null;

  const onTrial = account.trials.map((t) => t.product);
  const breakdown = priceBreakdown(account.plan, billableEntitlements(account.entitlements, onTrial));
  const tier = tierForRooms(account.rooms);

  return (
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
  );
}
