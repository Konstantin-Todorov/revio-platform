import "server-only";
import { forSystem } from "@revio/db";
import { decideVat, applyVat } from "./vat";
import { type Entitlements } from "./pricing";
import { invoiceLines, formatAddress } from "./invoice-lines";

export { invoiceLines, formatAddress, vatLabel, type InvoiceLine } from "./invoice-lines";

/**
 * Turning a billing row into an actual invoice.
 *
 * The row already existed — tenant, period, amount. What was missing is everything that makes a
 * document a document: a number nobody else has, who is billing whom, what tax applies and why, and
 * a copy of all of it frozen at the moment it was sent. This is the operator-side counterpart of
 * `apps/pms/lib/invoice.ts`, and deliberately follows the same shape, because two different
 * disciplines for issuing numbered documents in one codebase is how one of them quietly rots.
 *
 * ## Issuing is a one-way door
 *
 * A draft can be regenerated, repriced and deleted. Once issued it has a number, and a number that
 * has been sent to a customer cannot be reused, skipped, or silently repointed at a different
 * amount. Corrections to an issued invoice are a credit note, which is a new document.
 */

const prisma = forSystem();

/** The one row describing us. */
export async function getCompany() {
  return prisma.operatorCompany.findUnique({ where: { id: "singleton" } });
}

export async function getClientBilling(tenantId: string) {
  return prisma.clientBilling.findUnique({ where: { tenantId } });
}

/**
 * Allocate the next number for a year, gaplessly.
 *
 * A single atomic increment claims the value, exactly as the hotel-side series does. Read-then-write
 * would hand the same number to two invoices issued in the same second, and a duplicate invoice
 * number is an audit finding rather than a glitch — the customer's accounts and ours stop agreeing
 * about which document is which.
 */
async function nextInvoiceNumber(prefix: string, year: number): Promise<string> {
  const key = { prefix_year: { prefix, year } };
  let series = await prisma.operatorInvoiceSeries.findUnique({ where: key, select: { id: true } });
  if (!series) {
    try {
      series = await prisma.operatorInvoiceSeries.create({ data: { prefix, year }, select: { id: true } });
    } catch {
      // Lost the race to create it; the winner's row is what we want anyway.
      series = await prisma.operatorInvoiceSeries.findUnique({ where: key, select: { id: true } });
    }
  }
  const updated = await prisma.operatorInvoiceSeries.update({
    where: { id: series!.id },
    data: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });
  const claimed = updated.nextNumber - 1;
  return `${prefix}-${year}-${String(claimed).padStart(4, "0")}`;
}

export type IssueResult = { ok: true; number: string } | { ok: false; error: string };

/**
 * Issue a draft: allocate its number, decide the VAT, and freeze the whole document.
 *
 * Every refusal below is a case where issuing anyway would produce a document that is wrong on
 * paper. A wrong invoice is not a bug you fix by editing a row — it has been sent, it is in someone
 * else's accounting system, and undoing it means a credit note and a conversation. So the checks are
 * up front and they block.
 */
export async function issueInvoice(invoiceId: string): Promise<IssueResult> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { ok: false, error: "That invoice no longer exists." };
  if (invoice.number) return { ok: false, error: `Already issued as ${invoice.number}.` };

  const company = await getCompany();
  if (!company) {
    return { ok: false, error: "Set your company details first — Settings › Company. An invoice needs an issuer." };
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: invoice.tenantId } });
  if (!tenant) return { ok: false, error: "That client no longer exists." };

  const billing = await getClientBilling(invoice.tenantId);
  if (!billing) {
    return {
      ok: false,
      // Naming the screen matters: the alternative is an operator hunting for where a "billing
      // details" form lives while an invoice is due.
      error: `No billing details for ${tenant.name}. Add their legal name, VAT number and address on the client page before invoicing.`,
    };
  }

  const vat = decideVat({
    issuerCountry: company.country,
    issuerVatId: company.vatId,
    standardRatePct: company.standardVatPct,
    buyerCountry: billing.country,
    buyerVatId: billing.vatId,
  });
  if (vat.needsReview) {
    return { ok: false, error: `VAT treatment needs a decision: ${vat.note ?? "the customer's country is missing."}` };
  }

  const ent: Entitlements = {
    channelManager: tenant.hasChannelManager,
    reservation: tenant.hasReservation,
    pms: tenant.hasPms,
  };
  const lines = invoiceLines(tenant.plan, ent);
  const netMinor = lines.reduce((s, l) => s + l.netMinor, 0);

  // The lines are derived from today's price list, while `amountMinor` was written when the draft
  // was generated. They should agree; if they do not, the price list moved under an unsent draft and
  // the invoice would say one thing in its lines and another in its total.
  if (netMinor !== invoice.amountMinor) {
    return {
      ok: false,
      error: `The price list has changed since this draft (lines total ${netMinor / 100}, draft says ${invoice.amountMinor / 100}). Regenerate this month's invoices, then issue.`,
    };
  }

  /*
   * A demo tenant issues under its own prefix.
   *
   * Demo hotels are billed exactly like real ones so the flow stays testable — but numbers cannot be
   * reclaimed, and three rehearsals would mean the first real customer is invoiced REV-2026-0004
   * with three documents missing from the sequence. That is a question from an auditor rather than a
   * cosmetic detail, so the two sequences are kept apart.
   */
  const prefix = tenant.isDemo ? "DEMO" : company.invoicePrefix;

  const amounts = applyVat(netMinor, vat.ratePct);
  const issuedAt = new Date();
  const dueDate = new Date(issuedAt.getTime() + company.paymentTermsDays * 86_400_000);
  const number = await nextInvoiceNumber(prefix, issuedAt.getFullYear());

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      number, issuedAt, dueDate,
      // Only a DRAFT becomes "sent". An invoice can already be paid and carry no number — every
      // invoice generated before this feature existed is exactly that — and issuing the document for
      // one must not walk its status backwards from paid to sent. The money arrived; giving the
      // record a number afterwards does not un-arrive it.
      ...(invoice.status === "draft" ? { status: "sent" } : {}),
      issuerName: company.legalName,
      issuerVatId: company.vatId,
      issuerCompanyId: company.companyId,
      issuerAddress: formatAddress(company),
      issuerIban: company.iban,
      issuerBic: company.bic,
      issuerBankName: company.bankName,
      buyerName: billing.legalName,
      buyerVatId: billing.vatId,
      buyerCompanyId: billing.companyId,
      buyerAddress: formatAddress(billing),
      netMinor: amounts.netMinor,
      taxMinor: amounts.taxMinor,
      grossMinor: amounts.grossMinor,
      vatRatePct: vat.ratePct,
      vatTreatment: vat.treatment,
      vatNote: vat.note,
      lineSnapshot: lines,
    },
  });

  return { ok: true, number };
}

