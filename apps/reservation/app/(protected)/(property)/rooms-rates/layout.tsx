import type { ReactNode } from "react";
import { SettingsNav, type SettingsSection } from "@revio/ui/settings-nav";
import { PageHeader } from "@/components/ui/primitives";
import { getProperty } from "@/lib/data";

/**
 * Rooms & Rates — what the property sells, grouped by the thing a hotelier thinks about: "the
 * Deluxe", "the breakfast plan" (docs/PLAN-ROOMS-RATES-CRS.md, approved 2026-09-24).
 *
 * It was one page of six cards split by KIND of data — room types, room photos, rate plans, how each
 * plan prices, linkage, closures — so one room was spread over two cards and a dialog, and one plan
 * over three. Now each room type and each plan has one page with everything about it, in the
 * Settings shape (sections on the left, docs/UI-STANDARD.md §8).
 *
 * One-record rule: these are the SAME shared-core rows RevioLink authors — two edit surfaces, never
 * two tables that sync.
 */
const SECTIONS: SettingsSection[] = [
  { href: "/rooms-rates/rooms", label: "Room types", blurb: "What you sell, its photos and what a guest reads", prefix: true },
  { href: "/rooms-rates/plans", label: "Rate plans", blurb: "How each rate prices, and where its price comes from", prefix: true },
  { href: "/rooms-rates/closures", label: "Closures", blurb: "Rooms closed for sale, and rooms out of order" },
];

const ELSEWHERE: SettingsSection[] = [
  { href: "/inventory", label: "Daily prices", blurb: "Prices and availability per date — the Inventory Calendar" },
  { href: "/bulk", label: "Bulk changes", blurb: "Prices and restrictions across many dates at once" },
  { href: "/booking-engine", label: "Booking Engine", blurb: "Where guests see these rooms" },
];

export default async function RoomsRatesLayout({ children }: { children: ReactNode }) {
  const property = await getProperty();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Rooms & Rates"
        subtitle={`${property.name} · what you sell — shared with RevioLink, so you set it up once`}
      />
      <div className="flex flex-col gap-5 lg:flex-row">
        <SettingsNav sections={SECTIONS} elsewhere={ELSEWHERE} labels={{ nav: "Rooms & Rates sections", elsewhere: "Elsewhere" }} />
        <div className="min-w-0 flex-1 space-y-5">{children}</div>
      </div>
    </div>
  );
}
