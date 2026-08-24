import "server-only";
import { forSystem, withSystemTransaction } from "@revio/db";
import { decideVat, applyVat } from "./vat";
import { type Entitlements } from "./pricing";
import { invoiceLines, formatAddress, formatInvoiceNumber, formatDemoNumber } from "./invoice-lines";

export { invoiceLines, formatAddress, vatLabel, formatInvoiceNumber, type InvoiceLine } from "./invoice-lines";

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

  const amounts = applyVat(netMinor, vat.ratePct);
  const issuedAt = new Date();
  const dueDate = new Date(issuedAt.getTime() + company.paymentTermsDays * 86_400_000);

  /*
   * Allocate the number and write the document in ONE transaction.
   *
   * "Без пропуски" — no gaps — is not a tidiness preference, it is the rule. Allocating first and
   * writing second means any failure in between (a dropped connection, a constraint, a restart)
   * burns a number that no document will ever carry, and a missing number in a Bulgarian invoice
   * sequence is something an auditor asks about and nobody can answer afterwards.
   *
   * A transaction makes the two atomic: either the counter moved and the invoice carries the number,
   * or neither happened and the next attempt takes the same one.
   *
   * Demo tenants draw from a separate counter under a deliberately invalid format, so rehearsing the
   * flow can never consume a number from the legally-sequenced range.
   */
  const kind = tenant.isDemo ? "demo" : "real";
  const number = await withSystemTransaction(async (tx) => {
    const existing = await tx.operatorInvoiceSeries.findUnique({ where: { kind }, select: { id: true, nextNumber: true } });
    const series =
      existing ??
      (await tx.operatorInvoiceSeries.create({
        // The real range starts where the company says its books leave off; demo starts at 1 because
        // it is not a legal sequence and nothing has to be reserved around it.
        data: { kind, nextNumber: kind === "real" ? company.invoiceNumberStart : 1n },
        select: { id: true, nextNumber: true },
      }));

    const claimed = series.nextNumber;
    await tx.operatorInvoiceSeries.update({ where: { id: series.id }, data: { nextNumber: claimed + 1n } });

    const formatted = kind === "real" ? formatInvoiceNumber(claimed) : formatDemoNumber(claimed);

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        number: formatted, issuedAt, dueDate,
        // Only a DRAFT becomes "sent". An invoice can already be paid and carry no number — every
        // invoice generated before this feature existed is exactly that — and issuing the document
        // for one must not walk its status backwards from paid to sent. The money arrived; giving
        // the record a number afterwards does not un-arrive it.
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
        lineSnapshot: lines as unknown as object[],
      },
    });

    return formatted;
  });

  return { ok: true, number };
}

