import { i18n } from "@/lib/i18n/server";
import { bookingEngine as beDict } from "@/lib/i18n/booking-engine";
import Link from "next/link";
import { ImageIcon, Palette } from "lucide-react";
import { BOOKING_COPY_DEFAULTS, heroScrim } from "@revio/core";
import { Card, CardHeader } from "@/components/ui/primitives";
import { AppearanceForm } from "@/components/booking-engine/AppearanceForm";
import { LogoPicker } from "@/components/booking-engine/LogoPicker";
import { HeroPicker } from "@/components/booking-engine/HeroPicker";
import { saveBookingEngineLook, saveBookingHeroSettings } from "@/lib/actions-booking-engine";
import { bookingEnginePage, bookingHeroThumb, bookingLogos } from "@/lib/booking-engine-page";

export const dynamic = "force-dynamic";

/**
 * Booking Engine → Look, with two views on top: the page itself (base, colours, words, logo) and the
 * background photograph. Two tabs because they are two views of one thing — how the page looks — and
 * each is long enough on its own that stacking them made the second one a scroll away.
 */
export default async function BookingEngineLook({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const photo = tab === "photo";
  const { property } = await bookingEnginePage();
  const L = (await i18n()).t(beDict).look;
  const [{ ownLogo, emailLogo }, heroUrl] = await Promise.all([
    bookingLogos(property),
    bookingHeroThumb(property.bookingHeroThumbKey),
  ]);

  const tabLink = (id: "page" | "photo", label: string, Icon: typeof Palette) => (
    <Link
      href={id === "page" ? "/booking-engine/look" : "/booking-engine/look?tab=photo"}
      aria-current={(id === "photo") === photo ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors ${
        (id === "photo") === photo ? "border-brand-700 text-brand-800" : "border-transparent text-ink-500 hover:text-ink-700"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );

  return (
    <>
      <div className="flex items-center gap-1 border-b border-surface-border">
        {tabLink("page", L.tabPage, Palette)}
        {tabLink("photo", L.tabPhoto, ImageIcon)}
      </div>

      {photo ? (
        <Card>
          <CardHeader
            title={L.photoTitle}
            subtitle={L.photoSub}
          />
          <div className="px-5 py-4">
            <HeroPicker
              saveSettings={saveBookingHeroSettings}
              propertyName={property.name}
              headline={property.bookingHeadline?.trim() || BOOKING_COPY_DEFAULTS.headline}
              saved={{
                url: heroUrl,
                focalY: property.bookingHeroFocalY,
                overlay: property.bookingHeroOverlay,
                luminance: property.bookingHeroLuminance,
              }}
            />
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={L.pageTitle}
            subtitle={L.pageSub}
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
            hero={
              heroUrl
                ? {
                    url: heroUrl,
                    focalY: property.bookingHeroFocalY,
                    // The same function the guest's page calls, so this preview cannot promise a
                    // shading the real page will not apply.
                    alpha: heroScrim(property.bookingHeroLuminance, property.bookingHeroOverlay).alpha,
                  }
                : null
            }
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
      )}
    </>
  );
}
