import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { forSystem } from "@revio/db";
import { getCompany, type InvoiceLine } from "@/lib/invoice-doc";
import { PrintButton } from "@/components/billing/PrintButton";

export const dynamic = "force-dynamic";

/**
 * One invoice, as the customer receives it.
 *
 * Everything printed here comes from the SNAPSHOT on the invoice row, not from the company record or
 * the price list. That is the entire point of the snapshot: this page must render the document that
 * was sent, not the document those inputs would produce today. Reading the live tables would mean a
 * change of address silently reissuing every historical invoice with the new one.
 *
 * A draft has no snapshot, so it is shown as a preview and clearly labelled — there is no such thing
 * as an unissued invoice, and rendering one that looks final is how an unnumbered document ends up
 * attached to an email.
 */

function money(minor: number, currency: string): string {
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : `${currency} `;
  const neg = minor < 0;
  return `${neg ? "−" : ""}${sym}${(Math.abs(minor) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function day(d: Date | null): string {
  return d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prisma = forSystem();
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) notFound();

  const tenant = await prisma.tenant.findUnique({ where: { id: invoice.tenantId }, select: { name: true } });
  const issued = !!invoice.number;

  // A draft has no frozen lines yet, so the preview is built live — and says so.
  const company = issued ? null : await getCompany();
  const lines: InvoiceLine[] = Array.isArray(invoice.lineSnapshot)
    ? (invoice.lineSnapshot as unknown as InvoiceLine[])
    : [];

  const netMinor = invoice.netMinor ?? invoice.amountMinor;
  const taxMinor = invoice.taxMinor ?? 0;
  const grossMinor = invoice.grossMinor ?? invoice.amountMinor;
  const cur = invoice.currency;

  return (
    <div className="mx-auto max-w-[820px]">
      <div data-print-hide className="mb-4 flex items-center justify-between">
        <Link href="/billing" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 transition-colors hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> Billing
        </Link>
        <PrintButton />
      </div>

      {!issued && (
        <div data-print-hide className="mb-4 rounded-md bg-warning-50 px-3 py-2.5 text-[12.5px] font-medium text-warning-600">
          Draft — not issued. It has no invoice number and nothing here is final. Issue it from the
          Billing screen to allocate a number and freeze these details.
        </div>
      )}

      <article data-print-doc className="rounded-lg border border-surface-border bg-white p-8 shadow-sm">
        {/* Header: who is billing, and what this document is. */}
        <header className="flex items-start justify-between gap-8 border-b border-surface-border pb-6">
          <div>
            <div className="text-[15px] font-bold text-ink-900">
              {invoice.issuerName ?? company?.legalName ?? "Your company"}
            </div>
            <div className="mt-1 space-y-0.5 text-[11.5px] leading-relaxed text-ink-500">
              {(invoice.issuerAddress ?? null) && <div>{invoice.issuerAddress}</div>}
              {invoice.issuerVatId && <div>VAT {invoice.issuerVatId}</div>}
              {invoice.issuerCompanyId && <div>Company no. {invoice.issuerCompanyId}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[20px] font-bold uppercase tracking-tight text-ink-900">Invoice</div>
            <div className="mt-1 tnum text-[13px] font-semibold text-ink-700">{invoice.number ?? "— not issued —"}</div>
            <dl className="mt-3 space-y-0.5 text-[11.5px] text-ink-500">
              <div className="flex justify-end gap-3"><dt>Issued</dt><dd className="tnum font-medium text-ink-700">{day(invoice.issuedAt)}</dd></div>
              <div className="flex justify-end gap-3"><dt>Due</dt><dd className="tnum font-medium text-ink-700">{day(invoice.dueDate)}</dd></div>
              <div className="flex justify-end gap-3"><dt>Period</dt><dd className="tnum font-medium text-ink-700">{invoice.period}</dd></div>
            </dl>
          </div>
        </header>

        {/* Who is being billed. */}
        <section className="py-6">
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Bill to</div>
          <div className="mt-1.5 text-[14px] font-semibold text-ink-900">
            {invoice.buyerName ?? tenant?.name ?? "—"}
          </div>
          <div className="mt-1 space-y-0.5 text-[11.5px] leading-relaxed text-ink-500">
            {invoice.buyerAddress && <div>{invoice.buyerAddress}</div>}
            {invoice.buyerVatId && <div>VAT {invoice.buyerVatId}</div>}
            {invoice.buyerCompanyId && <div>Company no. {invoice.buyerCompanyId}</div>}
          </div>
        </section>

        {/* What is being billed. */}
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-y border-surface-border text-left text-[10.5px] uppercase tracking-wide text-ink-400">
              <th className="py-2 font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr className="border-b border-surface-border">
                <td className="py-2.5 text-ink-700">{invoice.lineItems ?? "Monthly subscription"}</td>
                <td className="py-2.5 text-right tnum text-ink-900">{money(netMinor, cur)}</td>
              </tr>
            ) : (
              lines.map((l, i) => (
                <tr key={i} className="border-b border-surface-border">
                  <td className="py-2.5 text-ink-700">{l.description}</td>
                  <td className="py-2.5 text-right tnum text-ink-900">{money(l.netMinor, cur)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals. Net, then VAT, then what they actually owe. */}
        <div data-print-keep className="mt-5 flex justify-end">
          <dl className="w-[280px] space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-ink-500">Subtotal (excl. VAT)</dt>
              <dd className="tnum font-medium text-ink-900">{money(netMinor, cur)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">
                {invoice.vatTreatment === "eu_reverse_charge" ? "VAT — reverse charge (0%)"
                  : invoice.vatTreatment === "outside_eu" ? "VAT — outside scope (0%)"
                  : invoice.vatTreatment === "not_registered" ? "VAT — not registered (0%)"
                  : `VAT ${invoice.vatRatePct ?? 0}%`}
              </dt>
              <dd className="tnum font-medium text-ink-900">{money(taxMinor, cur)}</dd>
            </div>
            <div className="flex justify-between border-t border-ink-900 pt-2">
              <dt className="font-bold text-ink-900">Total due</dt>
              <dd className="tnum text-[15px] font-bold text-ink-900">{money(grossMinor, cur)}</dd>
            </div>
          </dl>
        </div>

        {/* The legal note beside a 0% line. Not decoration — it is what makes the zero valid. */}
        {invoice.vatNote && (
          <p className="mt-4 border-l-2 border-surface-border pl-3 text-[11.5px] leading-relaxed text-ink-500">
            {invoice.vatNote}
          </p>
        )}

        {/* How to pay. */}
        {(invoice.issuerIban || invoice.issuerBankName) && (
          <section data-print-keep className="mt-6 rounded-md bg-surface-sunken px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Payment</div>
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[12px]">
              {invoice.issuerBankName && (<><dt className="text-ink-500">Bank</dt><dd className="font-medium text-ink-900">{invoice.issuerBankName}</dd></>)}
              {invoice.issuerIban && (<><dt className="text-ink-500">IBAN</dt><dd className="tnum font-medium text-ink-900">{invoice.issuerIban}</dd></>)}
              {invoice.issuerBic && (<><dt className="text-ink-500">BIC</dt><dd className="tnum font-medium text-ink-900">{invoice.issuerBic}</dd></>)}
              {invoice.number && (<><dt className="text-ink-500">Reference</dt><dd className="tnum font-medium text-ink-900">{invoice.number}</dd></>)}
            </dl>
          </section>
        )}

        <footer className="mt-6 border-t border-surface-border pt-4 text-[11px] leading-relaxed text-ink-400">
          All amounts are exclusive of VAT unless stated otherwise.
        </footer>
      </article>
    </div>
  );
}
