import "server-only";
import { forSystem, decryptSecret, keyHint } from "@revio/db";
import {
  BOOKING_ENGINE_SOURCE_NAME, COMBINATIONS, PLAN_BASE_MINOR, PRODUCT_KEYS, ROOM_TIERS,
  TYPICAL_OTA_COMMISSION_PCT, attributeRevenue, billedProducts, combinationKeyOf, directBookingFeeMinor,
  entitlementsFor, monthlyPriceMinor, priceBreakdown, tierForRooms, type Entitlements, type ProductKey, effectivePlan } from "./pricing";
import { clientAttention, sortBySeverity, worstSeverity } from "./attention";
import { clientSetup, daysSince, setupStalled } from "./onboarding";
import { provisioningState, soldButNotProvisioned } from "./provisioning";
import { clientOpportunities, pipelineMinor } from "./upsell";
import { tierDrift } from "./pricing";
import { channelEconomics, SOLD_STATUSES } from "@revio/core";
import { bucketForward, monthBuckets } from "./forward";
import { partitionDemo } from "./demo";
import {
  CONTACT_KINDS, accountAttention, buildTimeline, lastContactAt, observedStage,
  type Stage, type TimelineItem,
} from "./account";

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

/**
 * The raw counters in the Overview footer.
 *
 * **Clients** counts real ones only — it sits beside MRR and reads as a business figure. Everything
 * else counts demo tenants too, because properties, channels and errors are claims about the
 * platform: a demo hotel's failing sync is a real failing sync, and finding it early is the whole
 * reason the demo tenants live in production. See `lib/demo.ts`.
 */
