import "server-only";
import {
  buildFeed, roleCanOpenProduct, type AttentionItem, type NotificationEvent, type NotificationFeed,
} from "@revio/core";
import { prisma } from "./db";
import { getSession } from "./session";
import { getNotifications } from "./data";

const WINDOW_DAYS = 14;
const PER_SOURCE = 25;

/**
 * What RevioCRS tells you happened.
 *
 * ## What this product's feed is about, and RevioLink's is not
 *
 * RevioCRS is the system of record for every booking **from any source**, so its feed answers "what
 * has been sold and unsold" — a booking arrived, a booking was cancelled — including the ones that
 * never touched a channel. RevioLink's identical-looking reservation line is deliberately a
 * different thing: there it means "something crossed the channel boundary", and it only ever sees
 * what an OTA sent.
 *
 * ⚠️ **A cancellation is its own event, not an edit of the arrival.** The booking notification
 * stays in the history and the cancellation appears beside it, because "it came and then it went"
 * is the thing somebody needs to see. Rewriting the original would leave a panel that quietly
 * changes what it said yesterday.
 */
export async function getNotificationFeed(): Promise<NotificationFeed> {
  const session = await getSession();
  if (!session) return { attention: [], events: [], unread: 0 };
  if (!roleCanOpenProduct(session.role, "crs")) return { attention: [], events: [], unread: 0 };

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const where = { property: { tenantId: session.tenantId } };

  const [arrived, cancelled, errors, user] = await Promise.all([
    prisma.reservation.findMany({
      where: { ...where, importedAt: { gte: since } },
      select: {
        id: true, guestName: true, externalId: true, importedAt: true, totalMinor: true, currency: true,
        channel: { select: { name: true } }, bookingSource: { select: { name: true } },
        property: { select: { name: true } },
      },
      orderBy: { importedAt: "desc" },
      take: PER_SOURCE,
    }),
    prisma.reservation.findMany({
      where: { ...where, cancelledAt: { gte: since } },
      select: {
        id: true, guestName: true, externalId: true, cancelledAt: true,
        channel: { select: { name: true } }, property: { select: { name: true } },
      },
      orderBy: { cancelledAt: "desc" },
      take: PER_SOURCE,
    }),
    prisma.errorItem.findMany({
      where: { ...where, createdAt: { gte: since } },
      select: {
        id: true, message: true, severity: true, resolved: true, createdAt: true,
        property: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PER_SOURCE,
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { notificationsClearedAt: true, notificationsReadKeys: true },
    }),
  ]);

  const ctx = (name: string) => (session.propertyCount > 1 ? { context: name } : {});
  const money = (minor: number, currency: string) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(minor / 100);
  const q = (r: { externalId: string | null; guestName: string | null }) =>
    `/reservations?q=${encodeURIComponent(r.externalId ?? r.guestName ?? "")}`;

  const events: NotificationEvent[] = [
    ...arrived.map((r): NotificationEvent => ({
      key: `reservation:${r.id}`,
      title: `New booking — ${r.guestName || r.externalId || "no name given"}`,
      body: [r.channel?.name ?? r.bookingSource?.name, money(r.totalMinor, r.currency)].filter(Boolean).join(" · "),
      href: q(r),
      severity: "success",
      at: r.importedAt,
      ...ctx(r.property.name),
    })),
    ...cancelled.map((r): NotificationEvent => ({
      // ⚠️ A DIFFERENT key from the arrival above, so the two coexist in the history. Reusing the
      // reservation's key would make reading one mark the other read, and the cancellation — the
      // half somebody actually has to act on — would arrive already grey.
      key: `cancelled:${r.id}`,
      title: `Cancelled — ${r.guestName || r.externalId || "no name given"}`,
      body: r.channel?.name ? `via ${r.channel.name}` : undefined,
      href: q(r),
      severity: "warning",
      at: r.cancelledAt!,
      ...ctx(r.property.name),
    })),
    ...errors.map((e): NotificationEvent => ({
      key: `error:${e.id}`,
      title: e.resolved ? `Resolved — ${e.message}` : e.message,
      href: "/distribution",
      severity: e.resolved ? "info" : e.severity === "critical" ? "critical" : "warning",
      at: e.createdAt,
      ...ctx(e.property.name),
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
    // Commercial roles differ in what they may WRITE here, not in what they may read.
    () => true,
  );
}
