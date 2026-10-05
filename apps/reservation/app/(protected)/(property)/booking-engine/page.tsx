import { i18n } from "@/lib/i18n/server";
import { bookingEngine as beDict } from "@/lib/i18n/booking-engine";
import { ExternalLink, Power, Plus } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { slugifyPropertyName } from "@revio/booking";
import { funnelSessions } from "@revio/core";
import { getBookingFunnel, todayInTz } from "@/lib/data";
import { FunnelPanel } from "@/components/booking-engine/FunnelPanel";
import { Card, CardHeader, StatusPill } from "@/components/ui/primitives";
import { LinkForm } from "@/components/booking-engine/LinkForm";
import { bookingEnginePage } from "@/lib/booking-engine-page";

export const dynamic = "force-dynamic";

/**
 * Booking Engine → Overview: is the page working, and where is it. The link comes first — it is the
 * switch — and then the last 30 days, which is the question an owner opening this screen asks
 * before they ask to change anything.
 */
export default async function BookingEngineOverview() {
  const { property, origin, published, accepting, url } = await bookingEnginePage();

  /*
   * A fixed 30-day window rather than a range picker on purpose: the question this screen answers is
   * "is my booking page working", not "what happened in March".
   */
  const todayIso = todayInTz(property.timezone);
  const funnelFrom = new Date(`${todayIso}T00:00:00Z`);
  funnelFrom.setUTCDate(funnelFrom.getUTCDate() - 29);
  const funnel = await getBookingFunnel(funnelFrom.toISOString().slice(0, 10), todayIso);
  const sessions = funnelSessions(funnel.holds);
  const s = (await i18n()).t(beDict);
  const o = s.overview;
  // A booking page that sells only the room leaves the easiest upsell unasked. Said here, where the
  // owner looks, rather than only on the Extras tab nobody opens until they already mean to.
  const [sellingExtras, staffOnlyExtras] = await Promise.all([
    prisma.posItem.count({ where: { propertyId: property.id, category: "extra", active: true, directSellable: true } }),
    prisma.posItem.count({ where: { propertyId: property.id, category: "extra", active: true, directSellable: false } }),
  ]);

  return (
    <>
      <Card>
        <CardHeader
          title={o.linkTitle}
          subtitle={o.linkSub}
          action={
            <StatusPill tone={accepting ? "success" : "neutral"}>
              <Power className="mr-1 inline h-3 w-3" />
              {accepting ? o.taking : property.publicSlug ? o.paused : o.notSetUp}
            </StatusPill>
          }
        />
        <LinkForm
          origin={origin}
          slug={property.publicSlug}
          enabled={property.bookingEngineEnabled}
          suggestion={slugifyPropertyName(property.name)}
        />
        {accepting && url && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-surface-border/60 px-4 py-2.5 text-[12px] text-ink-500">
            {o.guestsBookAt}
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
            >
              {url}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        {!published && (
          <div className="border-t border-surface-border/60 px-4 py-2.5 text-[12px] text-ink-500">
            {o.notPublished}
          </div>
        )}
      </Card>

      {published && sellingExtras === 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink-900">{o.noExtrasTitle}</p>
              <p className="mt-0.5 text-[12px] text-ink-500">{staffOnlyExtras > 0 ? o.staffOnlyBody(staffOnlyExtras) : o.noExtrasBody}</p>
            </div>
            <Link href="/booking-engine/extras" className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-700">
              <Plus className="h-3.5 w-3.5" /> {staffOnlyExtras > 0 ? o.staffOnlyCta : o.noExtrasCta}
            </Link>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title={o.funnelTitle}
          subtitle={o.funnelSub}
        />
        <FunnelPanel sessions={sessions} roomTypeName={funnel.roomTypeName} inferred={funnel.inferred} s={s.funnel} />
      </Card>
    </>
  );
}
