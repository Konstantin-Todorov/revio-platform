import { i18n } from "@/lib/i18n/server";
import { bookingEngine as beDict } from "@/lib/i18n/booking-engine";
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { SettingsNav, type SettingsSection } from "@revio/ui/settings-nav";
import { PageHeader } from "@/components/ui/primitives";
import { bookingEnginePage } from "@/lib/booking-engine-page";

/**
 * RevioDirect — the hotel's own booking page, configured here, in the shape Settings has: sections on
 * the left, the open one on the right, tabs on top where one section has two views
 * (docs/UI-STANDARD.md §8, set by the founder on 2026-09-25 after Guest emails).
 *
 * It was one page of six stacked cards — performance, link, payment, extras, background, appearance —
 * and a hotel changing its colours scrolled past its conversion funnel to get there.
 *
 * Its own screen rather than a block inside Settings, and deliberately NOT inside the email
 * settings: the booking page and the confirmation email are two pieces of the hotel's identity, and a
 * shared control would change one silently. Everything here still *defaults* to the email branding.
 */
export default async function BookingEngineLayout({ children }: { children: ReactNode }) {
  const { property, url } = await bookingEnginePage();
  const s = (await i18n()).t(beDict);
  const SECTIONS: SettingsSection[] = [
    { href: "/booking-engine", label: s.nav.overview, blurb: s.nav.overviewBlurb },
    { href: "/booking-engine/look", label: s.nav.look, blurb: s.nav.lookBlurb, prefix: true },
    { href: "/booking-engine/payments", label: s.nav.payments, blurb: s.nav.paymentsBlurb },
    { href: "/booking-engine/extras", label: s.nav.extras, blurb: s.nav.extrasBlurb },
  ];
  const ELSEWHERE: SettingsSection[] = [
    { href: "/settings/emails", label: s.nav.emails, blurb: s.nav.emailsBlurb },
    { href: "/rooms-rates/rooms", label: s.nav.photos, blurb: s.nav.photosBlurb },
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        title={s.title}
        subtitle={s.subtitle(property.name)}
        action={
          url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:text-ink-900"
            >
              <ExternalLink className="h-3.5 w-3.5" /> {s.openPage}
            </a>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-5 lg:flex-row">
        <SettingsNav sections={SECTIONS} elsewhere={ELSEWHERE} labels={{ nav: s.nav.label, elsewhere: s.nav.elsewhere }} />
        <div className="min-w-0 flex-1 space-y-5">{children}</div>
      </div>
    </div>
  );
}
