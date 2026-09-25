import type { ReactNode } from "react";
import { SettingsNav, type SettingsSection } from "@revio/ui/settings-nav";
import { PageHeader } from "@/components/ui/primitives";
import { getProperty } from "@/lib/data";
import { i18n } from "@/lib/i18n/server";
import { rates as ratesDict } from "@/lib/i18n/rates";

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
export default async function RoomsRatesLayout({ children }: { children: ReactNode }) {
  const property = await getProperty();
  const s = (await i18n()).t(ratesDict);
  const SECTIONS: SettingsSection[] = [
    { href: "/rooms-rates/rooms", label: s.nav.rooms, blurb: s.nav.roomsBlurb, prefix: true },
    { href: "/rooms-rates/plans", label: s.nav.plans, blurb: s.nav.plansBlurb, prefix: true },
    { href: "/rooms-rates/closures", label: s.nav.closures, blurb: s.nav.closuresBlurb },
  ];
  const ELSEWHERE: SettingsSection[] = [
    { href: "/inventory", label: s.nav.daily, blurb: s.nav.dailyBlurb },
    { href: "/bulk", label: s.nav.bulk, blurb: s.nav.bulkBlurb },
    { href: "/booking-engine", label: s.nav.engine, blurb: s.nav.engineBlurb },
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        title={s.title}
        subtitle={s.subtitle(property.name)}
      />
      <div className="flex flex-col gap-5 lg:flex-row">
        <SettingsNav sections={SECTIONS} elsewhere={ELSEWHERE} labels={{ nav: s.nav.label, elsewhere: s.nav.elsewhere }} />
        <div className="min-w-0 flex-1 space-y-5">{children}</div>
      </div>
    </div>
  );
}
