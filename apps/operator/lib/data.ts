import "server-only";
import { forSystem, decryptSecret, keyHint } from "@revio/db";
import { monthlyPriceMinor, billedProducts, type Entitlements } from "./pricing";

// Operator perimeter sees all tenants → bypass RLS (app.bypass=on) for every query.
const prisma = forSystem();

export interface NotifItem { text: string; href: string; tone: "danger" | "warning" | "info" | "success" }

/** Notification-bell items across all hotels: sync failures, open errors, suspended clients. */
export async function getNotifications(): Promise<{ items: NotifItem[]; count: number }> {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [failed, openErrors, suspended] = await Promise.all([
    prisma.syncEvent.count({ where: { status: "failed", createdAt: { gte: since } } }),
    prisma.errorItem.count({ where: { resolved: false } }),
    prisma.tenant.count({ where: { status: "suspended" } }),
  ]);
  const items: NotifItem[] = [];
  if (failed > 0) items.push({ text: `${failed} sync failure${failed === 1 ? "" : "s"} (24h)`, href: "/health", tone: "danger" });
  if (openErrors > 0) items.push({ text: `${openErrors} open error${openErrors === 1 ? "" : "s"} across hotels`, href: "/health", tone: "warning" });
  if (suspended > 0) items.push({ text: `${suspended} suspended client${suspended === 1 ? "" : "s"}`, href: "/clients", tone: "warning" });
  return { items, count: items.length };
}

/** Global search across the operator perimeter: clients, properties, and owner users. */
export async function operatorSearch(q: string) {
  const term = q.trim();
  if (!term) return { term, tenants: [], properties: [], users: [] };
  const [tenants, properties, users] = await Promise.all([
    prisma.tenant.findMany({ where: { OR: [{ name: { contains: term, mode: "insensitive" } }, { slug: { contains: term, mode: "insensitive" } }] }, take: 8 }),
    prisma.property.findMany({ where: { name: { contains: term, mode: "insensitive" } }, take: 8, include: { tenant: { select: { name: true } } } }),
    prisma.user.findMany({ where: { OR: [{ name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }] }, take: 8, include: { tenant: { select: { name: true } } } }),
  ]);
  return { term, tenants, properties, users };
}

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

/**
 * Cross-tenant sync & error health — the operator's platform-wide monitor. Sync success rate over the
 * last 24h, open errors by severity, per-tenant health, and the most recent failures to act on.
 */
export async function getPlatformHealth() {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [events, openErrors, failedRecent, tenants] = await Promise.all([
    prisma.syncEvent.findMany({ where: { createdAt: { gte: since } }, select: { tenantId: true, status: true, kind: true } }),
    prisma.errorItem.findMany({ where: { resolved: false }, select: { tenantId: true, severity: true } }),
    prisma.syncEvent.findMany({ where: { status: "failed" }, orderBy: { createdAt: "desc" }, take: 10, include: { property: { select: { name: true } }, channel: { select: { name: true } } } }),
    prisma.tenant.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, status: true } }),
  ]);

  const total = events.length;
  const success = events.filter((e) => e.status === "success").length;
  const failed = events.filter((e) => e.status === "failed").length;
  const pushes = events.filter((e) => e.kind === "push").length;
  const pulls = events.filter((e) => e.kind === "pull").length;

  const bySeverity = {
    critical: openErrors.filter((e) => e.severity === "critical").length,
    warning: openErrors.filter((e) => e.severity === "warning").length,
    info: openErrors.filter((e) => e.severity === "info").length,
  };

  const byTenant = tenants.map((t) => {
    const te = events.filter((e) => e.tenantId === t.id);
    const s = te.filter((e) => e.status === "success").length;
    return {
      id: t.id, name: t.name, status: t.status,
      syncs: te.length,
      successRate: te.length ? Math.round((s / te.length) * 100) : null,
      openErrors: openErrors.filter((e) => e.tenantId === t.id).length,
    };
  });

  return {
    window24h: { total, success, failed, pushes, pulls, successRate: total ? Math.round((success / total) * 100) : null },
    openErrors: openErrors.length,
    bySeverity,
    byTenant,
    failedRecent: failedRecent.map((e) => ({ id: e.id, property: e.property.name, channel: e.channel?.name ?? "—", summary: e.summary, detail: e.detail, createdAt: e.createdAt })),
  };
}

/** Billing overview: each client's plan + computed monthly price + this month's invoice, plus MRR. */
export async function getBilling() {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [tenants, invoices] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.invoice.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const byKey = new Map(invoices.map((i) => [`${i.tenantId}:${i.period}`, i]));
  const tenantName = new Map(tenants.map((t) => [t.id, t.name]));

  const clients = tenants.map((t) => {
    const ent: Entitlements = { channelManager: t.hasChannelManager, reservation: t.hasReservation, pms: t.hasPms };
    const priceMinor = monthlyPriceMinor(t.plan, ent);
    const current = byKey.get(`${t.id}:${period}`) ?? null;
    return {
      id: t.id, name: t.name, plan: t.plan, status: t.status,
      products: billedProducts(ent) || "—",
      priceMinor,
      currentInvoice: current ? { id: current.id, status: current.status, amountMinor: current.amountMinor } : null,
    };
  });

  const mrr = clients.filter((c) => c.status === "active").reduce((s, c) => s + c.priceMinor, 0);
  const recent = invoices.slice(0, 15).map((i) => ({ id: i.id, tenant: tenantName.get(i.tenantId) ?? "—", period: i.period, amountMinor: i.amountMinor, currency: i.currency, status: i.status }));
  return { period, clients, mrr, unpaidCount: invoices.filter((i) => i.status !== "paid").length, recent };
}

/** Operator staff (us) — the people who can log into this console. */
export async function getOperatorUsers() {
  return prisma.operatorUser.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
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
