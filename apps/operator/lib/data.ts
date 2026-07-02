import "server-only";
import { forSystem, decryptSecret, keyHint } from "@revio/db";

// Operator perimeter sees all tenants → bypass RLS (app.bypass=on) for every query.
const prisma = forSystem();

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

/** Connectivity credentials per client — key HINTS only (last 4 chars), never the key itself. */
export async function getConnectivity() {
  const [tenants, creds] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.connectivityCredential.findMany(),
  ]);
  const channexChannels = await prisma.channel.groupBy({
    by: ["tenantId"],
    where: { connectivityMode: { not: "mock" } },
    _count: { _all: true },
  });
  const channexByTenant = new Map(channexChannels.map((c) => [c.tenantId, c._count._all]));

  const credFor = (tenantId: string, mode: string) => {
    const c = creds.find((x) => x.tenantId === tenantId && x.mode === mode);
    if (!c) return null;
    let hint = "••••";
    try {
      hint = keyHint(decryptSecret(c.cipher));
    } catch {
      hint = "•••• (undecryptable)";
    }
    return { hint, updatedAt: c.updatedAt };
  };

  return tenants.map((t) => ({
    id: t.id,
    name: t.name,
    sandbox: credFor(t.id, "channex_sandbox"),
    prod: credFor(t.id, "channex_prod"),
    channexChannels: channexByTenant.get(t.id) ?? 0,
  }));
}
