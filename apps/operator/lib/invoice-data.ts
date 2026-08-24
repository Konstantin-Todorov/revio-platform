import { formatAddress, chooseIdentity } from "./invoice-lines";
import type { InvoiceDocData, InvoiceDocLine } from "./invoice-html";

/**
 * One invoice row → the shape the document renders from.
 *
 * The branch that matters: an ISSUED invoice reads entirely from its own snapshot, while a DRAFT has
 * no snapshot and is previewed from the live company and client records. Getting that backwards
 * would mean a sent invoice quietly reprinting with today's address — which is the whole reason the
 * snapshot columns exist.
 */
export function invoiceDocData(
  invoice: {
    number: string | null; period: string; issuedAt: Date | null; dueDate: Date | null; currency: string;
    amountMinor: number; lineItems: string | null; lineSnapshot: unknown;
    issuerName: string | null; issuerVatId: string | null; issuerCompanyId: string | null;
    issuerAddress: string | null; issuerIban: string | null; issuerBic: string | null; issuerBankName: string | null;
    buyerName: string | null; buyerVatId: string | null; buyerCompanyId: string | null; buyerAddress: string | null;
    netMinor: number | null; taxMinor: number | null; grossMinor: number | null;
    vatRatePct: number | null; vatTreatment: string | null; vatNote: string | null;
  },
  ctx: {
    tenantName: string | null;
    /** Only read for a draft preview; null once issued. */
    company: {
      legalName: string; legalNameLatin: string | null; vatId: string | null; companyId: string | null;
      email: string | null;
      addressLine: string | null; addressLineLatin: string | null;
      city: string | null; cityLatin: string | null;
      postCode: string | null; country: string;
      iban: string | null; bic: string | null; bankName: string | null; footerNote: string | null;
    } | null;
    billing: {
      legalName: string; vatId: string | null; companyId: string | null; attention: string | null;
      addressLine: string | null; city: string | null; postCode: string | null; country: string | null;
    } | null;
  },
): InvoiceDocData {
  const lines: InvoiceDocLine[] = Array.isArray(invoice.lineSnapshot)
    ? (invoice.lineSnapshot as InvoiceDocLine[])
    : invoice.lineItems
      ? [{ description: invoice.lineItems, netMinor: invoice.amountMinor }]
      : [];

  // A DRAFT has no snapshot, so the preview picks the rendering the same way issuing will — the
  // preview must show the document that would actually be produced, not a different one.
  const previewIssuer = ctx.company ? chooseIdentity(ctx.company, ctx.billing?.country) : null;

  return {
    number: invoice.number,
    period: invoice.period,
    issuedAt: invoice.issuedAt,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    issuerName: invoice.issuerName ?? previewIssuer?.legalName ?? null,
    issuerVatId: invoice.issuerVatId ?? ctx.company?.vatId ?? null,
    issuerCompanyId: invoice.issuerCompanyId ?? ctx.company?.companyId ?? null,
    issuerAddress:
      invoice.issuerAddress ??
      (previewIssuer && ctx.company
        ? formatAddress({
            addressLine: previewIssuer.addressLine, city: previewIssuer.city,
            postCode: ctx.company.postCode, country: ctx.company.country,
          })
        : null),
    issuerIban: invoice.issuerIban ?? ctx.company?.iban ?? null,
    issuerBic: invoice.issuerBic ?? ctx.company?.bic ?? null,
    issuerBankName: invoice.issuerBankName ?? ctx.company?.bankName ?? null,
    issuerEmail: ctx.company?.email ?? null,
    buyerName: invoice.buyerName ?? ctx.billing?.legalName ?? ctx.tenantName,
    buyerVatId: invoice.buyerVatId ?? ctx.billing?.vatId ?? null,
    buyerCompanyId: invoice.buyerCompanyId ?? ctx.billing?.companyId ?? null,
    buyerAddress: invoice.buyerAddress ?? (ctx.billing ? formatAddress(ctx.billing) : null),
    buyerAttention: ctx.billing?.attention ?? null,
    lines,
    netMinor: invoice.netMinor ?? invoice.amountMinor,
    taxMinor: invoice.taxMinor ?? 0,
    grossMinor: invoice.grossMinor ?? invoice.amountMinor,
    vatRatePct: invoice.vatRatePct ?? 0,
    vatTreatment: invoice.vatTreatment,
    vatNote: invoice.vatNote,
    footerNote: ctx.company?.footerNote ?? null,
  };
}
