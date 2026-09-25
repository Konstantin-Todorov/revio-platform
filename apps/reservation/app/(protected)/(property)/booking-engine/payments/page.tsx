import { i18n } from "@/lib/i18n/server";
import { bookingEngine as beDict } from "@/lib/i18n/booking-engine";
import { connectMode } from "@revio/payments";
import { Card, CardHeader } from "@/components/ui/primitives";
import { PaymentsCard } from "@/components/booking-engine/PaymentsCard";
import { bookingEnginePage } from "@/lib/booking-engine-page";

export const dynamic = "force-dynamic";

/** Booking Engine → Taking payment. */
export default async function BookingEnginePayments() {
  const { property } = await bookingEnginePage();
  const P = (await i18n()).t(beDict).payments;
  return (
    <Card>
      <CardHeader
        title={P.title}
        subtitle={P.sub}
      />
      <div className="px-5 py-4">
        <PaymentsCard
          chargesEnabled={property.stripeChargesEnabled}
          hasAccount={!!property.stripeAccountId}
          checkedAt={property.stripeCheckedAt}
          mode={connectMode()}
        />
      </div>
    </Card>
  );
}
