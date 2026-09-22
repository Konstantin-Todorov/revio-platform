import "server-only";
import { forSystem } from "@revio/db";

/**
 * How deeply each product is actually used by the hotels that have it.
 *
 * ## The question this answers, which nothing else on the console does
 *
 * `usage.ts` answers "is anyone there" and "which screens earn their keep" — both about the
 * PLATFORM. This one is about a PRODUCT: of the hotels entitled to RevioPMS, how many have ever
 * opened it, and how many opened it this week?
 *
 * That gap is the number that decides a renewal. A hotel billed for three products and opening one
 * is not a happy customer who is quiet; it is a cancellation with a date on it. The operator's
 * client page already shows "billed for and never opened" per hotel — this is the same fact read
 * the other way round, per product, so a pattern is visible before it is six separate surprises.
 *
 * ## ⚠️ Entitled, not billed
 *
 * The denominator is the entitlement flag, because that is what grants access. A trial tenant is
 * entitled and not yet billed, and it belongs in this number — a trial nobody opens is the single
 * most useful thing to know before the trial ends.
 *
 * ## ⚠️ Demo tenants are INCLUDED, and that is the standing rule
 *
 * `demo.ts`: money and portfolio metrics exclude demo; operations and health include it. Adoption
 * is operations. A demo hotel clicking through RevioPMS is real evidence about whether the product
 * is reachable, and excluding it would leave this empty. They are counted separately as well, so
 * the number can be read either way.
 */

const DAY = 86_400_000;
const midnightUtc = (offsetDays = 0) =>
  new Date(`${new Date(Date.now() - offsetDays * DAY).toISOString().slice(0, 10)}T00:00:00.000Z`);

export interface AdoptionRow {
  product: "cm" | "crs" | "pms";
  productName: string;
  /** Hotels whose entitlement grants this product. */
  entitled: number;
  /** …of those, how many have ever opened a screen of it in the last 30 days. */
  opened30: number;
  /** …and in the last 7. */
  opened7: number;
  /** Entitled, and not one screen opened in 30 days. The renewal-call list. */
  neverOpened: { tenantId: string; name: string; isDemo: boolean }[];
  /** Distinct screens the busiest adopter has reached, against how many that product has. */
  screensSeen: number;
  screensTotal: number;
}

const PRODUCTS = [
  { key: "cm", name: "RevioLink", flag: "hasChannelManager" },
  { key: "crs", name: "RevioCRS", flag: "hasReservation" },
  { key: "pms", name: "RevioPMS", flag: "hasPms" },
] as const;

export async function getAdoption(): Promise<{ rows: AdoptionRow[]; recording: boolean }> {
  const prisma = forSystem();
  const from30 = midnightUtc(29);
  const from7 = midnightUtc(6);

  const [tenants, usage] = await Promise.all([
    prisma.tenant.findMany({
      select: {
        id: true, name: true, isDemo: true,
        hasChannelManager: true, hasReservation: true, hasPms: true,
      },
    }),
    prisma.featureUsage.findMany({
      where: { day: { gte: from30 } },
      select: { tenantId: true, product: true, route: true, day: true },
    }),
  ]);

  const rows = PRODUCTS.map(({ key, name, flag }) => {
    const entitled = tenants.filter((t) => t[flag]);
    const forProduct = usage.filter((u) => u.product === key);

    const opened30Ids = new Set(forProduct.map((u) => u.tenantId));
    const opened7Ids = new Set(forProduct.filter((u) => u.day >= from7).map((u) => u.tenantId));

    /*
      ⚠️ `screensTotal` is how many DISTINCT screens of this product anyone has reached, across every
      hotel — not a hardcoded count of routes that exist. A hardcoded number goes stale the day a
      screen ships and nobody notices; this one cannot, and it is honest about what it is: the
      widest anyone has gone, which is the only figure the data can support.
    */
    const allRoutes = new Set(forProduct.map((u) => u.route));
    const perTenantRoutes = new Map<string, Set<string>>();
    for (const u of forProduct) {
      if (!perTenantRoutes.has(u.tenantId)) perTenantRoutes.set(u.tenantId, new Set());
      perTenantRoutes.get(u.tenantId)!.add(u.route);
    }

    return {
      product: key,
      productName: name,
      entitled: entitled.length,
      opened30: entitled.filter((t) => opened30Ids.has(t.id)).length,
      opened7: entitled.filter((t) => opened7Ids.has(t.id)).length,
      neverOpened: entitled
        .filter((t) => !opened30Ids.has(t.id))
        .map((t) => ({ tenantId: t.id, name: t.name, isDemo: t.isDemo })),
      screensSeen: Math.max(0, ...[...perTenantRoutes.values()].map((s) => s.size)),
      screensTotal: allRoutes.size,
    };
  });

  return { rows, recording: usage.length > 0 };
}
