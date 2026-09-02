"use server";

import { revalidatePath } from "next/cache";
import { forSystem, isBillablePeriod } from "@revio/db";
import { getOperatorSession } from "./session";
import { monthlyPriceMinor, billedProducts, priceBreakdown, type Entitlements } from "./pricing";
import { flashError } from "@revio/ui/flash";
import { canTransition, type InvoiceStatus } from "@revio/core";

const prisma = forSystem();

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

/** What the invoice says it is for — plan, products, and the discount if one applied. */
function describe(plan: string, ent: Entitlements): string {
  const b = priceBreakdown(plan, ent);
  const parts = [plan, billedProducts(ent) || "no products"];
  if (b.discountMinor > 0) parts.push(`bundle −${b.discountPct}%`);
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

    const ent: Entitlements = { channelManager: t.hasChannelManager, reservation: t.hasReservation, pms: t.hasPms };
    const amountMinor = monthlyPriceMinor(t.plan, ent);
    if (amountMinor <= 0) continue;
    const lineItems = describe(t.plan, ent);
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
 * Move an invoice draft → sent → paid. Marking "paid" is a MOCK settlement (no gateway, no card) —
 * a real payment integration is future work.
 */
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
