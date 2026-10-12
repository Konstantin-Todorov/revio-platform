import "server-only";
import type { ChromeCreate, ChromeTab } from "@revio/ui/app-chrome";
import { prisma } from "./db";
import type { ShellStrings } from "./i18n/shell";

/**
 * RevioLink's bottom bar and "+ New": prices and availability, and whether they reached the channels.
 * The number on Sync is the open errors — something a channel refused that nobody has dealt with.
 */
export async function linkChrome(propertyId: string, t: ShellStrings["chrome"]): Promise<{ tabs: ChromeTab[]; create: ChromeCreate[] }> {
  const errors = await prisma.errorItem.count({ where: { propertyId, resolved: false } });
  return {
    tabs: [
      { href: "/dashboard", label: t.dashboard, icon: "dashboard" },
      { href: "/calendar", label: t.calendar, icon: "calendar" },
      { href: "/sync", label: t.sync, icon: "refresh", badge: errors },
    ],
    create: [
      { href: "/bulk-update?new=bulk", label: t.bulk, icon: "layers" },
      { href: "/bulk-update?tab=rules&new=restriction", label: t.restriction, icon: "lock" },
      { href: "/channels?new=channel", label: t.channel, icon: "plug" },
    ],
  };
}
