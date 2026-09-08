import Link from "next/link";
import { getSettings } from "@/lib/data";
import { Card, CardHeader } from "@/components/ui/primitives";
import { DeliverySettingsForm } from "@/components/settings/DeliverySettingsForm";

export const dynamic = "force-dynamic";

/**
 * Where a booking lands, and what a guest receives.
 *
 * Two different audiences on one screen on purpose: both answer "an email should have gone out and
 * did not". Internal delivery is configured here; the guest-facing wording keeps its own screen,
 * linked rather than moved — it owns a URL that support answers already point at.
 */
export default async function DeliverySettingsPage() {
  const { property } = await getSettings();

  return (
    <Card>
      <CardHeader
        title="Reservation delivery & notifications"
        subtitle="Where channel bookings are emailed, plus the daily arrival summaries"
      />
      <div className="p-5">
        <DeliverySettingsForm property={property} emailMode={process.env.RESEND_API_KEY ? "resend" : "mock"} />
      </div>
      <Link
        href="/settings/emails"
        className="flex items-center justify-between gap-3 border-t border-surface-border px-5 py-3.5 transition-colors hover:bg-surface-muted"
      >
        <span>
          <span className="block text-[13px] font-semibold text-ink-900">Guest emails →</span>
          <span className="block text-[11.5px] text-ink-500">
            Your branding, and the wording of every email your guests receive
          </span>
        </span>
        <span className="text-ink-300">›</span>
      </Link>
    </Card>
  );
}
