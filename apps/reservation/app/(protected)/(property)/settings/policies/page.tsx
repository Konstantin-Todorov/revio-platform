import { i18n } from "@/lib/i18n/server";
import { settings as settingsDict } from "@/lib/i18n/settings";
import { bulk as bulkDict } from "@/lib/i18n/bulk";
import { prisma } from "@/lib/db";
import { getProperty } from "@/lib/data";
import { savePropertyDefaults } from "@/lib/actions-rates";
import { MAX_MAIN_GUESTS, resolveMainGuestCount } from "@revio/core";
import { Card, CardHeader } from "@/components/ui/primitives";
import { PricingModelCard } from "@/components/settings/PricingModelCard";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400";

export default async function SettingsPoliciesPage() {
  const property = await getProperty();
  const [defaults, mainGuestRooms] = await Promise.all([
    prisma.propertyDefaults.findUnique({ where: { propertyId: property.id } }),
    // Only to show what the main guest count would be if left unset — the placeholder states the
    // number actually in effect rather than a generic example.
    prisma.roomType.findMany({
      where: { propertyId: property.id, active: true },
      select: { defaultOccupancy: true, totalRooms: true, maxGuests: true },
    }),
  ]);
  const derivedMainGuests = resolveMainGuestCount(null, mainGuestRooms);
  const { t } = await i18n();
  const P = t(settingsDict).policies;
  const precedence = t(bulkDict).precedence;

  return (
    <>
      {/* Standing policy defaults (spec §3.9) — the property-default tier of the two-tier
          precedence model, moved here from the dissolved Rates & Restrictions screen. */}
      <Card>
        <CardHeader title={P.title} subtitle={P.subtitle(precedence)} />
        <form action={savePropertyDefaults} className="grid grid-cols-2 items-end gap-3 p-4 lg:grid-cols-4">
          <div><label className={labelCls}>{P.minStay}</label><input type="number" name="defMinLos" min={0} defaultValue={defaults?.defMinLos ?? ""} placeholder="—" className={inputCls} /></div>
          <div><label className={labelCls}>{P.maxStay}</label><input type="number" name="defMaxLos" min={0} defaultValue={defaults?.defMaxLos ?? ""} placeholder="—" className={inputCls} /></div>
          <div><label className={labelCls}>{P.bookMin}</label><input type="number" name="defAdvancePurchaseMin" min={0} defaultValue={defaults?.defAdvancePurchaseMin ?? ""} placeholder="—" className={inputCls} /></div>
          <div><label className={labelCls}>{P.bookMax}</label><input type="number" name="defAdvancePurchaseMax" min={0} defaultValue={defaults?.defAdvancePurchaseMax ?? ""} placeholder="—" className={inputCls} /></div>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="defStopSell" defaultChecked={defaults?.defStopSell ?? false} className="h-4 w-4 rounded border-surface-border text-brand-600" /> {P.stopSell}
          </label>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="defCta" defaultChecked={defaults?.defCta ?? false} className="h-4 w-4 rounded border-surface-border text-brand-600" /> {P.cta}
          </label>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="defCtd" defaultChecked={defaults?.defCtd ?? false} className="h-4 w-4 rounded border-surface-border text-brand-600" /> {P.ctd}
          </label>
          {/* The anchor the occupancy ladder adds to (§2.2). Left empty it is derived from the
              rooms and every screen marks it "assumed" — so an unanswered question never reads as
              a decision. */}
          <div>
            <label className={labelCls}>{P.mainGuests}</label>
            <input type="number" name="mainGuestCount" min={1} max={MAX_MAIN_GUESTS} defaultValue={defaults?.mainGuestCount ?? ""} placeholder={P.assumed(derivedMainGuests.value)} className={inputCls} />
          </div>
          <div><label className={labelCls}>{P.holdTtl}</label><input type="number" name="holdTtlMinutes" min={5} max={240} defaultValue={defaults?.holdTtlMinutes ?? 30} className={inputCls} /></div>
          <div><label className={labelCls}>{P.lowAvail}</label><input type="number" name="lowAvailabilityThreshold" min={0} defaultValue={defaults?.lowAvailabilityThreshold ?? 2} className={inputCls} /></div>
          <div><label className={labelCls}>{P.pickupDays}</label><input type="number" name="pickupOffsetDays" min={1} max={90} defaultValue={defaults?.pickupOffsetDays ?? 7} className={inputCls} /></div>
          <div>
            <label className={labelCls}>{P.revenueDisplay}</label>
            <select name="revenueDisplay" defaultValue={defaults?.revenueDisplay ?? "gross"} className={inputCls}>
              <option value="gross">{P.gross}</option>
              <option value="net">{P.net}</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="countNoShowsAsSold" defaultChecked={defaults?.countNoShowsAsSold ?? true} className="h-4 w-4 rounded border-surface-border text-brand-600" /> {P.noShows}
          </label>
          {/* City tax (spec §4.4): ONE definition, three products — the CRS defines the rule, the
              PMS posts/suppresses the folio line, the CM discloses to the OTA. The setting NEVER
              changes the rate exported to the channel manager. */}
          <div className="col-span-2 rounded-md border border-surface-border bg-surface-muted/50 p-3 lg:col-span-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">{P.cityTax}</div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
                <input type="radio" name="cityTaxMode" value="payable_on_spot" defaultChecked={(defaults?.cityTaxMode ?? "payable_on_spot") === "payable_on_spot"} className="h-4 w-4 border-surface-border text-brand-600" />
                {P.onSpot}
              </label>
              <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
                <input type="radio" name="cityTaxMode" value="included" defaultChecked={defaults?.cityTaxMode === "included"} className="h-4 w-4 border-surface-border text-brand-600" />
                {P.included}
              </label>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-400">{P.cityTaxNote}</p>
          </div>
          <div className="col-span-2 flex justify-end lg:col-span-4">
            <button className="rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">{P.save}</button>
          </div>
        </form>
      </Card>

      {/* Occupancy-based pricing (§6.2). Above the tax card because it decides the SHAPE of every
          rate, and somebody reading this page top to bottom should meet that before the details. */}
      <Card>
        <CardHeader
          title={P.pricingTitle}
          subtitle={P.pricingSub}
        />
        <PricingModelCard
          current={(defaults?.pricingModel as "per_room" | "per_person") ?? "per_room"}
          seedMode={(defaults?.occupancySeedMode as "copy" | "derive") ?? "copy"}
        />
      </Card>
    </>
  );
}
