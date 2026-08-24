import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { forSystem } from "@revio/db";
import { getCompany } from "@/lib/invoice-doc";
import { invoiceDocData } from "@/lib/invoice-data";
import { invoiceBodyHtml, INVOICE_DOC_CSS } from "@/lib/invoice-html";
import { PrintButton } from "@/components/billing/PrintButton";

export const dynamic = "force-dynamic";

/**
 * One invoice, as the customer receives it.
 *
 * The markup comes from `invoiceBodyHtml` — the SAME function the downloaded file uses. A React
 * version here plus an HTML version for the file would be two definitions of one legal document,
 * and they drift: someone corrects the VAT line on the screen, the file keeps the old one, and the
 * copy that is wrong is the copy the customer receives.
 *
 * `dangerouslySetInnerHTML` is doing real work rather than papering over something. Every value in
 * that markup is escaped at source by `esc()` in `invoice-html.ts`, and there is no path by which a
 * caller supplies markup — only a company name, an address, a footer note, all escaped.
 *
 * An issued invoice reads entirely from its own snapshot. A draft has none, so it is previewed from
 * the live records and labelled as a draft, because there is no such thing as an unissued invoice.
 */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prisma = forSystem();
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) notFound();

  const [tenant, billing] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: invoice.tenantId }, select: { name: true } }),
    prisma.clientBilling.findUnique({ where: { tenantId: invoice.tenantId } }),
  ]);
  const company = invoice.number ? null : await getCompany();
  const data = invoiceDocData(invoice, { tenantName: tenant?.name ?? null, company, billing });

  return (
    <div className="mx-auto max-w-[860px]">
      <div data-print-hide className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/billing" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 transition-colors hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> Billing
        </Link>
        <div className="flex items-center gap-2">
          {/* A real link, not a script-built blob: it survives right-click → Save link as, and it
              works with the keyboard and a screen reader for free. */}
          <a
            href={`/invoice/${invoice.id}/download`}
            className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
          >
            <Download className="h-4 w-4" /> Download
          </a>
          <PrintButton />
        </div>
      </div>

      {!invoice.number && (
        <div data-print-hide className="mb-4 rounded-md bg-warning-50 px-3 py-2.5 text-[12.5px] font-medium text-warning-600">
          Draft — not issued. It has no invoice number and nothing here is final. Issue it from the
          Billing screen to allocate a number and freeze these details.
        </div>
      )}

      {/* The document's own stylesheet — every selector scoped under `.doc`, so embedding it in the
          console cannot leak a rule into the app shell. The file loads the same one. */}
      <style dangerouslySetInnerHTML={{ __html: INVOICE_DOC_CSS }} />
      <div data-print-doc dangerouslySetInnerHTML={{ __html: invoiceBodyHtml(data) }} />
    </div>
  );
}
