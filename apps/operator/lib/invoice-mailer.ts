import "server-only";
import { randomBytes } from "node:crypto";
import { forSystem } from "@revio/db";
import { sendEmail } from "@revio/email";
import { invoicePaymentRequestEmail, invoiceReminderEmail } from "./invoice-emails";
import { invoiceDocData } from "./invoice-data";
import { docMoney, invoiceFileHtml, invoiceFileName } from "./invoice-html";

/**
 * Sending an invoice, and chasing it — one path for the operator's button and the monthly job.
 *
 * Two copies of "compose and send the invoice" would diverge the way the document once did (screen
 * vs download): one would get the language, the other would keep the old link. So both call this.
 */

const prisma = forSystem();

/** The public origin for links in mail. From the environment: a job has no request to read it from. */
export function operatorOrigin(): string {
  const explicit = process.env.OPERATOR_URL?.trim() || process.env.PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  return railway ? `https://${railway}` : "https://operator.reviosoft.app";
}

/**
 * The invoice's own page token, minted once. 24 random bytes: the page shows one customer's invoice
 * and our bank details, so the address must not be guessable — and must never expire, because it
 * sits in an email the customer may open weeks later.
 */
export async function ensurePayToken(invoiceId: string): Promise<string> {
  const current = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { payToken: true } });
  if (current?.payToken) return current.payToken;
  const token = randomBytes(24).toString("base64url");
  // Conditional: two callers racing keep the first token, so an already-sent link never changes.
  await prisma.invoice.updateMany({ where: { id: invoiceId, payToken: null }, data: { payToken: token } });
  const after = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { payToken: true } });
  return after!.payToken!;
}

export type MailKind = "request" | "soon" | "due" | "overdue";

export type SendOutcome =
  | { ok: true; to: string; mode: string }
  | { ok: false; error: string; code: "not_issued" | "no_email" | "send_failed" | "gone" };

/** Compose and send one letter about an issued invoice — in the invoice's own language, with its page link. */
export async function sendInvoiceMail(invoiceId: string, kind: MailKind): Promise<SendOutcome> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { ok: false, code: "gone", error: "That invoice no longer exists." };
  if (!invoice.number) {
    return { ok: false, code: "not_issued", error: "Issue this invoice first — an email about a draft is an email about a number that can still change." };
  }
  const [tenant, billing, company] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: invoice.tenantId }, select: { name: true } }),
    prisma.clientBilling.findUnique({ where: { tenantId: invoice.tenantId } }),
    prisma.operatorCompany.findUnique({ where: { id: "singleton" } }),
  ]);
  /*
   * The billing address, else the account owner — which is what the hotel's own Billing screen
   * promises ("blank sends them to the account owner"). The mail went nowhere instead, so a hotel that
   * left the field empty on our word never received an invoice.
   */
  const owner = billing?.billingEmail?.trim()
    ? null
    : await prisma.user.findFirst({ where: { tenantId: invoice.tenantId, role: "owner", active: true }, select: { email: true } });
  const to = billing?.billingEmail?.trim() || owner?.email?.trim();
  if (!to) return { ok: false, code: "no_email", error: `No billing email and no active owner for ${tenant?.name ?? "this client"}. Add one on their client page, under Billing.` };

  const lang = invoice.language === "bg" ? "bg" : "en";
  const token = await ensurePayToken(invoice.id);
  const owed = invoice.grossMinor ?? invoice.amountMinor;
  const date = (d: Date | null) =>
    d ? (lang === "bg" ? `${d.toLocaleDateString("bg-BG", { timeZone: "UTC" })}` : d.toLocaleDateString("en-GB", { timeZone: "UTC" })) : null;

  const facts = {
    number: invoice.number,
    amount: docMoney(owed, invoice.currency, lang),
    customerName: billing?.legalName ?? tenant?.name ?? "",
    dueDate: date(invoice.dueDate),
    payUrl: `${operatorOrigin()}/pay/${token}`,
    payPage: true,
    iban: company?.iban ?? null,
    bankName: company?.bankName ?? null,
    sandbox: (company?.stripeMode ?? "test") !== "live",
    lang,
  } as const;
  const mail = kind === "request" ? invoicePaymentRequestEmail(facts) : invoiceReminderEmail({ ...facts, stage: kind });

  const doc = invoiceDocData(invoice, { tenantName: tenant?.name ?? null, company: null, billing });
  const result = await sendEmail({
    to: [to],
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    attachments: [{ filename: invoiceFileName(doc), content: invoiceFileHtml(doc) }],
  });
  if (!result.ok) return { ok: false, code: "send_failed", error: result.error ?? "unknown error" };

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: kind === "request"
      ? { emailedAt: new Date() }
      : { remindersSent: { increment: 1 }, lastReminderAt: new Date() },
  });
  return { ok: true, to, mode: result.mode ?? "sent" };
}
