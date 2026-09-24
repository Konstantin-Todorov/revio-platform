import { connectMode } from "@revio/payments";
import { Card, CardHeader } from "@/components/ui/primitives";
import { PaymentsCard } from "@/components/booking-engine/PaymentsCard";
import { bookingEnginePage } from "@/lib/booking-engine-page";

export const dynamic = "force-dynamic";

/** Booking Engine → Taking payment. */
export default async function BookingEnginePayments() {
  const { property } = await bookingEnginePage();
  return (
    <Card>
      <CardHeader
        title="Taking payment"
        subtitle="Whether a guest gets an instant confirmation, or sends you a request to accept. Either way your page sells."
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
