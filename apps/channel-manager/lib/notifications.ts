import "server-only";
import {
  buildFeed, roleCanOpenProduct, type AttentionItem, type NotificationEvent, type NotificationFeed,
} from "@revio/core";
import { prisma } from "./db";
import { getSession } from "./session";
import { getNotifications } from "./data";

/** How far back the panel remembers. Longer than any shift, shorter than "forever". */
const WINDOW_DAYS = 14;
const PER_SOURCE = 25;

/**
 * What RevioLink tells you happened.
 *
 * ## ⚠️ The boundary rule applies here too
 *
 * Only things that **crossed the channel boundary** belong in this feed: a booking arrived from an
 * OTA, a push failed, an error was raised about distribution. A guest checking in is a real event
 * and it is RevioPMS's, not this product's — `apps/channel-manager/CLAUDE.md` is explicit that no
 * PMS operational event may appear anywhere in RevioLink, and a notification panel is exactly where
 * that rule would get quietly broken first.
 *
 * ## Every property the account holds
 *
 * The same decision as the ⌘K palette, for the same reason: a chain switches property to work, not
 * to be told what happened. `context` names the property and the panel draws it only when there is
 * more than one.
 */
export async function getNotificationFeed(): Promise<NotificationFeed> {
  const session = await getSession();
  if (!session) return { attention: [], events: [], unread: 0 };
  // The palette's gate, restated: a role that cannot open this product is told nothing by it.
  if (!roleCanOpenProduct(session.role, "cm")) return { attention: [], events: [], unread: 0 };

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const where = { property: { tenantId: session.tenantId } };

  const [reservations, failures, errors, propertyCount, user] = await Promise.all([
    prisma.reservation.findMany({
      where: { ...where, importedAt: { gte: since } },
      select: {
        id: true, guestName: true, externalId: true, importedAt: true,
        channel: { select: { name: true } }, property: { select: { name: true } },
      },
      orderBy: { importedAt: "desc" },
      take: PER_SOURCE,
    }),
    prisma.syncEvent.findMany({
      where: { ...where, status: "failed", createdAt: { gte: since } },
      select: {
        id: true, kind: true, summary: true, createdAt: true,
        channel: { select: { name: true } }, property: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PER_SOURCE,
    }),
    prisma.errorItem.findMany({
      where: { ...where, createdAt: { gte: since } },
      select: {
        id: true, message: true, severity: true, code: true, resolved: true, createdAt: true,
        property: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PER_SOURCE,
    }),
    prisma.property.count({ where: { tenantId: session.tenantId } }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { notificationsClearedAt: true, notificationsReadKeys: true },
    }),
  ]);

  const ctx = (name: string) => (propertyCount > 1 ? { context: name } : {});

  const events: NotificationEvent[] = [
    ...reservations.map((r): NotificationEvent => ({
      key: `reservation:${r.id}`,
      title: `New booking — ${r.guestName || r.externalId || "no name given"}`,
      body: r.channel?.name ? `from ${r.channel.name}` : "from a direct source",
      href: `/reservations?q=${encodeURIComponent(r.externalId ?? r.guestName ?? "")}`,
      severity: "success",
      at: r.importedAt,
      ...ctx(r.property.name),
    })),
    ...failures.map((s): NotificationEvent => ({
      key: `sync:${s.id}`,
      title: `${s.kind} to ${s.channel?.name ?? "a channel"} failed`,
      body: s.summary ?? undefined,
      href: "/sync",
      severity: "critical",
      at: s.createdAt,
      ...ctx(s.property.name),
    })),
    ...errors.map((e): NotificationEvent => ({
      key: `error:${e.id}`,
      /* ⚠️ A resolved error still belongs in the history and says so. Dropping it would leave a
         panel that quietly rewrites what happened, and "it fixed itself" is exactly the thing
         somebody needs to see when it happens for the third time this week. */
      title: e.resolved ? `Resolved — ${e.message}` : e.message,
      body: e.code ?? undefined,
      href: "/sync?tab=errors",
      severity: e.resolved ? "info" : e.severity === "critical" ? "critical" : "warning",
      at: e.createdAt,
      ...ctx(e.property.name),
    })),
  ];

  /* The attention half is the bell exactly as it already was — derived, self-healing, never counted
     as unread. It is not re-implemented here; `getNotifications` remains its one definition. */
  const { items } = await getNotifications();

  return buildFeed(
    events,
    items as AttentionItem[],
    {
      clearedAt: user?.notificationsClearedAt ?? null,
      readKeys: new Set(user?.notificationsReadKeys ?? []),
    },
    /* Every commercial role sees every screen in RevioLink — the roles here differ in what they may
       WRITE, not what they may read — so the screen filter is the product gate already applied
       above. RevioPMS is the one that narrows further, because it has scoped roles. */
    () => true,
  );
}
