"use server";

import { revalidatePath } from "next/cache";
import { forSystem, isBillablePeriod } from "@revio/db";
import { getOperatorSession } from "./session";
import {
  DIRECT_BOOKING_FEE_PCT,
  billableEntitlements,
  billedProducts,
  directBookingFeeMinor,
  monthlyPriceMinor,
  priceBreakdown,
  type Entitlements,
} from "./pricing";
import { directUsageByTenant, periodRange } from "./direct-usage";
import { flashError } from "@revio/ui/flash";
import { canTransition, type InvoiceStatus } from "@revio/core";

const prisma = forSystem();

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

/** What the invoice says it is for — plan, products, and the discount if one applied. */
function describe(
  plan: string,
  ent: Entitlements,
  usage?: { revenueMinor: number; bookings: number },
): string {
  const b = priceBreakdown(plan, ent);
  const parts = [plan, billedProducts(ent) || "no products"];
  if (b.discountMinor > 0) parts.push(`bundle −${b.discountPct}%`);
  // Named in the summary too, so a draft that changed because of usage says why it changed.
  if (usage && usage.revenueMinor > 0) {
    parts.push(`RevioDirect ${DIRECT_BOOKING_FEE_PCT}% on ${usage.bookings} booking${usage.bookings === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

/**
 * Generate this month's invoices for every active client that owes something.
 *
 * **A draft is refreshed, not skipped.** A draft has by definition not been sent to anyone, so
 * leaving it at a stale price is not caution — it is a wrong number waiting to be emailed. Entitlements
 * get toggled, plans get corrected and the price list itself changes; whichever happened, re-running
 * this brings the unsent invoice in line and says so in its line items.
 *
 * **A sent or paid invoice is never touched.** That is a document someone has acted on. Correcting one
 * is a credit note, not an UPDATE, and doing it silently here would rewrite history under the customer.
 *
 * No money moves either way — payments are still mocked.
 */
export async function generateInvoices(): Promise<void> {
  if (!(await getOperatorSession())) return;
  const period = new Date().toISOString().slice(0, 7);
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
    const usage = usageByTenant.get(t.id);
    const usageFeeMinor = usage ? directBookingFeeMinor(usage.revenueMinor) : 0;
    const amountMinor = monthlyPriceMinor(t.plan, ent) + usageFeeMinor;

    /*
     * `<= 0` and not `=== 0`: a client on no products who nonetheless took direct bookings still
     * owes the usage fee, and the old guard would have skipped them entirely.
     */
    if (amountMinor <= 0) continue;
    const lineItems = describe(t.plan, ent, usage);
    const exists = await prisma.invoice.findUnique({ where: { tenantId_period: { tenantId: t.id, period } } });

    if (!exists) {
      await prisma.invoice.create({ data: { tenantId: t.id, period, amountMinor, currency: "EUR", status: "draft", lineItems } });
      continue;
    }
    if (exists.status !== "draft") continue;
    if (exists.amountMinor === amountMinor && exists.lineItems === lineItems) continue;
    await prisma.invoice.update({ where: { id: exists.id }, data: { amountMinor, lineItems } });
  }
  revalidatePath("/billing");
  revalidatePath("/plans");
}

/**
 * Move an invoice through its lifecycle — and refuse the moves a ledger must not permit.
 *
 * This used to accept ANY status from ANY status with no checks and no attribution. It produced a
 * real row: `Hotel Sofia · 2026-07`, **paid, with no number and no issuedAt** — a document settled
 * without ever having been issued, and nothing recording who settled it.
 *
 * Revio is the legal issuer with its own gapless series, so the rules in `@revio/core`
 * (`canTransition`) are not presentation: an issued document is immutable, only an issued document
 * can be paid, and nothing returns to draft.
 */
export async function setInvoiceStatus(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to change an invoice.");
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!["sent", "paid", "void"].includes(status)) {
    return flashError("That isn’t a status an invoice can be moved to. Reload the page and try again.");
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true, status: true, number: true, issuedAt: true },
  });
  if (!invoice) return flashError("That invoice no longer exists.");

  const verdict = canTransition(invoice, status as InvoiceStatus);
  if (!verdict.ok) return flashError(verdict.reason ?? "That change isn’t allowed on this invoice.");

  await prisma.invoice.update({
    where: { id },
    data: {
      status,
      // Attribution is part of the transition, not a separate step somebody might skip. A payment
      // with nobody's name on it is not a ledger entry.
      ...(status === "paid"
        ? { paidAt: new Date(), paidById: session.userId, paidReference: optionalText(fd, "reference") }
        : {}),
    },
  });
  revalidatePath("/billing");
}

function optionalText(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v.slice(0, 200);
}
