import { i18n } from "@/lib/i18n/server";
import { bookingEngine as beDict } from "@/lib/i18n/booking-engine";
import { connectMode, getConnectStatus, isMockAccount } from "@revio/payments";
import { Card, CardHeader } from "@/components/ui/primitives";
import { PaymentsCard } from "@/components/booking-engine/PaymentsCard";
import { bookingEnginePage } from "@/lib/booking-engine-page";

export const dynamic = "force-dynamic";

/**
 * Booking Engine → Taking payment.
 *
 * Asks Stripe on every load rather than trusting the stored flag: the question a hotelier comes here
 * with is "is it working, and does Stripe want anything from me?", and only Stripe knows the answer
 * today. The stored `stripeChargesEnabled` is what the booking page reads; "Check again" refreshes it.
 */
export default async function BookingEnginePayments() {
  const { property } = await bookingEnginePage();
  const P = (await i18n()).t(beDict).payments;
  const mode = connectMode();
  const status = property.stripeAccountId ? await getConnectStatus(property.stripeAccountId) : null;
  const stale = !!status?.stale || (mode !== "mock" && isMockAccount(property.stripeAccountId));
  return (
    <Card>
      <CardHeader title={P.title} subtitle={P.sub} />
      <div className="px-5 py-4">
        <PaymentsCard
          chargesEnabled={!stale && (status ? status.chargesEnabled : property.stripeChargesEnabled)}
          hasAccount={!!property.stripeAccountId && !stale}
          checkedAt={property.stripeCheckedAt}
          mode={mode}
          stale={stale}
          status={status && !stale ? {
            payoutsEnabled: status.payoutsEnabled ?? false,
            detailsSubmitted: status.detailsSubmitted,
            businessName: status.businessName ?? null,
            email: status.email ?? null,
            currentlyDue: status.currentlyDue ?? [],
            pastDue: status.pastDue ?? [],
            disabledReason: status.disabledReason ?? null,
            error: status.error ?? null,
          } : null}
          storedDisagrees={!!status && !stale && status.chargesEnabled !== property.stripeChargesEnabled}
        />
      </div>
    </Card>
  );
}
