import "server-only";
import { forSystem, decryptSecret, keyHint } from "@revio/db";
import { monthlyPriceMinor, billedProducts, type Entitlements } from "./pricing";
import { clientAttention, sortBySeverity, worstSeverity } from "./attention";
import { clientOpportunities, pipelineMinor } from "./upsell";
import { tierDrift } from "./pricing";
import { channelEconomics, nightsInRange, stayNights, SOLD_STATUSES } from "@revio/core";

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
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const tenants = await prisma.tenant.findMany({
    include: { properties: { select: { id: true, name: true } }, users: { where: { role: "owner" }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });

  return Promise.all(
    tenants.map(async (t) => {
      const [roomTypes, channels, channelsConnected, reservations, openErrors, lastSync,
             units, lastReservation, reservationsLast30d, bookingEngineProperties, directLast30d, unpaidInvoices] = await Promise.all([
        prisma.roomType.count({ where: { tenantId: t.id } }),
        prisma.channel.count({ where: { tenantId: t.id } }),
        prisma.channel.count({ where: { tenantId: t.id, status: "connected" } }),
        prisma.reservation.count({ where: { tenantId: t.id } }),
        prisma.errorItem.count({ where: { tenantId: t.id, resolved: false } }),
        prisma.channel.findFirst({ where: { tenantId: t.id, lastSyncAt: { not: null } }, orderBy: { lastSyncAt: "desc" }, select: { lastSyncAt: true } }),
        // Signals for `clientAttention` — each one exists to answer a question the counts cannot:
        // is a product they pay for actually set up, and are they still using the thing at all.
        prisma.unit.count({ where: { tenantId: t.id } }),
        prisma.reservation.findFirst({ where: { tenantId: t.id }, orderBy: { importedAt: "desc" }, select: { importedAt: true } }),
        prisma.reservation.count({ where: { tenantId: t.id, importedAt: { gte: thirtyDaysAgo } } }),
        prisma.property.count({ where: { tenantId: t.id, bookingEngineEnabled: true } }),
        prisma.reservation.count({
          where: { tenantId: t.id, importedAt: { gte: thirtyDaysAgo }, bookingSource: { category: "direct" } },
        }),
        prisma.invoice.findMany({
          where: { tenantId: t.id, status: { not: "paid" } },
          orderBy: { period: "asc" },
          select: { period: true, amountMinor: true, status: true },
        }),
      ]);

      const entitlements = { channelManager: t.hasChannelManager, reservation: t.hasReservation, pms: t.hasPms };
      const attention = sortBySeverity(
        clientAttention({
          status: t.status,
          createdAt: t.createdAt,
          entitlements,
          properties: t.properties.length,
          roomTypes, units, channels, channelsConnected, openErrors,
          lastSyncAt: lastSync?.lastSyncAt ?? null,
          lastReservationAt: lastReservation?.importedAt ?? null,
          reservationsLast30d,
          bookingEngineProperties,
          directReservationsLast30d: directLast30d,
          unpaidInvoices,
          monthlyPriceMinor: monthlyPriceMinor(t.plan, entitlements),
        }),
      );

      return {
        attention,
        worst: worstSeverity(attention),
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        status: t.status,
        entitlements,
        owner: t.users[0] ? { name: t.users[0].name, email: t.users[0].email } : null,
        properties: t.properties,
        counts: { roomTypes, units, channels, channelsConnected, reservations, openErrors },
        lastSyncAt: lastSync?.lastSyncAt ?? null,
      };
    }),
  );
}

export type OperatorDashboard = Awaited<ReturnType<typeof getOperatorDashboard>>;

/**
 * The operator's morning screen: what happened, what is coming, and who needs me most.
 *
 * The old Overview was seven counters. Counters answer "is it alive"; running a business needs the
 * other three questions, and two of them are only answerable because we hold one shared core.
 *
 * **Backward** is our own billed revenue (from `Invoice`, so it is what we actually charged rather
 * than a recomputed guess) plus platform booking volume. **Forward** is the part no ordinary SaaS
 * dashboard can show: our clients' on-the-books reservations for the months ahead. Their pipeline is
 * our leading indicator — a portfolio whose next quarter is filling is a portfolio that renews, and
 * we can see it months before a churn model would.
 */
export async function getOperatorDashboard() {
  const now = new Date();
  const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  };
  const shiftMonth = (n: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + n, 1));
  const ymdUtc = (d: Date) => d.toISOString().slice(0, 10);

  const backKeys = Array.from({ length: 12 }, (_, i) => monthKey(shiftMonth(-11 + i)));
  const fwdKeys = Array.from({ length: 6 }, (_, i) => monthKey(shiftMonth(i)));
  const backFrom = shiftMonth(-11);
  const fwdTo = shiftMonth(6);

  const [clients, invoices, booked, onTheBooks] = await Promise.all([
    getClients(),
    prisma.invoice.findMany({ where: { period: { in: backKeys } }, select: { period: true, amountMinor: true, status: true } }),
    prisma.reservation.findMany({ where: { importedAt: { gte: backFrom } }, select: { importedAt: true } }),
    // Every client's future room-nights and revenue. This is the forward view.
    prisma.reservationLine.findMany({
      where: { checkIn: { gte: shiftMonth(0), lt: fwdTo }, reservation: { status: { in: [...SOLD_STATUSES] } } },
      select: { checkIn: true, checkOut: true, quantity: true, priceMinor: true },
    }),
  ]);

  const zero = <T,>(keys: string[], make: () => T) => new Map(keys.map((k) => [k, make()]));

  const billedByMonth = zero(backKeys, () => ({ billedMinor: 0, paidMinor: 0 }));
  for (const i of invoices) {
    const b = billedByMonth.get(i.period);
    if (!b) continue;
    b.billedMinor += i.amountMinor;
    if (i.status === "paid") b.paidMinor += i.amountMinor;
  }

  const bookingsByMonth = zero(backKeys, () => 0);
  for (const r of booked) {
    const k = monthKey(r.importedAt);
    if (bookingsByMonth.has(k)) bookingsByMonth.set(k, bookingsByMonth.get(k)! + 1);
  }

  const futureByMonth = zero(fwdKeys, () => ({ roomNights: 0, revenueMinor: 0 }));
  // Room-nights are quantity × NIGHTS, and a stay's revenue is prorated across the months it spans —
  // the same `nightsInRange` proration the CRS metrics use, reused rather than reinvented so the two
  // views of the same reservations cannot disagree. Counting lines and dumping a whole stay into its
  // check-in month is how a five-night booking over a month boundary reads as one room-night in the
  // wrong month.
  const monthBounds = fwdKeys.map((k, i) => ({
    key: k,
    start: ymdUtc(shiftMonth(i)),
    endExcl: ymdUtc(shiftMonth(i + 1)),
  }));
  for (const l of onTheBooks) {
    const ci = ymdUtc(l.checkIn);
    const co = ymdUtc(l.checkOut);
    const total = stayNights(ci, co);
    for (const b of monthBounds) {
      const n = nightsInRange(ci, co, { start: b.start, endExcl: b.endExcl });
      if (n === 0) continue;
      const f = futureByMonth.get(b.key)!;
      f.roomNights += l.quantity * n;
      if (l.priceMinor != null && total > 0) f.revenueMinor += Math.round((l.priceMinor * n) / total);
    }
  }

  const active = clients.filter((c) => c.status === "active");
  const mrrMinor = active.reduce((s, c) => s + monthlyPriceMinor(c.plan, c.entitlements), 0);

  // Per-client rollup for the leaderboard + the attention feed. getClients already did the per-tenant
  // work, so this is arithmetic rather than another N queries.
  const rows = clients.map((c) => {
    // Physical rooms, never room types — the tier is priced on rooms, and the detail page agrees.
    const drift = tierDrift(c.plan, c.counts.units);
    return {
      id: c.id, name: c.name, status: c.status, plan: c.plan,
      monthlyMinor: monthlyPriceMinor(c.plan, c.entitlements),
      attention: c.attention, worst: c.worst,
      openErrors: c.counts.openErrors, reservations: c.counts.reservations,
      driftMinor: drift && drift.monthlyDeltaMinor > 0 ? drift.monthlyDeltaMinor : 0,
    };
  });

  // The attention feed: every flag from every client, most urgent first, each carrying who it is
  // about. A per-client list you have to open forty times is not a morning screen.
  const RANK = { act: 0, soon: 1, note: 2 } as const;
  const feed = rows
    .flatMap((r) => r.attention.map((f) => ({ ...f, clientId: r.id, clientName: r.name })))
    .sort((a, b) => RANK[a.severity] - RANK[b.severity]);

  return {
    money: {
      mrrMinor,
      unbilledDriftMinor: rows.reduce((s, r) => s + r.driftMinor, 0),
      clients: clients.length,
      active: active.length,
      suspended: clients.length - active.length,
    },
    back: backKeys.map((k) => ({
      key: k, label: monthLabel(k),
      billedMinor: billedByMonth.get(k)!.billedMinor,
      paidMinor: billedByMonth.get(k)!.paidMinor,
      bookings: bookingsByMonth.get(k)!,
    })),
    forward: fwdKeys.map((k) => ({
      key: k, label: monthLabel(k),
      roomNights: futureByMonth.get(k)!.roomNights,
      revenueMinor: futureByMonth.get(k)!.revenueMinor,
    })),
    feed,
    rows: [...rows].sort((a, b) => b.monthlyMinor - a.monthlyMinor),
  };
}

