import "server-only";
import { prisma } from "@revio/db";

/** Aggregate numbers across ALL tenants — the operator's bird's-eye view. */
export async function getOverviewStats() {
  const [clients, properties, products, connectedChannels, reservations, openErrors, suspended] =
    await Promise.all([
      prisma.tenant.count(),
      prisma.property.count(),
      prisma.ratePlanRoomType.count(),
      prisma.channel.count({ where: { status: "connected" } }),
      prisma.reservation.count(),
      prisma.errorItem.count({ where: { resolved: false } }),
      prisma.tenant.count({ where: { status: "suspended" } }),
    ]);
  return { clients, properties, products, connectedChannels, reservations, openErrors, suspended };
}

export type ClientRow = Awaited<ReturnType<typeof getClients>>[number];

/** Every client (tenant) with its entitlements, plan, status, and per-tenant counts. */
export async function getClients() {
  const tenants = await prisma.tenant.findMany({
    include: { properties: { select: { id: true, name: true } }, users: { where: { role: "owner" }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });

  return Promise.all(
    tenants.map(async (t) => {
      const [roomTypes, channels, channelsConnected, reservations, openErrors, lastSync] = await Promise.all([
        prisma.roomType.count({ where: { tenantId: t.id } }),
        prisma.channel.count({ where: { tenantId: t.id } }),
        prisma.channel.count({ where: { tenantId: t.id, status: "connected" } }),
        prisma.reservation.count({ where: { tenantId: t.id } }),
        prisma.errorItem.count({ where: { tenantId: t.id, resolved: false } }),
        prisma.channel.findFirst({ where: { tenantId: t.id, lastSyncAt: { not: null } }, orderBy: { lastSyncAt: "desc" }, select: { lastSyncAt: true } }),
      ]);
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        status: t.status,
        createdAt: t.createdAt,
        entitlements: { channelManager: t.hasChannelManager, reservation: t.hasReservation, pms: t.hasPms },
        owner: t.users[0] ? { name: t.users[0].name, email: t.users[0].email } : null,
        properties: t.properties,
        counts: { roomTypes, channels, channelsConnected, reservations, openErrors },
        lastSyncAt: lastSync?.lastSyncAt ?? null,
      };
    }),
  );
}
