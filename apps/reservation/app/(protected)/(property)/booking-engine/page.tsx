import { ExternalLink, Power } from "lucide-react";
import { slugifyPropertyName } from "@revio/booking";
import { brandLogoPath } from "@revio/core";
import { getProperty } from "@/lib/data";
import { prisma } from "@/lib/db";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { AppearanceForm } from "@/components/booking-engine/AppearanceForm";
import { LinkForm } from "@/components/booking-engine/LinkForm";
import { LogoPicker } from "@/components/booking-engine/LogoPicker";
import { saveBookingEngineLook } from "@/lib/actions-booking-engine";

export const dynamic = "force-dynamic";

/**
 * RevioDirect — the hotel's own booking page, configured here.
 *
 * Its own screen rather than a block inside Settings, and deliberately NOT inside the email
 * settings: the booking page and the confirmation email are two different pieces of the hotel's
 * identity, and a shared control means changing one silently changes the other. Everything here
 * still *defaults* to the email branding, so switching the engine on inherits a coherent look and
 * only the fields a hotel actually edits diverge.
 *
 * It sits under Configuration next to Distribution because that is what it is: the direct channel,
 * the one where no commission is paid.
 */
export default async function BookingEnginePage() {
  const property = await getProperty();

  /*
   * Which logos this hotel actually has.
   *
   * Read from `BrandAsset`, not from the `*LogoUrl` columns — those hold a *pasted* URL, and
   * uploading a file deliberately clears them. Reading the column alone reported "no logo" for
   * every hotel that used the upload button, which is precisely how a logo sitting in the database
   * ended up invisible on this screen and broken on the live page.
   *
   * `updatedAt` is the cache-buster: the URL changes when the bytes do, so a replaced logo is never
   * served from a stale cache and no version column had to be invented for it.
   */
  const assets = await prisma.brandAsset.findMany({
    where: { propertyId: property.id, kind: { in: ["email_logo", "booking_logo"] } },
    select: { kind: true, updatedAt: true },
  });
  const asset = (kind: string) => assets.find((a) => a.kind === kind);

  const ownLogo = asset("booking_logo")
    ? brandLogoPath(property.id, { kind: "booking", version: asset("booking_logo")!.updatedAt.getTime() })
    : property.bookingLogoUrl;
  const emailLogo = asset("email_logo")
    ? brandLogoPath(property.id, { kind: "email", version: asset("email_logo")!.updatedAt.getTime() })
    : property.emailLogoUrl;

  /**
   * The address guests actually use.
   *
   * `BOOKING_ENGINE_ORIGIN` is where the booking service runs for this deployment. In development
   * that genuinely is localhost:3004. In production, if it is unset the service is not published
   * yet — and showing a hotel a `localhost` URL would be worse than showing none, because they would
   * copy it. So the screen says the page isn't live rather than inventing an address.
   */
  const configured = process.env.BOOKING_ENGINE_ORIGIN?.trim().replace(/\/+$/, "");
  const origin = configured || (process.env.NODE_ENV === "development" ? "http://localhost:3004" : null);
  const published = origin !== null;
  /**
   * The badge reports the HOTEL's decision, not our deployment status.
   *
   * These were conflated: a hotel that had switched bookings on saw "Switched off" purely because
   * the booking service isn't published yet, directly above a line saying guests can book right now.
   * Whether we have shipped the page is our problem and is stated separately, below.
   */
  const accepting = property.bookingEngineEnabled && !!property.publicSlug;
  const url = property.publicSlug && origin ? `${origin}/${property.publicSlug}` : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Booking Engine"
        subtitle={`${property.name} · your own booking page — no commission, and it sells from the same inventory as every channel`}
        action={
          url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:text-ink-900"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open your page
            </a>
          ) : undefined
        }
      />

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
          title="Appearance"
          subtitle="Pick a base, then change only what you want. Anything left blank follows your email branding — editing here never changes your emails."
        />
        <div className="border-b border-surface-border px-5 py-4">
          <LogoPicker current={ownLogo} inherited={emailLogo} />
        </div>

        <AppearanceForm
          action={saveBookingEngineLook}
          propertyName={property.name}
          inherited={{
            color: property.emailBrandColor ?? "#1E3A8A",
            font: property.emailFont === "sans" ? "sans" : "serif",
            logoUrl: emailLogo,
          }}
          saved={{
            preset: property.bookingPreset,
            color: property.bookingBrandColor,
            font: property.bookingFont,
            logoUrl: ownLogo,
            headline: property.bookingHeadline,
            subheadline: property.bookingSubheadline,
            showTrust: property.bookingShowTrust,
          }}
        />
      </Card>
    </div>
  );
}