export type ClientDetail = NonNullable<Awaited<ReturnType<typeof getClientDetail>>>;

/**
 * Everything about ONE client, on one page.
 *
 * The console could always answer "how many hotels do we have". It could not answer "how is Hotel
 * Sofia doing", which is the question actually asked before a renewal call — that needed four screens
 * and still left out their users, their booking-engine status and their invoices.
 *
 * The commission figures come from `channelEconomics`, the SAME function that renders the hotel's own
 * Cost of distribution screen. That is deliberate: an upsell built on a number the customer can open
 * and check is a different conversation from one they have to take on faith, and if the two ever
 * disagreed the pitch would be worthless. One implementation, so they cannot.
 */
export async function getClientDetail(id: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      properties: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, timezone: true, baseCurrency: true, publicSlug: true, bookingEngineEnabled: true, status: true },
      },
      users: { orderBy: { name: "asc" }, select: { id: true, name: true, email: true, role: true, active: true } },
    },
  });
  if (!tenant) return null;

  const [roomTypes, units, channels, channelsConnected, reservations, openErrors, lastSync,
         lastReservation, reservationsLast30d, invoices, recentFailures, lines] = await Promise.all([
    prisma.roomType.count({ where: { tenantId: id } }),
    prisma.unit.count({ where: { tenantId: id } }),
    prisma.channel.findMany({ where: { tenantId: id }, select: { id: true, name: true, code: true, status: true, commissionPct: true, lastSyncAt: true, errorCount: true } }),
    prisma.channel.count({ where: { tenantId: id, status: "connected" } }),
    prisma.reservation.count({ where: { tenantId: id } }),
    prisma.errorItem.count({ where: { tenantId: id, resolved: false } }),
    prisma.channel.findFirst({ where: { tenantId: id, lastSyncAt: { not: null } }, orderBy: { lastSyncAt: "desc" }, select: { lastSyncAt: true } }),
    prisma.reservation.findFirst({ where: { tenantId: id }, orderBy: { importedAt: "desc" }, select: { importedAt: true } }),
    prisma.reservation.count({ where: { tenantId: id, importedAt: { gte: thirtyDaysAgo } } }),
    prisma.invoice.findMany({ where: { tenantId: id }, orderBy: { period: "desc" }, take: 12 }),
    prisma.syncEvent.findMany({ where: { tenantId: id, status: "failed" }, orderBy: { createdAt: "desc" }, take: 5, include: { channel: { select: { name: true } } } }),
    // Reservation lines for the last 30 days, shaped for channelEconomics.
    prisma.reservationLine.findMany({
      where: { reservation: { tenantId: id, importedAt: { gte: thirtyDaysAgo } } },
      select: {
        priceMinor: true, quantity: true,
        reservation: {
          select: {
            id: true, status: true,
            channel: { select: { name: true, commissionPct: true, bookingSource: { select: { name: true, category: true } } } },
            bookingSource: { select: { name: true, category: true } },
          },
        },
      },
    }),
  ]);

  // Aggregate by source the same way the CRS does, then hand it to the shared function.
  const mix = new Map<string, { category: string; commissionPct: number | null; revenueMinor: number; roomNights: number; reservations: Set<string> }>();
  for (const l of lines) {
    const r = l.reservation;
    if (!(SOLD_STATUSES as readonly string[]).includes(r.status)) continue;
    const name = r.bookingSource?.name ?? r.channel?.bookingSource?.name ?? r.channel?.name ?? "Direct";
    const category = r.bookingSource?.category ?? r.channel?.bookingSource?.category ?? (r.channel ? "ota" : "direct");
    const e = mix.get(name) ?? { category, commissionPct: r.channel?.commissionPct ?? null, revenueMinor: 0, roomNights: 0, reservations: new Set<string>() };
    e.revenueMinor += l.priceMinor ?? 0;
    e.roomNights += l.quantity;
    e.reservations.add(r.id);
    mix.set(name, e);
  }
  const economics = channelEconomics(
    [...mix.entries()].map(([sourceName, m]) => ({
      sourceName, category: m.category, commissionPct: m.commissionPct,
      revenueMinor: m.revenueMinor, roomNights: m.roomNights, reservations: m.reservations.size,
    })),
  );

  const entitlements = { channelManager: tenant.hasChannelManager, reservation: tenant.hasReservation, pms: tenant.hasPms };
  const unpaidInvoices = invoices.filter((i) => i.status !== "paid").map((i) => ({ period: i.period, amountMinor: i.amountMinor, status: i.status }));
  const bookingEngineProperties = tenant.properties.filter((p) => p.bookingEngineEnabled).length;
  const monthly = monthlyPriceMinor(tenant.plan, entitlements);

  const attention = sortBySeverity(
    clientAttention({
      status: tenant.status, createdAt: tenant.createdAt, entitlements,
      properties: tenant.properties.length, roomTypes, units,
      channels: channels.length, channelsConnected, openErrors,
      lastSyncAt: lastSync?.lastSyncAt ?? null,
      lastReservationAt: lastReservation?.importedAt ?? null,
      reservationsLast30d, bookingEngineProperties,
      directReservationsLast30d: economics.rows.filter((r) => r.category === "direct").reduce((s, r) => s + r.reservations, 0),
      unpaidInvoices, monthlyPriceMinor: monthly,
    }),
  );

  const opportunities = clientOpportunities({
    plan: tenant.plan, entitlements, rooms: units, properties: tenant.properties.length,
    reservationsLast30d,
    commissionPaidLast30dMinor: economics.commissionPaidMinor,
    blendedOtaRatePct: economics.blendedOtaRatePct,
    directRevenueLast30dMinor: economics.directRevenueMinor,
    bookingEngineProperties, channelsConnected,
  });

  return {
    tenant, entitlements, attention, opportunities,
    pipelineMinor: pipelineMinor(opportunities),
    drift: tierDrift(tenant.plan, units),
    billing: { monthlyMinor: monthly, products: billedProducts(entitlements), invoices },
    counts: { roomTypes, units, channels: channels.length, channelsConnected, reservations, openErrors, reservationsLast30d },
    channels, recentFailures, economics,
    lastSyncAt: lastSync?.lastSyncAt ?? null,
    lastReservationAt: lastReservation?.importedAt ?? null,
  };
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
