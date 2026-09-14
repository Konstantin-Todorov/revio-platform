import "server-only";
import {
  buildFeed, roleCanOpenProduct, type AttentionItem, type NotificationEvent, type NotificationFeed,
} from "@revio/core";
import { prisma } from "./db";
import { getSession } from "./session";
import { getNotifications } from "./data";
import { roleAllowsPath } from "./roles";

const WINDOW_DAYS = 14;
const PER_SOURCE = 25;

/**
 * What RevioPMS tells you happened.
 *
 * ## ⚠️ Deliberately NOT built from `OpsEvent`
 *
 * `lib/events.ts` is the obvious source — an append-only stream of every status change and
 * clock-in — and it is the wrong one. That module states its own boundary: it is **employee data**,
 * analytics on it are manager-only and EU worker-monitoring aware, and it must **never** become a
 * live staff leaderboard. A panel in everybody's topbar reading "Maria finished 214, Ivan started
 * 216" is precisely that leaderboard, arrived by the back door. The room timeline and the
 * manager-only analytics remain where that data belongs.
 *
 * So this feed is about the **hotel**, not about who did the work: a fault was raised, a room came
 * back into service, a guest departed, a booking landed.
 *
 * ## Scoped to the screens this role may open
 *
 * The same rule as the ⌘K palette, and the same reason: the line itself is data. "Marcus Reyes
 * departed" names a guest. A housekeeper's panel is her rooms and nothing else — which for her is
 * mostly the attention half, and that is honest: the notification centre is worth most to the
 * people with something to decide.
 */
export async function getNotificationFeed(): Promise<NotificationFeed> {
  const session = await getSession();
  if (!session) return { attention: [], events: [], unread: 0 };
  if (!roleCanOpenProduct(session.role, "pms")) return { attention: [], events: [], unread: 0 };

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const where = { property: { tenantId: session.tenantId } };

  const [raised, fixed, departures, arrivals, propertyCount, user] = await Promise.all([
    prisma.maintenanceTask.findMany({
      where: { ...where, createdAt: { gte: since } },
      select: {
        id: true, title: true, priority: true, setsOoo: true, createdAt: true,
        unit: { select: { label: true } }, property: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PER_SOURCE,
    }),
    prisma.maintenanceTask.findMany({
      where: { ...where, completedAt: { gte: since } },
      select: {
        id: true, title: true, completedAt: true,
        unit: { select: { label: true } }, property: { select: { name: true } },
      },
      orderBy: { completedAt: "desc" },
      take: PER_SOURCE,
    }),
    prisma.reservation.findMany({
      where: { ...where, departedAt: { gte: since } },
      select: {
        id: true, guestName: true, departedAt: true,
        property: { select: { name: true } },
      },
      orderBy: { departedAt: "desc" },
      take: PER_SOURCE,
    }),
    prisma.reservation.findMany({
      where: { ...where, importedAt: { gte: since } },
      select: {
        id: true, guestName: true, externalId: true, importedAt: true,
        property: { select: { name: true } },
      },
      orderBy: { importedAt: "desc" },
      take: PER_SOURCE,
    }),
    prisma.property.count({ where: { tenantId: session.tenantId } }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { notificationsClearedAt: true, notificationsReadKeys: true },
    }),
  ]);

  const ctx = (name: string) => (propertyCount > 1 ? { context: name } : {});
  const room = (label?: string | null) => (label ? `Room ${label}` : "No room");

  const events: NotificationEvent[] = [
    ...raised.map((t): NotificationEvent => ({
      key: `maint:${t.id}`,
      title: `${room(t.unit?.label)} — ${t.title}`,
      // Out of order is the half that costs money, so it is said rather than implied by a colour.
      body: t.setsOoo ? "out of order — not sellable" : `${t.priority} priority`,
      href: "/maintenance",
      severity: t.setsOoo ? "critical" : "warning",
      at: t.createdAt,
      ...ctx(t.property.name),
    })),
    ...fixed.map((t): NotificationEvent => ({
      key: `maintdone:${t.id}`,
      title: `${room(t.unit?.label)} back in service`,
      body: t.title,
      href: "/maintenance",
      severity: "success",
      at: t.completedAt!,
      ...ctx(t.property.name),
    })),
    ...departures.map((r): NotificationEvent => ({
      /* ⚠️ `departedAt`, never `status`. A departed guest's stay is still sold and still earns, so
         `status` says nothing about whether they have gone — that is the CRS's commercial record,
         and reading it here would report an occupied room as free. */
      key: `departed:${r.id}`,
      title: `${r.guestName || "Guest"} checked out`,
      href: `/reservation/${r.id}`,
      severity: "info",
      at: r.departedAt!,
      ...ctx(r.property.name),
    })),
    ...arrivals.map((r): NotificationEvent => ({
      key: `booking:${r.id}`,
      title: `New booking — ${r.guestName || r.externalId || "no name given"}`,
      href: `/reservation/${r.id}`,
      severity: "success",
      at: r.importedAt,
      ...ctx(r.property.name),
    })),
  ];

  const { items } = await getNotifications();

  return buildFeed(
    events,
    items as AttentionItem[],
    {
      clearedAt: user?.notificationsClearedAt ?? null,
      readKeys: new Set(user?.notificationsReadKeys ?? []),
    },
    // The menu's own rule — so the panel can never offer a screen the sidebar does not contain.
    (href) => roleAllowsPath(session.role, href),
  );
}
