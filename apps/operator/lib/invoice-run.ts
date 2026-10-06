import "server-only";
import { isAccountType, isBillable, isBillingMode } from "@revio/core";
import { forSystem, isBillablePeriod } from "@revio/db";
import {
  DIRECT_BOOKING_FEE_PCT, billableEntitlements, billedProducts, directBookingFeeMinor,
  monthlyPriceMinor, priceBreakdown, type Entitlements,
} from "./pricing";
import { directUsageByTenant, periodRange } from "./direct-usage";
import { invoiceLines, type InvoiceLine } from "./invoice-lines";
import {
  firstBillableDay, proratedMinor, prorationFor, prorationNote, type Proration,
} from "@revio/core";

/**
 * The monthly invoice run.
 *
 * ⚠️ **Deliberately NOT in `actions-billing.ts`.** Everything exported from a `"use server"` file is
 * a POST endpoint that anyone who can reach the origin may call. This function generates invoices
 * for every tenant on the platform and takes no session, so as a server action it would be exactly
 * the hole `authz-lint` exists to catch — and it caught it. Here it is an ordinary module: the
 * operator console's gated action calls it, and so does the scheduled job behind `CRON_SECRET`.
 */
const prisma = forSystem();

function describe(
  plan: string,
  ent: Entitlements,
  usage?: { revenueMinor: number; bookings: number },
  proration?: Proration | null,
): string {
  const b = priceBreakdown(plan, ent);
  const parts = [plan, billedProducts(ent) || "no products"];
  if (b.discountMinor > 0) parts.push(`bundle −${b.discountPct}%`);
  /*
   * The first invoice has to explain itself on its face.
   *
   * A part-month charge that a hotel cannot reconcile to a price list reads as a mistake, and the
   * one place that matters most is the very first invoice we ever send them.
   */
  const note = prorationNote(proration ?? null);
  if (note) parts.push(note);
  // Named in the summary too, so a draft that changed because of usage says why it changed.
  if (usage && usage.revenueMinor > 0) {
    parts.push(`RevioDirect ${DIRECT_BOOKING_FEE_PCT}% on ${usage.bookings} booking${usage.bookings === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

/**
 * What one client owes for one period — the amount, the one-line summary, and the invoice lines.
 *
 * ⚠️ ONE computation for the draft and for the issued document.
 *
 * The draft priced a month with proration, trials excluded and the RevioDirect fee; issuing
 * re-derived the lines from the bare price list — no proration, no trial exclusion, no usage — and
 * refused whenever they differed ("the price list has changed since this draft"). So any client in
 * their first month, mid-trial or with a single direct booking could not be invoiced at all, and
 * automatic invoicing would have stopped on exactly the clients it exists for (found 2026-09-29).
 * Now both ask this, and the lines always sum to the amount.
 */
export async function billingFor(
  t: { id: string; plan: string; hasChannelManager: boolean; hasReservation: boolean; hasPms: boolean; billingStartsAt: Date | null },
  period: string,
  lang: "bg" | "en" = "en",
  ctx?: {
    usage?: { revenueMinor: number; bookings: number } | undefined;
    trialProducts?: string[];
    convertedEnd?: Date | null;
  },
): Promise<{ amountMinor: number; lineItems: string; lines: InvoiceLine[] }> {
  const { from, to } = periodRange(period);
  const trialProducts = ctx?.trialProducts ?? (await prisma.productTrial.findMany({
    where: { tenantId: t.id, endedAt: null }, select: { product: true },
  })).map((x) => x.product);
  const convertedEnd = ctx && "convertedEnd" in ctx ? ctx.convertedEnd ?? null : (await prisma.productTrial.findFirst({
    where: { tenantId: t.id, outcome: "converted", endedAt: { not: null } }, orderBy: { endedAt: "desc" }, select: { endedAt: true },
  }))?.endedAt ?? null;

  const held: Entitlements = { channelManager: t.hasChannelManager, reservation: t.hasReservation, pms: t.hasPms };
  const ent = billableEntitlements(held, trialProducts);
  const firstMonth = t.billingStartsAt !== null && t.billingStartsAt.toISOString().slice(0, 7) === period;
  const joined = firstMonth ? firstBillableDay(t.billingStartsAt, convertedEnd) : null;
  const proration = prorationFor(period, joined);
  const usage = ctx && "usage" in ctx && !(proration && joined && joined > from)
    ? ctx.usage
    : proration && joined && joined > from
      ? (await directUsageByTenant(joined, to)).get(t.id)
      : (await directUsageByTenant(from, to)).get(t.id);
  const usageFeeMinor = usage ? directBookingFeeMinor(usage.revenueMinor) : 0;
  const subscriptionMinor = proratedMinor(monthlyPriceMinor(t.plan, ent), proration);

  // Subscription lines scaled to the prorated total, the remainder on the first line so they sum exactly.
  const base = invoiceLines(t.plan, ent, undefined, lang);
  const baseSum = base.reduce((a, l) => a + l.netMinor, 0);
  const scaled = base.map((l) => ({ ...l, netMinor: baseSum ? Math.round((l.netMinor * subscriptionMinor) / baseSum) : 0 }));
  if (scaled.length) scaled[0]!.netMinor += subscriptionMinor - scaled.reduce((a, l) => a + l.netMinor, 0);
  const note = proration && proration.billedDays < proration.totalDays && proration.billedDays > 0
    ? (lang === "bg" ? ` (пропорционално: ${proration.billedDays} от ${proration.totalDays} дни, от ${proration.from.split("-").reverse().join(".")} г.)` : ` (${prorationNote(proration)})`)
    : "";
  const lines: InvoiceLine[] = [
    ...scaled.filter((l) => l.netMinor !== 0).map((l) => ({ ...l, description: l.description + note })),
    ...(usageFeeMinor > 0 ? invoiceLines(t.plan, ent, usage, lang).slice(base.length) : []),
  ];
  return { amountMinor: subscriptionMinor + usageFeeMinor, lineItems: describe(t.plan, ent, usage, proration), lines };
}

/**
 * The generation itself, with no session and no revalidation — so the scheduled job can call it.
 *
 * ⚠️ It is SCHEDULED, not only a button. `generateInvoices` looks at `new Date()` and generates the
 * CURRENT period only, so a month in which nobody pressed the button is a month that is never
 * invoiced at all — that revenue is not late, it is gone. A billing run that depends on somebody
 * remembering is the same class of defect as a trial that only ends when somebody remembers.
 *
 * Safe to run as often as the scheduler likes: it creates a draft that is absent, refreshes one
 * whose price has moved, and never touches an invoice that has been sent or paid.
 */
export async function runInvoiceGeneration(): Promise<{ period: string; created: number; refreshed: number }> {
  const period = new Date().toISOString().slice(0, 7);
  let created = 0;
  let refreshed = 0;
  const tenants = await prisma.tenant.findMany({ where: { status: "active" } });

  /*
   * ⚠️ Who we bill is the client's BILLING MODE, and nothing else (2026-09-28).
   *
   * A pilot hotel we are testing with, a demo and a test account all used to get drafts like a paying
   * client — and a draft is one "send" away from a real invoice. `isBillable` is the rule; a draft
   * left over from before a client stopped being billable is removed rather than left to be sent.
   * Sent and paid invoices are never touched.
   */
  const { from: periodFrom } = periodRange(period);
  const billable = tenants.filter((t) =>
    isBillable(
      {
        accountType: isAccountType(t.accountType) ? t.accountType : "live",
        billingMode: isBillingMode(t.billingMode) ? t.billingMode : "paying",
        freeUntil: t.freeUntil,
        status: t.status,
      },
      periodFrom,
    ),
  );
  const notBillable = await prisma.tenant.findMany({
    where: { id: { notIn: billable.map((t) => t.id) } },
    select: { id: true },
  });
  await prisma.invoice.deleteMany({
    where: { tenantId: { in: notBillable.map((t) => t.id) }, period, status: "draft", number: null },
  });

  /*
   * What RevioDirect produced this period, for every client at once.
   *
   * The 2% usage fee is the fourth component of the pricing model, and until now it was the only one
   * this loop did not bill: `directBookingFeeMinor` was computed for the Overview panel and never
   * reached an invoice. One query outside the loop rather than one per tenant, and — more
   * importantly — the SAME definition the Overview reads, so the number a client is charged is the
   * number the console shows.
   */
  const { from, to } = periodRange(period);
  const usageByTenant = await directUsageByTenant(from, to);

  /*
   * ⚠️ Which products are on a FREE TRIAL right now, so they are not invoiced.
   *
   * A trial is an entitlement flag — `hasPms` is true during a RevioPMS trial, because that is how
   * the hotel gets in. This loop priced straight from those flags, so every promise the platform
   * makes about a trial ("nothing is charged", on the product page, in the trial email, on the
   * self-serve screen and on the banner inside their own product) was contradicted by the invoice.
   *
   * And it is not only the free product that came out wrong: the bundle discount is priced by the
   * NUMBER of modules, so a third product arriving on trial re-priced the two they really do pay
   * for. See `billableEntitlements`.
   *
   * One query for every tenant rather than one per tenant, and the same function the hotel's own
   * billing screen uses — so the figure we charge and the figure they read cannot disagree.
   */
  const runningTrials = await prisma.productTrial.findMany({
    where: { endedAt: null },
    select: { tenantId: true, product: true },
  });
  const trialsByTenant = new Map<string, string[]>();
  for (const t of runningTrials) {
    trialsByTenant.set(t.tenantId, [...(trialsByTenant.get(t.tenantId) ?? []), t.product]);
  }

  /*
   * ⚠️ When each tenant's LAST free day was — the other half of "30 days free means 30 days".
   *
   * Excluding a product while its trial runs is not enough on its own. Converting sets
   * `endedAt = now` and keeps the entitlement, so from that instant the product is priced for the
   * whole calendar month — including the days earlier in that month that were free. A trial
   * converted on the 29th billed 30 days. `firstBillableDay` takes the later of this and
   * `billingStartsAt`, and the joining month is then charged pro rata.
   *
   * Only trials that were CONVERTED count. An expired or cancelled one took the entitlement away
   * with it, so there is nothing of it left to bill and its end date must not push a paid product's
   * joining day forward.
   */
  const convertedTrials = await prisma.productTrial.findMany({
    where: { outcome: "converted", endedAt: { not: null } },
    select: { tenantId: true, endedAt: true },
  });
  const convertedEndByTenant = new Map<string, Date>();
  for (const t of convertedTrials) {
    const seen = convertedEndByTenant.get(t.tenantId);
    if (!seen || (t.endedAt && t.endedAt > seen)) convertedEndByTenant.set(t.tenantId, t.endedAt!);
  }

  for (const t of billable) {
    /*
     * "Free until your first booking syncs" — honoured here, where the money is.
     *
     * The line is on every product page and this loop used to ignore it entirely: a client was billed
     * from the month they were created, whether or not the platform had ever done anything for them.
     *
     * `isBillablePeriod` carries both conditions — never before they became billable, and never for a
     * month that ended before that date. It is shared with the rule that SETS the date, so the two
     * halves of one promise cannot drift apart.
     */
    if (!isBillablePeriod(period, t.billingStartsAt)) continue;

    // The one computation — see `billingFor`. Batch-read context passed in, so the run stays one
    // query per kind rather than one per tenant.
    const { amountMinor, lineItems } = await billingFor(t, period, "en", {
      usage: usageByTenant.get(t.id),
      trialProducts: trialsByTenant.get(t.id) ?? [],
      convertedEnd: convertedEndByTenant.get(t.id) ?? null,
    });

    /*
     * `<= 0` and not `=== 0`: a client on no products who nonetheless took direct bookings still
     * owes the usage fee, and the old guard would have skipped them entirely.
     */
    if (amountMinor <= 0) continue;
    const exists = await prisma.invoice.findUnique({ where: { tenantId_period: { tenantId: t.id, period } } });

    if (!exists) {
      await prisma.invoice.create({ data: { tenantId: t.id, period, amountMinor, currency: "EUR", status: "draft", lineItems } });
      created++;
      continue;
    }
    if (exists.status !== "draft") continue;
    if (exists.amountMinor === amountMinor && exists.lineItems === lineItems) continue;
    await prisma.invoice.update({ where: { id: exists.id }, data: { amountMinor, lineItems } });
    refreshed++;
  }
  return { period, created, refreshed };
}

/**
 * The invoice as a document, with a DRAFT carrying the lines issuing will write.
 *
 * ⚠️ A draft has no snapshot and used to be rendered from its `lineItems` summary — "starter ·
 * RevioLink, RevioCRS, RevioPMS · bundle −20%", English, one line — while issuing snapshots the
 * Bulgarian breakdown (platform fee, each module, the discount). The preview and the download showed
 * a different document from the one the customer would get. Issued invoices are returned untouched.
 */
export async function withDraftLines<T extends { number: string | null; lineSnapshot: unknown; tenantId: string; period: string }>(invoice: T): Promise<T> {
  if (invoice.number || Array.isArray(invoice.lineSnapshot)) return invoice;
  const t = await prisma.tenant.findUnique({ where: { id: invoice.tenantId } });
  if (!t) return invoice;
  const { lines } = await billingFor(t, invoice.period, "bg");
  return { ...invoice, lineSnapshot: lines };
}
