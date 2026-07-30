import { ExternalLink, Power } from "lucide-react";
import { slugifyPropertyName } from "@revio/booking";
import { getProperty } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { AppearanceForm } from "@/components/booking-engine/AppearanceForm";
import { LinkForm } from "@/components/booking-engine/LinkForm";
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
  const live = property.bookingEngineEnabled && !!property.publicSlug && published;
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
            <StatusPill tone={live ? "success" : "neutral"}>
              <Power className="mr-1 inline h-3 w-3" />
              {live ? "Live" : property.publicSlug ? "Switched off" : "Not set up"}
            </StatusPill>
          }
        />
        <LinkForm
          origin={origin}
          slug={property.publicSlug}
          enabled={property.bookingEngineEnabled}
          suggestion={slugifyPropertyName(property.name)}
        />
        {live && url && (
          <div className="border-t border-surface-border/60 px-4 py-2.5 text-[12px] text-ink-500">
            Guests can book at <span className="font-semibold text-ink-900">{url}</span>
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
        <AppearanceForm
          action={saveBookingEngineLook}
          propertyName={property.name}
          inherited={{
            color: property.emailBrandColor ?? "#1E3A8A",
            font: property.emailFont === "sans" ? "sans" : "serif",
            logoUrl: property.emailLogoUrl ?? null,
          }}
          saved={{
            preset: property.bookingPreset,
            color: property.bookingBrandColor,
            font: property.bookingFont,
            logoUrl: property.bookingLogoUrl,
            headline: property.bookingHeadline,
            subheadline: property.bookingSubheadline,
            showTrust: property.bookingShowTrust,
          }}
        />
      </Card>
    </div>
  );
}
