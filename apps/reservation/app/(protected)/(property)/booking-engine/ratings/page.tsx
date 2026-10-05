import { RATING_SOURCES, RATING_SHOW_FROM_TENTHS, formatRating, ratingShown } from "@revio/core";
import { prisma } from "@/lib/db";
import { bookingEnginePage } from "@/lib/booking-engine-page";
import { removeRating, saveRating } from "@/lib/actions-ratings";
import { Card, CardHeader } from "@/components/ui/primitives";
import { SubmitButton } from "@revio/ui/submit-button";
import { i18n } from "@/lib/i18n/server";
import { ratings as ratingsDict } from "@/lib/i18n/ratings";

export const dynamic = "force-dynamic";

const inputCls = "h-[38px] w-full rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none focus:border-brand-500";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400";

/** Booking Engine → Ratings: one row per source, typed in from the hotel's own public pages. */
export default async function BookingEngineRatings() {
  const { property } = await bookingEnginePage();
  const { t, day, locale } = await i18n();
  const s = t(ratingsDict);
  const rows = await prisma.publicRating.findMany({ where: { propertyId: property.id } });
  const now = new Date();

  return (
    <Card>
      <CardHeader title={s.title} subtitle={s.subtitle} />
      <div className="divide-y divide-surface-border">
        {RATING_SOURCES.map((source) => {
          const r = rows.find((x) => x.source === source);
          const shown = r ? ratingShown({ source, scoreTenths: r.scoreTenths, confirmedAt: r.confirmedAt }, now) : false;
          const why = r && !shown ? (r.scoreTenths < RATING_SHOW_FROM_TENTHS[source] ? s.hidden.low : s.hidden.stale) : null;
          return (
            <div key={source} className="px-5 py-4">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="text-[14px] font-semibold text-ink-900">{s.sources[source]} <span className="font-normal text-ink-400">· {s.scale[source]}</span></h3>
                {r && (
                  <form action={removeRating}>
                    <input type="hidden" name="source" value={source} />
                    <button className="text-[12px] font-semibold text-ink-500 underline hover:text-ink-900">{s.remove}</button>
                  </form>
                )}
              </div>
              <form action={saveRating} className="grid grid-cols-2 items-end gap-3 xl:grid-cols-[7rem_9rem_1fr_auto]">
                <input type="hidden" name="source" value={source} />
                <div>
                  <label className={labelCls} htmlFor={`${source}-score`}>{s.score}</label>
                  <input id={`${source}-score`} name="score" required inputMode="decimal" placeholder={source === "booking" ? "8,9" : "4,6"}
                         defaultValue={r ? formatRating(r.scoreTenths, locale) : ""} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls} htmlFor={`${source}-count`}>{s.count}</label>
                  <input id={`${source}-count`} name="reviewCount" type="number" min={1} defaultValue={r?.reviewCount ?? ""} className={inputCls} />
                </div>
                <div className="col-span-2 xl:col-span-1">
                  <label className={labelCls} htmlFor={`${source}-url`}>{s.url}</label>
                  <input id={`${source}-url`} name="url" type="url" placeholder={s.urlHint[source]} defaultValue={r?.url ?? ""} className={inputCls} />
                </div>
                <SubmitButton pendingLabel={s.saving} className="h-[38px] rounded-md bg-brand-800 px-4 text-[13px] font-semibold text-white hover:bg-brand-700">{s.save}</SubmitButton>
              </form>
              <p className={`mt-2 text-[12px] ${why ? "text-amber-700" : "text-ink-500"}`}>
                {r ? (why ?? s.confirmed(day(r.confirmedAt.toISOString().slice(0, 10)))) : s.notSet}
              </p>
            </div>
          );
        })}
      </div>
      <p className="border-t border-surface-border px-5 py-3 text-[12px] text-ink-500">{s.why}</p>
    </Card>
  );
}
