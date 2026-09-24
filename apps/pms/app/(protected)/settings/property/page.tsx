import { Building2, Users } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { getPmsSettings } from "@/lib/data";
import { i18n } from "@/lib/i18n/server";
import { settings } from "@/lib/i18n/settings";

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
  const { t: tr } = await i18n();
  const t = tr(settings).property;

  return (
    <>
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink-900">
          <Building2 className="h-4 w-4 text-accent-600" /> {t.title}
        </div>
        <div className="grid grid-cols-1 gap-2 text-[12.5px] text-ink-600 sm:grid-cols-2">
          <div>{t.name} <span className="font-semibold text-ink-900">{property.name}</span></div>
          <div>{t.timezone} <span className="font-semibold text-ink-900">{property.timezone}</span></div>
          <div>{t.currency} <span className="font-semibold text-ink-900">{property.baseCurrency}</span></div>
          <div>{t.checkInOut} <span className="font-semibold text-ink-900">{property.checkInTime} / {property.checkOutTime}</span></div>
          {property.businessDate && (
            <div>
              {t.businessDate}{" "}
              <span className="font-semibold text-ink-900">
                {new Date(property.businessDate).toISOString().slice(0, 10)}
              </span>
            </div>
          )}
        </div>
        <p className="mt-3 text-[11.5px] text-ink-400">
          {t.sharedNote}
        </p>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink-900">
          <Users className="h-4 w-4 text-accent-600" /> {t.staffTitle}
        </div>
        <p className="text-[12.5px] text-ink-600">
          {t.staffBefore}{" "}
          <span className="font-semibold text-ink-900">{t.staffWhere}</span> {t.staffAfter}
        </p>
      </Card>
    </>
  );
}
