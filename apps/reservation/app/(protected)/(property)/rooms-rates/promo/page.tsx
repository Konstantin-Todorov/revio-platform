import { TicketPercent } from "lucide-react";
import { todayInTimeZone } from "@revio/core";
import { getProperty } from "@/lib/data";
import { prisma } from "@/lib/db";
import { createPromoCode, deletePromoCode, saveDirectDiscount, togglePromoCode } from "@/lib/actions-promo";
import { Card, CardHeader, StatusPill } from "@/components/ui/primitives";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { SubmitButton } from "@revio/ui/submit-button";
import { DateField } from "@revio/ui/date-field";
import { i18n } from "@/lib/i18n/server";
import { promo as promoDict } from "@/lib/i18n/promo";

export const dynamic = "force-dynamic";

const inputCls = "h-[38px] w-full rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none focus:border-brand-500";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400";

/** Promo codes for RevioDirect: create one in a row, see each one's use, switch it off. */
export default async function PromoCodesPage() {
  const property = await getProperty();
  const today = todayInTimeZone(property.timezone);
  const { t, day } = await i18n();
  const s = t(promoDict);
  const [codes, plans, otaMapped, directRow] = await Promise.all([
    prisma.promoCode.findMany({ where: { propertyId: property.id }, orderBy: { createdAt: "desc" } }),
    prisma.ratePlan.findMany({ where: { propertyId: property.id, active: true, directChannelEnabled: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    // The same question the booking page asks: which rates have a booking-site price to beat.
    prisma.channelRatePlanMapping.findMany({
      where: { channel: { propertyId: property.id, status: "connected" }, ratePlan: { propertyId: property.id } },
      select: { ratePlanId: true },
    }),
    prisma.property.findUnique({ where: { id: property.id }, select: { directDiscountPct: true } }),
  ]);
  const onOta = new Set(otaMapped.map((m) => m.ratePlanId));
  const dPlans = plans.filter((p) => onOta.has(p.id));
  const directOnly = plans.filter((p) => !onOta.has(p.id));
  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? "—";
  const d = (x: Date | null) => (x ? day(x.toISOString().slice(0, 10)) : null);

  return (
    <div className="space-y-5">
      <Card surface="flat">
        <CardHeader surface="flat" title={s.direct.title} subtitle={s.direct.subtitle} />
        <div className="space-y-3 px-4 pb-4 text-[13px] text-ink-700">
          <form action={saveDirectDiscount} className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <label className={labelCls} htmlFor="dd-pct">{s.direct.label}</label>
              <input id="dd-pct" name="directDiscountPct" type="number" min={0} max={30} step={1} required
                     defaultValue={directRow?.directDiscountPct ?? 0} className={inputCls} />
            </div>
            <SubmitButton pendingLabel={s.direct.saving} className="h-[38px] rounded-md bg-brand-800 px-4 text-[13px] font-semibold text-white">{s.direct.save}</SubmitButton>
            <span className="pb-2 text-[12px] text-ink-400">{s.direct.off}</span>
          </form>
          {dPlans.length === 0 ? (
            <p className="text-ink-500">{s.direct.none}</p>
          ) : (
            <>
              <p><span className="text-ink-500">{s.direct.appliesTo}</span> <strong>{dPlans.map((p) => p.name).join(", ")}</strong></p>
              {directOnly.length > 0 && <p className="text-ink-500">{s.direct.notOn} {directOnly.map((p) => p.name).join(", ")}</p>}
              <p className="text-[12px] text-ink-500">{s.direct.caution}</p>
            </>
          )}
        </div>
      </Card>
      <Card surface="flat">
        <CardHeader surface="flat" title={s.title} subtitle={s.subtitle} />
        <form action={createPromoCode} className="grid grid-cols-2 items-end gap-3 px-4 pb-4 lg:grid-cols-6">
          <div className="col-span-2 lg:col-span-1">
            <label className={labelCls} htmlFor="pc-code">{s.code}</label>
            <input id="pc-code" name="code" required maxLength={24} placeholder="SUMMER10" className={`${inputCls} uppercase`} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pc-pct">{s.percent}</label>
            <input id="pc-pct" name="percentOff" type="number" min={1} max={90} required defaultValue={10} className={inputCls} />
          </div>
          <div><label className={labelCls}>{s.from}</label><DateField name="stayFrom" min={today} className={inputCls} /></div>
          <div><label className={labelCls}>{s.to}</label><DateField name="stayTo" min={today} className={inputCls} /></div>
          <div>
            <label className={labelCls} htmlFor="pc-min">{s.minNights}</label>
            <input id="pc-min" name="minNights" type="number" min={1} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pc-max">{s.maxUses}</label>
            <input id="pc-max" name="maxUses" type="number" min={1} className={inputCls} />
          </div>
          {plans.length > 0 && (
            <fieldset className="col-span-2 lg:col-span-5">
              <legend className={labelCls}>{s.plans}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-700">
                {plans.map((p) => (
                  <label key={p.id} className="inline-flex items-center gap-1.5">
                    <input type="checkbox" name="ratePlanIds" value={p.id} className="h-3.5 w-3.5" /> {p.name}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[11.5px] text-ink-400">{s.allPlans}</p>
            </fieldset>
          )}
          <SubmitButton pendingLabel={s.creating} className="h-[38px] rounded-md bg-brand-800 px-4 text-[13px] font-semibold text-white hover:bg-brand-700">
            {s.create}
          </SubmitButton>
        </form>
      </Card>

      <Card surface="flat">
        {codes.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-5 text-[13px] text-ink-500">
            <TicketPercent className="h-4 w-4" /> {s.empty}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  {[s.cols.code, s.cols.discount, s.cols.arrivals, s.cols.nights, s.cols.used, s.cols.status].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-b border-surface-border/60 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-semibold text-ink-900">{c.code}</span>
                      {c.ratePlanIds.length > 0 && <span className="block text-[11.5px] text-ink-400">{c.ratePlanIds.map(planName).join(", ")}</span>}
                    </td>
                    <td className="tnum px-4 py-2.5 font-semibold text-ink-900">−{c.percentOff}%</td>
                    <td className="tnum px-4 py-2.5 text-ink-600">{d(c.stayFrom) ?? s.anyDate} → {d(c.stayTo) ?? s.anyDate}</td>
                    <td className="tnum px-4 py-2.5 text-ink-600">{c.minNights ?? "—"}</td>
                    <td className="tnum px-4 py-2.5 text-ink-600">{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ""}</td>
                    <td className="px-4 py-2.5"><StatusPill tone={c.active ? "success" : "neutral"}>{c.active ? s.active : s.off}</StatusPill></td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <form action={togglePromoCode} className="mr-3 inline">
                        <input type="hidden" name="id" value={c.id} />
                        <button className="text-[12px] font-semibold text-brand-700 hover:underline">{c.active ? s.turnOff : s.turnOn}</button>
                      </form>
                      <DeleteButton action={deletePromoCode} id={c.id} label={s.deleteLabel(c.code)} note={s.deleteNote} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
