import { ShieldCheck, ShoppingBag } from "lucide-react";
import { prisma } from "@/lib/db";
import { bookingEnginePage } from "@/lib/booking-engine-page";
import { saveTrackingTags } from "@/lib/actions-tracking";
import { Card, CardHeader } from "@/components/ui/primitives";
import { SubmitButton } from "@revio/ui/submit-button";
import { i18n } from "@/lib/i18n/server";
import { tracking as trackingDict } from "@/lib/i18n/tracking";

export const dynamic = "force-dynamic";

const inputCls = "h-[38px] w-full rounded-md border border-surface-border bg-white px-2.5 font-mono text-[13px] text-ink-900 outline-none focus:border-brand-500";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400";

/** Booking Engine → Analytics & ads: the hotel's own tags, loaded on its page only after guest consent. */
export default async function BookingEngineTracking() {
  const { property } = await bookingEnginePage();
  const { t } = await i18n();
  const s = t(trackingDict);
  const row = await prisma.property.findUnique({ where: { id: property.id }, select: { bookingGa4Id: true, bookingMetaPixelId: true } });
  const on = [row?.bookingGa4Id && "Google Analytics", row?.bookingMetaPixelId && "Meta pixel"].filter(Boolean).join(" · ");

  return (
    <Card>
      <CardHeader title={s.title} subtitle={s.subtitle} />
      <form action={saveTrackingTags} className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="ga4Id">{s.ga4}</label>
          <input id="ga4Id" name="ga4Id" placeholder={s.ga4Placeholder} defaultValue={row?.bookingGa4Id ?? ""} autoComplete="off" spellCheck={false} className={inputCls} />
          <p className="mt-1 text-[11.5px] text-ink-500">{s.ga4Hint}</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="metaPixelId">{s.meta}</label>
          <input id="metaPixelId" name="metaPixelId" inputMode="numeric" placeholder={s.metaPlaceholder} defaultValue={row?.bookingMetaPixelId ?? ""} autoComplete="off" className={inputCls} />
          <p className="mt-1 text-[11.5px] text-ink-500">{s.metaHint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <SubmitButton pendingLabel={s.saving} className="h-[38px] rounded-md bg-brand-800 px-4 text-[13px] font-semibold text-white hover:bg-brand-700">{s.save}</SubmitButton>
          <span className={`text-[12.5px] ${on ? "font-semibold text-ink-800" : "text-ink-500"}`}>{on ? s.state.on(on) : s.state.off}</span>
        </div>
      </form>
      <div className="grid grid-cols-1 gap-3 border-t border-surface-border px-5 py-4 md:grid-cols-2">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          <div><p className="text-[13px] font-semibold text-ink-900">{s.consentTitle}</p><p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-600">{s.consentBody}</p></div>
        </div>
        <div className="flex gap-3">
          <ShoppingBag className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          <div><p className="text-[13px] font-semibold text-ink-900">{s.purchaseTitle}</p><p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-600">{s.purchaseBody}</p></div>
        </div>
      </div>
    </Card>
  );
}
