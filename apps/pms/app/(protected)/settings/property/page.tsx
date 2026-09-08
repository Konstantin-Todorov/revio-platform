import { Building2, Users } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { getPmsSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * The hotel's profile, read-only here on purpose.
 *
 * Property, rooms, rates and staff all live in the shared core, and are edited in the product that
 * owns them. Showing them here without an edit control is deliberate: a front-desk manager needs to
 * *see* the check-out time and the business date, and a second place to change them is how two
 * products end up disagreeing about one hotel.
 */
export default async function PropertySettingsPage() {
  const { property } = await getPmsSettings();

  return (
    <>
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink-900">
          <Building2 className="h-4 w-4 text-accent-600" /> Property
        </div>
        <div className="grid grid-cols-1 gap-2 text-[12.5px] text-ink-600 sm:grid-cols-2">
          <div>Name: <span className="font-semibold text-ink-900">{property.name}</span></div>
          <div>Time zone: <span className="font-semibold text-ink-900">{property.timezone}</span></div>
          <div>Currency: <span className="font-semibold text-ink-900">{property.baseCurrency}</span></div>
          <div>Check-in / out: <span className="font-semibold text-ink-900">{property.checkInTime} / {property.checkOutTime}</span></div>
          {property.businessDate && (
            <div>
              Business date:{" "}
              <span className="font-semibold text-ink-900">
                {new Date(property.businessDate).toISOString().slice(0, 10)}
              </span>
            </div>
          )}
        </div>
        <p className="mt-3 text-[11.5px] text-ink-400">
          Property profile, rooms and rates are shared across the platform — edit them in RevioLink / RevioCRS.
        </p>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink-900">
          <Users className="h-4 w-4 text-accent-600" /> Staff &amp; permissions
        </div>
        <p className="text-[12.5px] text-ink-600">
          Staff accounts and roles are managed once in{" "}
          <span className="font-semibold text-ink-900">RevioLink → Settings</span> — one account works
          across every product this hotel has.
        </p>
      </Card>
    </>
  );
}
