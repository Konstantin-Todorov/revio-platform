import "server-only";
import { dayBoundsInTimeZone } from "@revio/core";
import type { ChromeCreate, ChromeTab } from "@revio/ui/app-chrome";
import { prisma } from "./db";
import { todayInTz } from "./data";
import type { ShellStrings } from "./i18n/shell";

/**
 * RevioCRS's bottom bar and "+ New". The same for every role that can open the product: what changes
 * by role here is what a screen lets you save, not where you go. The number on Reservations is what
 * arrived today, in the property's own day.
 */
export async function crsChrome(
  property: { id: string; timezone: string } | null,
  t: ShellStrings["chrome"],
): Promise<{ tabs: ChromeTab[]; create: ChromeCreate[] }> {
  let newToday = 0;
  if (property) {
    const { start, next } = dayBoundsInTimeZone(todayInTz(property.timezone), property.timezone);
    newToday = await prisma.reservation.count({ where: { propertyId: property.id, importedAt: { gte: start, lt: next } } });
  }
  return {
    tabs: [
      { href: "/dashboard", label: t.dashboard, icon: "dashboard" },
      { href: "/reservations", label: t.reservations, icon: "list", badge: newToday },
      { href: "/inventory", label: t.availability, icon: "calendar" },
    ],
    create: [
      { href: "/reservations/new", label: t.reservation, icon: "calendarPlus" },
      { href: "/rooms-rates/closures?new=1", label: t.closeDates, icon: "lock" },
      { href: "/bulk?tab=rules&new=1", label: t.restriction, icon: "sliders" },
    ],
  };
}