export async function getOverviewStats() {
  const [clients, properties, products, connectedChannels, reservations, openErrors, suspended] =
    await Promise.all([
      prisma.tenant.count({ where: { isDemo: false } }),
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
    include: {
      properties: { select: { id: true, name: true } },
      users: { where: { role: "owner" }, take: 1 },
      // The CRM half (L6). Only what the row and its flags need: the stage and renewal date we
      // believe, whether anyone is recorded as the person to call, and the last time we spoke.
      crmAccount: { select: { stage: true, renewalDate: true, ownerOperator: { select: { name: true } } } },
      crmContacts: { where: { isPrimary: true }, take: 1, select: { name: true, email: true, phone: true } },
      crmNotes: {
        where: { kind: { in: [...CONTACT_KINDS] } },
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { kind: true, occurredAt: true },
      },
    },
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
      const monthly = monthlyPriceMinor(t.plan, entitlements);
      const observed = observedStage({
        status: t.status, createdAt: t.createdAt,
        properties: t.properties.length, roomTypes,
        lastReservationAt: lastReservation?.importedAt ?? null,
      });

      // Two flag sources, one sorted list. `clientAttention` asks whether their software is working;
      // `accountAttention` asks whether we are looking after them. Both belong in the same feed —
      // "renews in 12 days" and "5 open sync errors" are the same morning's work.
      const attention = sortBySeverity([
        ...clientAttention({
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
          monthlyPriceMinor: monthly,
        }),
        ...accountAttention({
          status: t.status,
          createdAt: t.createdAt,
          // No account record yet means nobody has formed a view, so there is nothing to disagree with.
          stage: (t.crmAccount?.stage ?? "onboarding") as Stage,
          observed,
          renewalDate: t.crmAccount?.renewalDate ?? null,
          lastContactAt: lastContactAt(t.crmNotes),
          hasPrimaryContact: t.crmContacts.length > 0,
          monthlyPriceMinor: monthly,
        }),
      ]);

      return {
        attention,
        worst: worstSeverity(attention),
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        status: t.status,
        isDemo: t.isDemo,
        entitlements,
        owner: t.users[0] ? { name: t.users[0].name, email: t.users[0].email } : null,
        properties: t.properties,
        counts: { roomTypes, units, channels, channelsConnected, reservations, openErrors },
        lastSyncAt: lastSync?.lastSyncAt ?? null,
        account: {
          stage: (t.crmAccount?.stage ?? "onboarding") as Stage,
          observed,
          renewalDate: t.crmAccount?.renewalDate ?? null,
          accountManager: t.crmAccount?.ownerOperator?.name ?? null,
          primaryContact: t.crmContacts[0] ?? null,
          lastContactAt: lastContactAt(t.crmNotes),
        },
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
 *
 * Every figure on this screen is a claim about the business, so **demo tenants are excluded from all
 * of it** — including the charts, which is why the demo ids are resolved before anything else. The
 * exclusion is reported rather than silent; see `lib/demo.ts`.
 */
export async function getOperatorDashboard({ includeDemo = false }: { includeDemo?: boolean } = {}) {
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

  // Resolved first, because three of the four queries below have to exclude them at the database
  // rather than after the fact — a chart cannot un-count a booking it has already summed.
  //
  // `includeDemo` is the deliberate escape hatch: with no real customers yet this screen is entirely
  // zeros, and "look at the console and see nothing" is a poor way to check the console works. The
  // default stays honest; the toggle is opt-in, per request, and says so loudly on screen.
  const demoTenants = await prisma.tenant.findMany({ where: { isDemo: true }, select: { id: true } });
  const demoIds = includeDemo ? [] : demoTenants.map((t) => t.id);
  const notDemo = { tenantId: { notIn: demoIds } };

  const [clients, invoices, booked, onTheBooks] = await Promise.all([
    getClients(),
    prisma.invoice.findMany({ where: { period: { in: backKeys }, ...notDemo }, select: { period: true, amountMinor: true, status: true } }),
    prisma.reservation.findMany({ where: { importedAt: { gte: backFrom }, ...notDemo }, select: { importedAt: true } }),
    // Every client's future room-nights and revenue. This is the forward view.
    prisma.reservationLine.findMany({
      where: { checkIn: { gte: shiftMonth(0), lt: fwdTo }, reservation: { status: { in: [...SOLD_STATUSES] }, ...notDemo } },
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

  // Forward view via the tested `bucketForward` — extracted precisely because production cannot
  // exercise the cross-month case (every future stay currently begins and ends inside one month),
  // so an implementation that ignored boundaries would render identical numbers and look correct.
  const forwardTotals = bucketForward(
    onTheBooks.map((l) => ({
      checkIn: ymdUtc(l.checkIn),
      checkOut: ymdUtc(l.checkOut),
      quantity: l.quantity,
      priceMinor: l.priceMinor,
    })),
    monthBuckets(now, 6),
  );
  const futureByMonth = new Map(forwardTotals.map((f) => [f.key, f]));

  // Every figure below is a claim about the business, so demo tenants come out first — see lib/demo.ts.
  // They keep their own pages and their own flags; they just never reach a total.
  const split = partitionDemo(clients);
  const real = includeDemo ? clients : split.real;
  const demo = split.demo;
  const active = real.filter((c) => c.status === "active");
  const mrrMinor = active.reduce((s, c) => s + monthlyPriceMinor(c.plan, c.entitlements), 0);
  const demoActive = demo.filter((c) => c.status === "active");

  // Per-client rollup for the leaderboard + the attention feed. getClients already did the per-tenant
  // work, so this is arithmetic rather than another N queries.
  const rows = real.map((c) => {
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

  // Our own forward book, next to the clients'. Every other number on this screen is revenue we are
  // already earning; this is the revenue that has to be re-won, with a date on it. A renewal is the
  // one deadline in this business that arrives whether or not anyone prepared for it.
  const RENEWAL_HORIZON_DAYS = 120;
  const renewals = real
    .filter((c) => c.status === "active" && c.account.renewalDate)
    .map((c) => ({
      id: c.id,
      name: c.name,
      at: c.account.renewalDate!,
      days: Math.ceil((c.account.renewalDate!.getTime() - now.getTime()) / 86_400_000),
      monthlyMinor: monthlyPriceMinor(c.plan, c.entitlements),
      accountManager: c.account.accountManager,
    }))
    .filter((r) => r.days <= RENEWAL_HORIZON_DAYS)
    .sort((a, b) => a.days - b.days);

  return {
    money: {
      mrrMinor,
      unbilledDriftMinor: rows.reduce((s, r) => s + r.driftMinor, 0),
      clients: real.length,
      active: active.length,
      suspended: real.length - active.length,
    },
    demo: {
      included: includeDemo,
      count: demo.length,
      active: demoActive.length,
      // What they WOULD be worth. Shown separately so the exclusion is visible rather than silent —
      // a number quietly missing from a dashboard is the thing you never notice is missing.
      mrrMinor: demoActive.reduce((s, c) => s + monthlyPriceMinor(c.plan, c.entitlements), 0),
      names: demo.map((c) => ({ id: c.id, name: c.name })),
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
    renewals,
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
      // The CRM half (L6) — operator-only, and the reason this page can now be read before a call
      // rather than only after one.
      crmAccount: { include: { ownerOperator: { select: { id: true, name: true } } } },
      crmContacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      crmNotes: { orderBy: { occurredAt: "desc" }, take: 100 },
    },
  });
  if (!tenant) return null;

  const [roomTypes, units, channels, channelsConnected, reservations, openErrors, lastSync,
         lastReservation, reservationsLast30d, invoices, recentFailures, lines,
         firstReservation, operators,
         ratePlans, prices, taxes, catalogItems, unmappedRt, unmappedRp,
         hasChannexCredential, channelsWithExternalProperty, channelsLive] = await Promise.all([
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
    // Timeline milestones.
    prisma.reservation.findFirst({ where: { tenantId: id }, orderBy: { importedAt: "asc" }, select: { importedAt: true } }),
    prisma.operatorUser.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // The remaining facts the shared onboarding checklist reads (the rest are already above).
    prisma.ratePlan.count({ where: { tenantId: id } }),
    prisma.ratePrice.count({ where: { tenantId: id } }),
    prisma.taxFee.count({ where: { tenantId: id, active: true } }),
    prisma.posItem.count({ where: { tenantId: id } }),
    prisma.channelRoomTypeMapping.count({ where: { channel: { tenantId: id }, status: { not: "complete" } } }),
    prisma.channelRatePlanMapping.count({ where: { channel: { tenantId: id }, status: { not: "complete" } } }),
    // Provisioning facts — what WE owe them (provisioning.ts), not what they owe their setup.
    prisma.connectivityCredential.count({ where: { tenantId: id } }).then((n) => n > 0),
    prisma.channel.count({ where: { tenantId: id, externalPropertyId: { not: null } } }),
    // "Live" is stricter than "connected": a channel that has actually pushed. It is the state
    // Channex bills on, so it is the one worth counting separately.
    prisma.channel.count({ where: { tenantId: id, status: "connected", lastSyncAt: { not: null } } }),
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

  /*
   * What WE still owe this client, as opposed to what they still owe their own setup. See
   * `provisioning.ts` — the case it exists for is a CRS client who buys RevioLink, whose hotel-side
   * checklist reads 100% because the shared core already holds everything, while the product they
   * just paid for has no Channex property behind it.
   */
  const provisioning = provisioningState({
    entitlements,
    hasChannexCredential,
    channelsWithExternalProperty,
    channelsConnected,
    channelsLive,
    isDemo: tenant.isDemo,
  });
  const provisioningAlarm = soldButNotProvisioned({
    entitlements,
    hasChannexCredential,
    channelsWithExternalProperty,
    channelsConnected,
    channelsLive,
    isDemo: tenant.isDemo,
  });

  const unpaidInvoices = invoices.filter((i) => i.status !== "paid").map((i) => ({ period: i.period, amountMinor: i.amountMinor, status: i.status }));
  const bookingEngineProperties = tenant.properties.filter((p) => p.bookingEngineEnabled).length;
  const monthly = monthlyPriceMinor(tenant.plan, entitlements);

  const observed = observedStage({
    status: tenant.status, createdAt: tenant.createdAt,
    properties: tenant.properties.length, roomTypes,
    lastReservationAt: lastReservation?.importedAt ?? null,
  });
  const contactedAt = lastContactAt(tenant.crmNotes);
  const statedStage = (tenant.crmAccount?.stage ?? "onboarding") as Stage;

  const attention = sortBySeverity([
    ...clientAttention({
      status: tenant.status, createdAt: tenant.createdAt, entitlements,
      properties: tenant.properties.length, roomTypes, units,
      channels: channels.length, channelsConnected, openErrors,
      lastSyncAt: lastSync?.lastSyncAt ?? null,
      lastReservationAt: lastReservation?.importedAt ?? null,
      reservationsLast30d, bookingEngineProperties,
      directReservationsLast30d: economics.rows.filter((r) => r.category === "direct").reduce((s, r) => s + r.reservations, 0),
      unpaidInvoices, monthlyPriceMinor: monthly,
    }),
    ...accountAttention({
      status: tenant.status, createdAt: tenant.createdAt,
      stage: statedStage, observed,
      renewalDate: tenant.crmAccount?.renewalDate ?? null,
      lastContactAt: contactedAt,
      hasPrimaryContact: tenant.crmContacts.some((c) => c.isPrimary),
      monthlyPriceMinor: monthly,
    }),
  ]);

  /**
   * One relationship log: what we wrote down, plus the moments the platform already knew about.
   *
   * The milestones are derived rather than stored. Writing "first booking taken" into a table at the
   * time would mean a timeline that is only correct for clients onboarded after this feature existed;
   * deriving it means every client already has a history the first time the page is opened.
   */
  const timeline = buildTimeline([
    ...tenant.crmNotes.map((n): TimelineItem => ({
      id: n.id, at: n.occurredAt, kind: n.kind, title: n.body,
      author: n.authorName, pinned: n.pinned,
    })),
    { id: `m-created-${tenant.id}`, at: tenant.createdAt, kind: "milestone", title: "Client created", detail: `Onboarded on ${tenant.createdAt.toISOString().slice(0, 10)}` },
    ...(firstReservation
      ? [{ id: `m-first-${tenant.id}`, at: firstReservation.importedAt, kind: "milestone", title: "First booking taken", detail: "The platform started carrying real revenue for them." } as TimelineItem]
      : []),
    ...invoices.flatMap((i): TimelineItem[] => [
      { id: `i-${i.id}`, at: i.createdAt, kind: "invoice", title: `Invoice ${i.period} issued`, detail: `€${(i.amountMinor / 100).toFixed(2)} — ${i.lineItems ?? ""}`.trim() },
      ...(i.paidAt ? [{ id: `p-${i.id}`, at: i.paidAt, kind: "invoice", title: `Invoice ${i.period} paid`, detail: `€${(i.amountMinor / 100).toFixed(2)}` } as TimelineItem] : []),
    ]),
  ]);

  const opportunities = clientOpportunities({
    plan: tenant.plan, entitlements, rooms: units, properties: tenant.properties.length,
    reservationsLast30d,
    commissionPaidLast30dMinor: economics.commissionPaidMinor,
    blendedOtaRatePct: economics.blendedOtaRatePct,
    directRevenueLast30dMinor: economics.directRevenueMinor,
    bookingEngineProperties, channelsConnected,
  });

  /**
   * How far this client has actually got, per product.
   *
   * Fed to the same `@revio/core` functions that draw the hotel's own checklist, so the console can
   * never show a step the customer cannot see. `staff` counts users beyond the single Owner the
   * operator created, which is what `reviopmsSetup` means by "add your team".
   */
  const setup = clientSetup(
    {
      roomTypes, ratePlans, hasRates: prices > 0,
      channels: channels.filter((c) => c.status !== "disconnected").length,
      mappingComplete: unmappedRt + unmappedRp === 0,
      units, staff: tenant.users.length, hasTaxes: taxes > 0, catalogItems, reservations,
    },
    entitlements,
  );
  const ageDays = daysSince(tenant.createdAt);

  return {
    tenant, entitlements, attention, opportunities,
    setup, ageDays, setupStalled: setupStalled(setup, ageDays),
    provisioning, provisioningAlarm,
    pipelineMinor: pipelineMinor(opportunities),
    drift: tierDrift(tenant.plan, units),
    billing: { monthlyMinor: monthly, products: billedProducts(entitlements), invoices },
    counts: { roomTypes, units, channels: channels.length, channelsConnected, reservations, openErrors, reservationsLast30d },
    channels, recentFailures, economics,
    lastSyncAt: lastSync?.lastSyncAt ?? null,
    lastReservationAt: lastReservation?.importedAt ?? null,
    // The CRM half.
    account: tenant.crmAccount,
    stage: statedStage,
    observedStage: observed,
    contacts: tenant.crmContacts,
    notes: tenant.crmNotes,
    lastContactAt: contactedAt,
    timeline,
    operators,
  };
}

/**
 * The price list, and what the portfolio actually looks like against it.
 *
 * Two halves that belong on one screen. The **matrix** is pure — every room tier × every way to buy
 * it, straight out of `priceBreakdown`, so the published price and the invoiced price cannot drift
 * apart. The **portfolio** half answers the questions the matrix cannot: which shapes people
 * actually buy, what each product earns, and what the model would change about today's bills.
 */
export async function getPlans() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const [tenants, unitCounts, engineLines, invoices] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, plan: true, status: true, isDemo: true, hasChannelManager: true, hasReservation: true, hasPms: true },
    }),
    prisma.unit.groupBy({ by: ["tenantId"], _count: { _all: true } }),
    // The billing basis for the usage fee: what OUR engine produced, not every direct booking.
    prisma.reservationLine.findMany({
      where: {
        reservation: {
          importedAt: { gte: thirtyDaysAgo },
          status: { in: [...SOLD_STATUSES] },
          bookingSource: { name: BOOKING_ENGINE_SOURCE_NAME },
        },
      },
      select: { priceMinor: true, reservation: { select: { tenantId: true } } },
    }),
    prisma.invoice.findMany({ orderBy: { period: "desc" }, select: { tenantId: true, period: true, amountMinor: true } }),
  ]);

  const units = new Map(unitCounts.map((u) => [u.tenantId, u._count._all]));
  // findMany is newest-first, so the first invoice seen for a tenant is its latest.
  const latestInvoice = new Map<string, { period: string; amountMinor: number }>();
  for (const i of invoices) if (!latestInvoice.has(i.tenantId)) latestInvoice.set(i.tenantId, i);

  const priced = tenants.map((t) => {
    const entitlements = { channelManager: t.hasChannelManager, reservation: t.hasReservation, pms: t.hasPms };
    const rooms = units.get(t.id) ?? 0;
    const invoiced = latestInvoice.get(t.id) ?? null;
    const monthlyMinor = monthlyPriceMinor(t.plan, entitlements);
    return {
      id: t.id, name: t.name, plan: t.plan, status: t.status, isDemo: t.isDemo, entitlements, rooms,
      combination: combinationKeyOf(entitlements),
      breakdown: priceBreakdown(t.plan, entitlements),
      monthlyMinor,
      drift: tierDrift(t.plan, rooms),
      lastInvoiced: invoiced,
      // What this model changes about the bill they last received. Zero when nothing moves.
      repriceDeltaMinor: invoiced ? monthlyMinor - invoiced.amountMinor : null,
    };
  });
  // Adoption and revenue are claims about the business; demo tenants are not business. They keep
  // their row in the repricing table below, where the point is what any tenant would be charged.
  const { real, demo } = partitionDemo(priced);
  const active = real.filter((p) => p.status === "active");

  // Adoption: which of the seven shapes people actually buy.
  const adoption = COMBINATIONS.map((c) => {
    const clients = active.filter((p) => p.combination === c.key);
    return {
      ...c,
      clients: clients.map((p) => ({ id: p.id, name: p.name, monthlyMinor: p.monthlyMinor })),
      count: clients.length,
      mrrMinor: clients.reduce((s, p) => s + p.monthlyMinor, 0),
    };
  });
  const unsold = active.filter((p) => p.combination === "none");

  // Revenue by product. `attributeRevenue` guarantees the parts sum to MRR exactly.
  const byProduct: Record<ProductKey, { minor: number; clients: number }> = {
    channelManager: { minor: 0, clients: 0 }, reservation: { minor: 0, clients: 0 }, pms: { minor: 0, clients: 0 },
  };
  let unallocatedMinor = 0;
  for (const p of active) {
    const a = attributeRevenue(p.plan, p.entitlements);
    unallocatedMinor += a.unallocatedMinor;
    for (const k of PRODUCT_KEYS) {
      byProduct[k].minor += a.byProduct[k];
      if (p.entitlements[k]) byProduct[k].clients += 1;
    }
  }
  const mrrMinor = active.reduce((s, p) => s + p.monthlyMinor, 0);

  // The usage half, on real bookings rather than an assumption.
  const engineRevenueMinor = engineLines.reduce((s, l) => s + (l.priceMinor ?? 0), 0);
  const engineTenants = new Set(engineLines.map((l) => l.reservation.tenantId)).size;

  // How the portfolio sits across the room tiers — and how many are on the wrong one.
  const tierSpread = ROOM_TIERS.map((t) => ({
    plan: t.plan,
    label: t.label,
    onThisPlan: active.filter((p) => p.plan === t.plan).length,
    shouldBeHere: active.filter((p) => tierForRooms(p.rooms).plan === t.plan).length,
  }));

  return {
    matrix: ROOM_TIERS.map((tier) => ({
      plan: tier.plan,
      label: tier.label,
      platformMinor: PLAN_BASE_MINOR[tier.plan] ?? 0,
      cells: COMBINATIONS.map((c) => ({
        key: c.key,
        breakdown: priceBreakdown(tier.plan, entitlementsFor(c.products)),
      })),
    })),
    adoption,
    unsold: unsold.map((p) => ({ id: p.id, name: p.name, monthlyMinor: p.monthlyMinor })),
    byProduct,
    unallocatedMinor,
    mrrMinor,
    clients: priced,
    activeCount: active.length,
    usage: {
      revenueMinor: engineRevenueMinor,
      feeMinor: directBookingFeeMinor(engineRevenueMinor),
      otaEquivalentMinor: Math.round((engineRevenueMinor * TYPICAL_OTA_COMMISSION_PCT) / 100),
      bookings: engineLines.length,
      tenants: engineTenants,
    },
    tierSpread,
    demo: { count: demo.length, names: demo.map((d) => ({ id: d.id, name: d.name })) },
    repricing: {
      // Only clients we have actually invoiced can have a delta; the rest are new-price by default.
      changed: priced.filter((p) => p.repriceDeltaMinor !== null && p.repriceDeltaMinor !== 0),
      neverInvoiced: priced.filter((p) => p.lastInvoiced === null).length,
    },
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
    /*
     * BOUNDED TO THE LAST 7 DAYS. This read had no time filter at all, so a panel headed "Recent
     * sync failures" cheerfully listed failures from June and read as a live incident every time
     * the page was opened. "Recent" has to mean something or the panel is decoration.
     */
    prisma.syncEvent.findMany({
      where: { status: "failed", createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" }, take: 10,
      include: { property: { select: { name: true } }, channel: { select: { name: true } } },
    }),
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
  const [tenants, invoices, unitCounts] = await Promise.all([
    /*
     * Billing details come along, because a client without them CANNOT BE INVOICED — `issueInvoice`
     * refuses without a legal name, country and address.
     *
     * Until now that was only discovered at the moment somebody tried to issue, which is the worst
     * time to learn it. Both real clients on the platform are in exactly that state today: no legal
     * name, no country, no VAT id. The screen has to say so before an invoice is due, not after.
     */
    prisma.tenant.findMany({ orderBy: { createdAt: "asc" }, include: { crmBilling: true } }),
    prisma.invoice.findMany({ orderBy: { createdAt: "desc" } }),
    /*
     * PHYSICAL rooms, per tenant — `Unit`, never `RoomType`.
     *
     * A room type is a catalogue entry (six of them for a twelve-room villa); a unit is a room you
     * can put somebody in. Using the wrong one put the same client in two different tiers on two
     * different screens once already, which is why the distinction is written down here.
     */
    prisma.unit.groupBy({ by: ["tenantId"], _count: { _all: true } }),
  ]);
  const byKey = new Map(invoices.map((i) => [`${i.tenantId}:${i.period}`, i]));
  const roomsByTenant = new Map(unitCounts.map((u) => [u.tenantId, u._count._all]));
  const tenantName = new Map(tenants.map((t) => [t.id, t.name]));

  const clients = tenants.map((t) => {
    const ent: Entitlements = { channelManager: t.hasChannelManager, reservation: t.hasReservation, pms: t.hasPms };
    const priceMinor = monthlyPriceMinor(t.plan, ent);
    const current = byKey.get(`${t.id}:${period}`) ?? null;
    return {
      id: t.id, name: t.name, plan: t.plan, status: t.status, isDemo: t.isDemo,
      products: billedProducts(ent) || "—",
      priceMinor,
      // Null until their first booking syncs. Carried to the screen so "no invoice" reads as the
      // promise being kept rather than as something that failed to run.
      billingStartsAt: t.billingStartsAt,
      // `number` is what tells the screen whether this is still a draft or a real document, so it
      // travels with the row rather than being inferred from `status`.
      currentInvoice: current
        ? { id: current.id, status: current.status, amountMinor: current.amountMinor, number: current.number, grossMinor: current.grossMinor }
        : null,
      // What is MISSING, not merely whether something exists — an operator needs to know what to go
      // and type. Country drives the VAT treatment, so its absence is not a cosmetic gap.
      // The tier the rooms imply, plus the override if one is in force. Both travel, because the
      // comparison between them IS the exception the screen has to show.
      effective: effectivePlan(roomsByTenant.get(t.id) ?? 0, t.planOverride
        ? { plan: t.planOverride, reason: t.planOverrideReason ?? "no reason recorded", by: t.planOverrideById, at: t.planOverrideAt }
        : null),
      billingGaps: [
        !t.crmBilling?.legalName ? "legal name" : null,
        !t.crmBilling?.country ? "country" : null,
        !t.crmBilling?.addressLine ? "address" : null,
      ].filter((x): x is string => x != null),
    };
  });

  // Demo tenants ARE invoiced — that is deliberate, so the billing flow stays testable end to end —
  // but their invoices never reach MRR or the unpaid count. See lib/demo.ts.
  const { real, demo } = partitionDemo(clients);
  const demoIds = new Set(demo.map((d) => d.id));
  const mrr = real.filter((c) => c.status === "active").reduce((s, c) => s + c.priceMinor, 0);
  const realInvoices = invoices.filter((i) => !demoIds.has(i.tenantId));
  const recent = invoices.slice(0, 15).map((i) => ({
    id: i.id, tenant: tenantName.get(i.tenantId) ?? "—", period: i.period,
    amountMinor: i.amountMinor, currency: i.currency, status: i.status, isDemo: demoIds.has(i.tenantId),
    number: i.number, grossMinor: i.grossMinor,
  }));
  return {
    period, clients, mrr,
    // AWAITING PAYMENT — issued and sent, not yet settled. An unsent draft is not an unpaid
    // invoice: nobody has been asked for the money, so counting it here makes the number unusable
    // for the one question finance asks of it.
    unpaidCount: realInvoices.filter((i) => i.status === "sent").length,
    recent,
    demoCount: demo.length,
  };
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

  /*
   * The Channex PROPERTY IDs, per client — the fact that actually varies per hotel.
   *
   * The API key is ours and there is one of it. What is per-villa is the property id Channex
   * generated when we provisioned, and the console showed it nowhere: the only per-client thing on
   * this screen was a key that should almost never be set. So the page implied the wrong thing was
   * per-hotel, which is how a key got pasted per client in the first place.
   */
  const channexProps = await prisma.channel.findMany({
    where: { connectivityMode: { not: "mock" }, externalPropertyId: { not: null } },
    select: { tenantId: true, externalPropertyId: true, connectivityMode: true, property: { select: { name: true } } },
  });
  const propsByTenant = new Map<string, { name: string; id: string; mode: string }[]>();
  for (const c of channexProps) {
    const list = propsByTenant.get(c.tenantId) ?? [];
    list.push({ name: c.property.name, id: c.externalPropertyId!, mode: c.connectivityMode });
    propsByTenant.set(c.tenantId, list);
  }

  const credFor = (tenantId: string, mode: string) => {
    const c = creds.find((x) => x.tenantId === tenantId && x.mode === mode);
    if (!c) return null;
    let hint = "••••";
    try {
      hint = keyHint(decryptSecret(c.cipher));
    } catch {
      hint = "•••• (undecryptable)";
    }
    return {
      hint, updatedAt: c.updatedAt,
      // `lastCheckOk === null` means NEVER TESTED, which is not the same as working. The screen
      // has to be able to tell those apart, so the null is carried rather than coerced.
      lastCheckOk: c.lastCheckOk, lastCheckedAt: c.lastCheckedAt, lastCheckMessage: c.lastCheckMessage,
    };
  };

  return tenants.map((t) => ({
    id: t.id,
    name: t.name,
    sandbox: credFor(t.id, "channex_sandbox"),
    prod: credFor(t.id, "channex_prod"),
    channexChannels: channexByTenant.get(t.id) ?? 0,
    channexProperties: propsByTenant.get(t.id) ?? [],
  }));
}

export interface LeadRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  rooms: string | null;
  currentSystem: string | null;
  channels: string | null;
  interestedIn: string | null;
  message: string | null;
  quote: string | null;
  page: string | null;
  source: string | null;
  handledAt: Date | null;
  createdAt: Date;
}

/**
 * Website demo requests — the record that did not exist.
 *
 * Every notification email was delivered and the founder still could not find them, because a mail
 * client is a notification channel and not a place to look. Unhandled first, because this is a
 * queue to work rather than an archive to browse.
 */
export async function listLeads(limit = 200): Promise<{ rows: LeadRow[]; openCount: number }> {
  const leads = await prisma.lead.findMany({
    orderBy: [{ handledAt: "asc" }, { createdAt: "desc" }],
    take: Math.min(limit, 500),
  });
  return {
    rows: leads.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      company: l.company,
      rooms: l.rooms,
      currentSystem: l.currentSystem,
      channels: l.channels,
      interestedIn: l.interestedIn,
      message: l.message,
      quote: l.quote,
      page: l.page,
      source: [l.utmSource, l.utmMedium, l.utmCampaign].filter(Boolean).join(" / ") || l.referrer,
      handledAt: l.handledAt,
      createdAt: l.createdAt,
    })),
    openCount: leads.filter((l) => !l.handledAt).length,
  };
}
