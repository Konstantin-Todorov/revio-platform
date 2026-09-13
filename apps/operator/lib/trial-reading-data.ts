import "server-only";
import { forSystem } from "@revio/db";
import { readTrial, trialsByUrgency, type ProductKey, type TrialReading } from "@revio/core";


/**
 * Every trial, with what the hotel actually did during it.
 *
 * The join is the point. A trial row says when it started and when it ends; `FeatureUsage` and
 * `ActiveUserDay` say whether anybody turned up, which product they went to, and how many of them
 * there were. Separately each is a number; together they answer the only two questions worth
 * asking — *is this going to become a customer*, and *what do we sell them*.
 *
 * ⚠️ **Usage is counted only WITHIN the trial window.** A hotel that used RevioLink for a year and
 * is now trialling RevioPMS would otherwise look like a wildly engaged PMS trial on the strength of
 * activity that has nothing to do with it.
 */

export interface TrialRow {
  tenantId: string;
  tenantName: string;
  isDemo: boolean;
  product: ProductKey;
  startedAt: Date;
  endsAt: Date;
  reading: TrialReading;
}

export async function getTrialReadings(now = new Date()): Promise<{
  rows: TrialRow[];
  running: number;
  needAttention: number;
}> {
  const prisma = forSystem();

  const trials = await prisma.productTrial.findMany({
    select: {
      product: true, startedAt: true, endsAt: true, endedAt: true, outcome: true, keepRequestedAt: true,
      tenant: { select: { id: true, name: true, isDemo: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 300,
  });
  if (trials.length === 0) return { rows: [], running: 0, needAttention: 0 };

  const tenantIds = [...new Set(trials.map((t) => t.tenant.id))];
  const earliest = trials.reduce((min, t) => (t.startedAt < min ? t.startedAt : min), trials[0]!.startedAt);

  const [usage, actives] = await Promise.all([
    prisma.featureUsage.groupBy({
      by: ["tenantId", "product", "day"],
      where: { tenantId: { in: tenantIds }, day: { gte: earliest } },
      _sum: { views: true },
    }),
    prisma.activeUserDay.findMany({
      where: { tenantId: { in: tenantIds }, day: { gte: earliest } },
      select: { tenantId: true, product: true, day: true, userId: true },
    }),
  ]);

  const rows: TrialRow[] = trials.map((t) => {
    const within = (d: Date) => d >= t.startedAt && d <= (t.endedAt ?? t.endsAt);

    const mine = usage.filter((u) => u.tenantId === t.tenant.id && within(u.day));
    const myActives = actives.filter((a) => a.tenantId === t.tenant.id && within(a.day));

    const byProduct = (["cm", "crs", "pms"] as ProductKey[]).map((product) => {
      const u = mine.filter((x) => x.product === product);
      const a = myActives.filter((x) => x.product === product);
      return {
        product,
        activeDays: new Set(u.map((x) => x.day.toISOString().slice(0, 10))).size,
        views: u.reduce((s, x) => s + (x._sum.views ?? 0), 0),
        people: new Set(a.map((x) => x.userId)).size,
      };
    });

    const lastDay = myActives.concat(mine.map((u) => ({ ...u, userId: "" }) as never))
      .map((x) => (x as { day: Date }).day)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const reading = readTrial({
      startedAt: t.startedAt,
      endsAt: t.endsAt,
      endedAt: t.endedAt,
      outcome: t.outcome,
      keepRequestedAt: t.keepRequestedAt,
      usage: byProduct,
      lastSeenDaysAgo: lastDay ? Math.max(0, Math.floor((now.getTime() - lastDay.getTime()) / 86_400_000)) : null,
      now,
    });

    return {
      tenantId: t.tenant.id,
      tenantName: t.tenant.name,
      isDemo: t.tenant.isDemo,
      product: t.product as ProductKey,
      startedAt: t.startedAt,
      endsAt: t.endsAt,
      reading,
    };
  });

  /*
   * Demo tenants are kept, not dropped — the house rule is that money and portfolio metrics exclude
   * them while operations include them, and a trial is neither. They are badged on screen instead,
   * because a demo trial IS a real exercise of the trial machinery and hiding it would mean nobody
   * ever sees this screen working before the first real signup.
   */
  return {
    rows: trialsByUrgency(rows),
    running: rows.filter((r) => r.reading.daysLeft >= 0 && r.reading.verdict !== "converted" && !["ended_cold", "ended_engaged"].includes(r.reading.verdict)).length,
    needAttention: rows.filter((r) => r.reading.urgency === "now").length,
  };
}
