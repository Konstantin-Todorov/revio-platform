import "server-only";
import type { ChromeCreate, ChromeTab } from "@revio/ui/app-chrome";
import { prisma } from "./db";
import { activeProperty, getFrontDeskOverview } from "./data";
import type { ShellStrings } from "./i18n/shell";

/**
 * What the phone's bottom bar and "+ New" offer, by role.
 *
 * The role decides, not the person: a phone at the desk is shared across a shift, and a bar has to be
 * reachable by memory. A role with ONE screen gets no bar at all — a housekeeper sees her rooms and
 * nothing else, and reports a fault from the room card where she already is; a bar with one button is
 * a menu pretending to be navigation.
 *
 * The numbers are what is waiting there now: arrivals not yet checked in, rooms to clean, open repairs.
 */
export async function pmsChrome(role: string, t: ShellStrings["chrome"]): Promise<{ tabs: ChromeTab[]; create: ChromeCreate[] }> {
  const fault: ChromeCreate = { href: "/maintenance?new=1", label: t.fault, icon: "wrench" };

  if (role === "housekeeper" || role === "outlet_pos") return { tabs: [], create: [] };

  const { property } = await activeProperty();
  const dirty = () => prisma.unit.count({ where: { propertyId: property.id, active: true, hkStatus: "dirty" } });
  const repairs = () => prisma.maintenanceTask.count({ where: { propertyId: property.id, status: { not: "done" } } });

  if (role === "hk_supervisor") {
    const [d, r] = await Promise.all([dirty(), repairs()]);
    return {
      tabs: [
        { href: "/housekeeping", label: t.housekeeping, icon: "sparkles", badge: d },
        { href: "/rooms", label: t.rooms, icon: "bed" },
        { href: "/maintenance", label: t.tasks, icon: "wrench", badge: r },
      ],
      create: [fault],
    };
  }

  if (role === "maintenance") {
    const r = await repairs();
    return {
      tabs: [
        { href: "/maintenance", label: t.tasks, icon: "wrench", badge: r },
        { href: "/rooms", label: t.rooms, icon: "bed" },
      ],
      create: [{ href: "/maintenance?new=1", label: t.newTask, icon: "wrench" }],
    };
  }

  // Reception and managers: the day, the weeks ahead, and the rooms the day depends on.
  const [overview, d] = await Promise.all([getFrontDeskOverview(), dirty()]);
  return {
    tabs: [
      { href: "/dashboard", label: t.today, icon: "home", badge: overview.arrivals.length },
      { href: "/calendar", label: t.calendar, icon: "calendarRange" },
      { href: "/housekeeping", label: t.rooms, icon: "sparkles", badge: d },
    ],
    create: [
      { href: "/walkin?new=1", label: t.walkIn, icon: "userPlus" },
      fault,
    ],
  };
}
