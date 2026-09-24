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
const SECTIONS: SettingsSection[] = [
  { href: "/booking-engine", label: "Overview", blurb: "How the page is doing, and its address" },
  { href: "/booking-engine/look", label: "Look", blurb: "Colours, words, logo and the background photo", prefix: true },
  { href: "/booking-engine/payments", label: "Taking payment", blurb: "Instant confirmation, or requests you accept" },
  { href: "/booking-engine/extras", label: "Extras", blurb: "What a guest can add to their stay" },
];

const ELSEWHERE: SettingsSection[] = [
  { href: "/settings/emails", label: "Guest emails", blurb: "The confirmation a guest receives after booking here" },
  { href: "/rooms-rates/rooms", label: "Room photos & descriptions", blurb: "What each room shows on the page — kept with the room" },
];

export default async function BookingEngineLayout({ children }: { children: ReactNode }) {
  const { property, url } = await bookingEnginePage();
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
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:text-ink-900"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open your page
            </a>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-5 lg:flex-row">
        <SettingsNav sections={SECTIONS} elsewhere={ELSEWHERE} />
        <div className="min-w-0 flex-1 space-y-5">{children}</div>
      </div>
    </div>
  );
}
