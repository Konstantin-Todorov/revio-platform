import "server-only";
import { forSystem } from "@revio/db";
import { isOurs, isAccountType } from "@revio/core";
import { issueInvoice } from "./invoice-doc";
import { sendInvoiceMail } from "./invoice-mailer";
import { reminderStage } from "./invoice-schedule";

/**
 * The monthly letters, without anyone pressing a button: issue this month's invoice for every paying
 * client and email it, then remind before and after the due date (`reminderStage`).
 *
 * ## When it does nothing
 *
 * - **Payments are not live.** A test-mode card button must never reach a real customer, so while
 *   `stripeMode` is "test" this reports "waiting for live payments" and sends nothing.
 * - **It is switched off** (Settings → Company → "Send invoices automatically").
 * - **Our own accounts** (demo, test) — never mailed, whatever their billing says.
 * - **A client whose company details are incomplete** — the invoice cannot be issued; the draft
 *   stays, and the reason is returned so the job's log (and the operator) can see who is stuck.
 *
 * Every step is independent per client: one client's missing VAT number never stops another's mail.
 */
export async function autoSendInvoices(now = new Date()): Promise<{
  state: "off" | "waiting_for_live" | "ran";
  issued: number; emailed: number; reminded: number; stuck: string[];
}> {
  const prisma = forSystem();
  const company = await prisma.operatorCompany.findUnique({ where: { id: "singleton" } });
  const empty = { issued: 0, emailed: 0, reminded: 0, stuck: [] as string[] };
  if (!company || !company.autoSendInvoices) return { state: "off", ...empty };
  if (company.stripeMode !== "live") return { state: "waiting_for_live", ...empty };

  const period = now.toISOString().slice(0, 7);
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, accountType: true } });
  const ours = new Set(tenants.filter((t) => isOurs(isAccountType(t.accountType) ? t.accountType : "live")).map((t) => t.id));
  const nameOf = new Map(tenants.map((t) => [t.id, t.name]));
  const out = { ...empty };

  // 1. This month's drafts → issued and emailed.
  const drafts = await prisma.invoice.findMany({ where: { period, status: "draft", number: null } });
  for (const d of drafts) {
    if (ours.has(d.tenantId)) continue;
    const issued = await issueInvoice(d.id);
    if (!issued.ok) { out.stuck.push(`${nameOf.get(d.tenantId) ?? d.tenantId}: ${issued.error}`); continue; }
    out.issued++;
    const sent = await sendInvoiceMail(d.id, "request");
    if (sent.ok) out.emailed++;
    else out.stuck.push(`${nameOf.get(d.tenantId) ?? d.tenantId}: ${sent.error}`);
  }

  // 2. Reminders for invoices that were emailed and are still unpaid.
  const open = await prisma.invoice.findMany({
    where: { status: "sent", number: { not: null }, emailedAt: { not: null } },
    select: { id: true, tenantId: true, dueDate: true, remindersSent: true, lastReminderAt: true },
  });
  for (const inv of open) {
    if (ours.has(inv.tenantId)) continue;
    const stage = reminderStage({ dueDate: inv.dueDate, remindersSent: inv.remindersSent, lastReminderAt: inv.lastReminderAt, now });
    if (!stage) continue;
    const sent = await sendInvoiceMail(inv.id, stage);
    if (sent.ok) out.reminded++;
    else out.stuck.push(`${nameOf.get(inv.tenantId) ?? inv.tenantId}: reminder — ${sent.error}`);
  }
  return { state: "ran", ...out };
}
