import { ExternalLink, Power } from "lucide-react";
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

  return (
    <>
      <Card>
        <CardHeader
          title="Your link"
          subtitle="Where guests book. Printed on QR codes and pasted into bios, so treat it as permanent once you share it."
          action={
            <StatusPill tone={accepting ? "success" : "neutral"}>
              <Power className="mr-1 inline h-3 w-3" />
              {accepting ? "Taking bookings" : property.publicSlug ? "Paused" : "Not set up"}
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
            Guests can book at
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
            Your booking page isn&apos;t published yet. Choose your address now — we reserve it, and it
            becomes a working link the moment your page goes live.
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="How your booking page is doing"
          subtitle="The last 30 days — every guest who opened a booking form, and how it ended. No commission was paid on any of these."
        />
        <FunnelPanel sessions={sessions} roomTypeName={funnel.roomTypeName} inferred={funnel.inferred} />
      </Card>
    </>
  );
}
