"use server";

import { revalidatePath } from "next/cache";
import { forSystem } from "@revio/db";
import { getOperatorSession } from "./session";
import { monthlyPriceMinor, billedProducts, priceBreakdown, type Entitlements } from "./pricing";

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
  revalidatePath("/", "layout"); // Y2: clear every route's client cache, not only the ones named above
}

/**
 * Move an invoice draft → sent → paid. Marking "paid" is a MOCK settlement (no gateway, no card) —
 * a real payment integration is future work.
 */
export async function setInvoiceStatus(fd: FormData): Promise<void> {
  if (!(await getOperatorSession())) return;
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!["draft", "sent", "paid"].includes(status)) return;
  await prisma.invoice.update({ where: { id }, data: { status, paidAt: status === "paid" ? new Date() : null } });
  revalidatePath("/billing");
  revalidatePath("/", "layout"); // Y2: clear every route's client cache, not only the ones named above
}
