import "server-only";
import { forSystem, isBillablePeriod } from "@revio/db";
import {
  DIRECT_BOOKING_FEE_PCT, billableEntitlements, billedProducts, directBookingFeeMinor,
  monthlyPriceMinor, priceBreakdown, type Entitlements,
} from "./pricing";
import { directUsageByTenant, periodRange } from "./direct-usage";
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

  for (const t of tenants) {
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

    // What they hold, then what they actually pay for. A product mid-trial is the difference.
    const held: Entitlements = { channelManager: t.hasChannelManager, reservation: t.hasReservation, pms: t.hasPms };
    const ent = billableEntitlements(held, trialsByTenant.get(t.id) ?? []);

    /*
     * The joining month is charged pro rata; every month after it is a full month.
     *
     * This is the shape SiteMinder and Little Hotelier both use — calendar-month invoicing with the
     * remainder of the joining month prorated — and it is the only one that keeps "30 days free"
     * literally true without giving away the rest of the month.
     */
    const joined = firstBillableDay(t.billingStartsAt, convertedEndByTenant.get(t.id) ?? null);
    const proration = prorationFor(period, joined);

    /*
     * ⚠️ Usage is narrowed by DATE, never scaled.
     *
     * The 2% is on bookings our engine actually produced, so multiplying it by 11/30 would charge a
     * share of real bookings instead of the real bookings. Bookings taken before they started
     * paying — during the free trial — are simply not counted.
     */
    const usage = proration && joined && joined > from
      ? (await directUsageByTenant(joined, to)).get(t.id)
      : usageByTenant.get(t.id);
    const usageFeeMinor = usage ? directBookingFeeMinor(usage.revenueMinor) : 0;
    const amountMinor = proratedMinor(monthlyPriceMinor(t.plan, ent), proration) + usageFeeMinor;

    /*
     * `<= 0` and not `=== 0`: a client on no products who nonetheless took direct bookings still
     * owes the usage fee, and the old guard would have skipped them entirely.
     */
    if (amountMinor <= 0) continue;
    const lineItems = describe(t.plan, ent, usage, proration);
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
