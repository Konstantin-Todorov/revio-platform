import "server-only";
import { forSystem } from "@revio/db";
import {
  buildFeed, type AttentionItem, type NotificationEvent, type NotificationFeed,
} from "@revio/core";
import { getOperatorSession } from "./session";
import { getNotifications } from "./data";

const prisma = forSystem();
/**
 * ⚠️ The console's own clock — OUR working day, not a hotel's.
 *
 * Every other product resolves "today" from the property being looked at, because that is whose day
 * it is. This console looks at every hotel at once and belongs to none of them, so the only honest
 * answer is the timezone of the people reading it: Revio is a Bulgarian company. Falling back to
 * UTC would put a 01:00 Sofia demo request under "Yesterday" for the person who has to answer it.
 */
export const OPERATOR_TIME_ZONE = "Europe/Sofia";

const WINDOW_DAYS = 14;
const PER_SOURCE = 25;

/**
 * What the Operator console tells us happened — across every hotel.
 *
 * ## ⚠️ The one feed that crosses tenants
 *
 * Read through `forSystem()`, which bypasses tenant RLS. Correct here and nowhere else, so the gate
 * is `getOperatorSession()` and it returns an empty feed — never a partial one — without an
 * operator identity.
 *
 * ## Demo hotels are in it, and badged
 *
 * `lib/demo.ts`: *money and portfolio metrics exclude demo; operations and health include it.* A
 * notification is neither a metric nor a total — it is a thing that happened, and a demo hotel's
 * failing push is a real failing push. So they appear, every one of them marked **Demo**, exactly as
 * they do in search. Hiding them would make the console lie about what exists; showing them
 * unmarked would make it lie about who pays.
 *
 * ## What an operator is actually waiting for
 *
 * Somebody asking for a demo, an invoice being paid, a trial starting, and a hotel's distribution
 * breaking. The first is the business, the last is the product, and both arrive in the same minute
 * of the same morning.
 */
export async function getNotificationFeed(): Promise<NotificationFeed> {
  const session = await getOperatorSession();
  if (!session) return { attention: [], events: [], unread: 0 };

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);

  const [leads, invoices, trials, failures, operator] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, name: true, company: true, rooms: true, createdAt: true, handledAt: true },
      orderBy: { createdAt: "desc" },
      take: PER_SOURCE,
    }),
    prisma.invoice.findMany({
      where: { paidAt: { gte: since } },
      select: { id: true, number: true, period: true, amountMinor: true, currency: true, paidAt: true, tenantId: true },
      orderBy: { paidAt: "desc" },
      take: PER_SOURCE,
    }),
    prisma.productTrial.findMany({
      where: { startedAt: { gte: since } },
      select: { id: true, product: true, startedAt: true, endsAt: true, tenantId: true },
      orderBy: { startedAt: "desc" },
      take: PER_SOURCE,
    }),
    prisma.syncEvent.findMany({
      where: { status: "failed", createdAt: { gte: since } },
      select: {
        id: true, kind: true, summary: true, createdAt: true, tenantId: true,
        channel: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PER_SOURCE,
    }),
    prisma.operatorUser.findUnique({
      where: { id: session.userId },
      select: { notificationsClearedAt: true, notificationsReadKeys: true },
    }),
  ]);

  /* One lookup for every tenant mentioned, rather than a join per source — `Invoice` has no
     `tenant` relation at all (it lives in the operator's own admin space, deliberately unjoined to
     the hotel's tables), so a join is not available even where it would be tidier. */
  const tenantIds = [...new Set([
    ...invoices.map((i) => i.tenantId),
    ...trials.map((t) => t.tenantId),
    ...failures.map((f) => f.tenantId),
  ])];
  const tenants = tenantIds.length
    ? await prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true, isDemo: true },
      })
    : [];
  const byId = new Map(tenants.map((t) => [t.id, t]));
  const who = (id: string) => byId.get(id);
  /* The chip says "not a real hotel" — the one fact an operator must never miss while reading a
     figure. Which client they are is in the subtitle, where every row already names exactly one. */
  const demo = (id: string) => (who(id)?.isDemo ? { context: "Demo" } : {});
  const money = (minor: number, currency: string) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(minor / 100);
  const PRODUCT: Record<string, string> = { cm: "RevioLink", crs: "RevioCRS", pms: "RevioPMS" };

  const events: NotificationEvent[] = [
    ...leads.map((l): NotificationEvent => ({
      key: `lead:${l.id}`,
      title: `Demo request — ${l.company || l.name}`,
      body: [l.rooms ? `${l.rooms} rooms` : null, l.handledAt ? "handled" : "not yet answered"]
        .filter(Boolean).join(" · "),
      href: "/leads",
      // Not yet answered is the one that decays: an enquiry left overnight is a lost sale.
      severity: l.handledAt ? "info" : "warning",
      at: l.createdAt,
    })),
    ...invoices.map((i): NotificationEvent => ({
      key: `paid:${i.id}`,
      title: `Invoice ${i.number ?? i.period} paid`,
      body: `${who(i.tenantId)?.name ?? "unknown client"} · ${money(i.amountMinor, i.currency)}`,
      href: "/billing",
      severity: "success",
      at: i.paidAt!,
      ...demo(i.tenantId),
    })),
    ...trials.map((t): NotificationEvent => ({
      key: `trial:${t.id}`,
      title: `${PRODUCT[t.product] ?? t.product} trial started`,
      body: `${who(t.tenantId)?.name ?? "unknown client"} · ends ${t.endsAt.toISOString().slice(0, 10)}`,
      href: "/clients",
      severity: "info",
      at: t.startedAt,
      ...demo(t.tenantId),
    })),
    ...failures.map((f): NotificationEvent => ({
      key: `sync:${f.id}`,
      title: `${f.kind} failed — ${who(f.tenantId)?.name ?? "unknown client"}`,
      body: [f.channel?.name, f.summary].filter(Boolean).join(" · ") || undefined,
      href: "/health",
      severity: "critical",
      at: f.createdAt,
      ...demo(f.tenantId),
    })),
  ];

  const { items } = await getNotifications();

  return buildFeed(
    events,
    items as AttentionItem[],
    {
      clearedAt: operator?.notificationsClearedAt ?? null,
      readKeys: new Set(operator?.notificationsReadKeys ?? []),
    },
    /* Both operator roles may READ the whole console — `support` is restricted from writes, screen
       by screen, and needs to see everything in order to support it. */
    () => true,
  );
}
