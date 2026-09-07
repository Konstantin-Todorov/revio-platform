import { prisma } from "@/lib/db";
import { getProperty } from "@/lib/data";
import { savePropertyDefaults } from "@/lib/actions-rates";
import { PRECEDENCE_LINE, MAX_MAIN_GUESTS, resolveMainGuestCount } from "@revio/core";
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

  return (
    <>
      {/* Standing policy defaults (spec §3.9) — the property-default tier of the two-tier
          precedence model, moved here from the dissolved Rates & Restrictions screen. */}
      <Card>
        <CardHeader title="Standing policy defaults" subtitle={`Used when nothing more specific applies — ${PRECEDENCE_LINE}`} />
        <form action={savePropertyDefaults} className="grid grid-cols-2 items-end gap-3 p-4 lg:grid-cols-4">
          <div><label className={labelCls}>Min stay (nights)</label><input type="number" name="defMinLos" min={0} defaultValue={defaults?.defMinLos ?? ""} placeholder="—" className={inputCls} /></div>
          <div><label className={labelCls}>Max stay (nights)</label><input type="number" name="defMaxLos" min={0} defaultValue={defaults?.defMaxLos ?? ""} placeholder="—" className={inputCls} /></div>
          <div><label className={labelCls}>Book ≥ days ahead</label><input type="number" name="defAdvancePurchaseMin" min={0} defaultValue={defaults?.defAdvancePurchaseMin ?? ""} placeholder="—" className={inputCls} /></div>
          <div><label className={labelCls}>Book ≤ days ahead</label><input type="number" name="defAdvancePurchaseMax" min={0} defaultValue={defaults?.defAdvancePurchaseMax ?? ""} placeholder="—" className={inputCls} /></div>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="defStopSell" defaultChecked={defaults?.defStopSell ?? false} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Stop sell
          </label>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="defCta" defaultChecked={defaults?.defCta ?? false} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Closed to arrival
          </label>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="defCtd" defaultChecked={defaults?.defCtd ?? false} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Closed to departure
          </label>
          {/* The anchor the occupancy ladder adds to (§2.2). Left empty it is derived from the
              rooms and every screen marks it "assumed" — so an unanswered question never reads as
              a decision. */}
          <div>
            <label className={labelCls}>Main guest count</label>
            <input type="number" name="mainGuestCount" min={1} max={MAX_MAIN_GUESTS} defaultValue={defaults?.mainGuestCount ?? ""} placeholder={`${derivedMainGuests.value} (assumed)`} className={inputCls} />
          </div>
          <div><label className={labelCls}>Hold TTL (minutes)</label><input type="number" name="holdTtlMinutes" min={5} max={240} defaultValue={defaults?.holdTtlMinutes ?? 30} className={inputCls} /></div>
          <div><label className={labelCls}>Low-availability alert ≤</label><input type="number" name="lowAvailabilityThreshold" min={0} defaultValue={defaults?.lowAvailabilityThreshold ?? 2} className={inputCls} /></div>
          <div><label className={labelCls}>Pickup compares vs (days ago)</label><input type="number" name="pickupOffsetDays" min={1} max={90} defaultValue={defaults?.pickupOffsetDays ?? 7} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Revenue display</label>
            <select name="revenueDisplay" defaultValue={defaults?.revenueDisplay ?? "gross"} className={inputCls}>
              <option value="gross">Gross</option>
              <option value="net">Net (− channel commission)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="countNoShowsAsSold" defaultChecked={defaults?.countNoShowsAsSold ?? true} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Count no-shows as sold
          </label>
          {/* City tax (spec §4.4): ONE definition, three products — the CRS defines the rule, the
              PMS posts/suppresses the folio line, the CM discloses to the OTA. The setting NEVER
              changes the rate exported to the channel manager. */}
          <div className="col-span-2 rounded-md border border-surface-border bg-surface-muted/50 p-3 lg:col-span-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">City tax mode</div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
                <input type="radio" name="cityTaxMode" value="payable_on_spot" defaultChecked={(defaults?.cityTaxMode ?? "payable_on_spot") === "payable_on_spot"} className="h-4 w-4 border-surface-border text-brand-600" />
                Payable on spot — the PMS posts it as a folio charge at check-in; the channel manager discloses it to the OTA
              </label>
              <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
                <input type="radio" name="cityTaxMode" value="included" defaultChecked={defaults?.cityTaxMode === "included"} className="h-4 w-4 border-surface-border text-brand-600" />
                Included — absorbed in the rate; no folio line, no disclosure
              </label>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-400">Either way the rate sent to the OTA is the room rate, full stop — this setting only controls downstream behaviour.</p>
          </div>
          <div className="col-span-2 flex justify-end lg:col-span-4">
            <button className="rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">Save defaults</button>
          </div>
        </form>
      </Card>

      {/* Occupancy-based pricing (§6.2). Above the tax card because it decides the SHAPE of every
          rate, and somebody reading this page top to bottom should meet that before the details. */}
      <Card>
        <CardHeader
          title="How you price rooms"
          subtitle="One price per room, or a price for each number of guests"
        />
        <PricingModelCard
          current={(defaults?.pricingModel as "per_room" | "per_person") ?? "per_room"}
          seedMode={(defaults?.occupancySeedMode as "copy" | "derive") ?? "copy"}
        />
      </Card>
    </>
  );
}
