"use server";

import { revalidatePath } from "next/cache";
import { forSystem } from "@revio/db";
import { getOperatorSession } from "./session";
import { monthlyPriceMinor, billedProducts, type Entitlements } from "./pricing";

const prisma = forSystem();

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

/**
 * Generate this month's draft invoices for every active client that owes something. Idempotent — a
 * client already invoiced for the period is skipped (unique tenantId+period). No money moves.
 */
export async function generateInvoices(): Promise<void> {
  if (!(await getOperatorSession())) return;
  const period = new Date().toISOString().slice(0, 7);
  const tenants = await prisma.tenant.findMany({ where: { status: "active" } });
  for (const t of tenants) {
    const ent: Entitlements = { channelManager: t.hasChannelManager, reservation: t.hasReservation, pms: t.hasPms };
    const amountMinor = monthlyPriceMinor(t.plan, ent);
    if (amountMinor <= 0) continue;
    const exists = await prisma.invoice.findUnique({ where: { tenantId_period: { tenantId: t.id, period } } });
    if (exists) continue;
    await prisma.invoice.create({
      data: { tenantId: t.id, period, amountMinor, currency: "EUR", status: "draft", lineItems: `${t.plan} · ${billedProducts(ent)}` },
    });
  }
  revalidatePath("/billing");
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
}
