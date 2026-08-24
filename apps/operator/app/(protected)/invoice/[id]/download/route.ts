import { forSystem } from "@revio/db";
import { getOperatorSession } from "@/lib/session";
import { getCompany } from "@/lib/invoice-doc";
import { invoiceDocData } from "@/lib/invoice-data";
import { invoiceFileHtml, invoiceFileName } from "@/lib/invoice-html";

/**
 * Download one invoice as a self-contained HTML file.
 *
 * Generated on demand and stored nowhere — no bucket, no bytes in Postgres, no headless browser.
 * About 12KB, opens on any device with no network, and prints to PDF from the browser that opens it.
 *
 * Behind the session check like every other route here: an invoice carries both companies' legal
 * identities and our bank details, so an unauthenticated id-guess must not return one.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getOperatorSession())) return new Response("Not signed in.", { status: 401 });

  const { id } = await params;
  const prisma = forSystem();
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return new Response("No such invoice.", { status: 404 });

  const tenant = await prisma.tenant.findUnique({ where: { id: invoice.tenantId }, select: { name: true } });
  const company = invoice.number ? null : await getCompany();
  const billing = await prisma.clientBilling.findUnique({ where: { tenantId: invoice.tenantId } });

  const data = invoiceDocData(invoice, { tenantName: tenant?.name ?? null, company, billing });

  return new Response(invoiceFileHtml(data), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${invoiceFileName(data)}"`,
      // A document is a fact about a moment. Caching one would be harmless while it is issued and
      // wrong while it is still a draft being repriced.
      "Cache-Control": "no-store",
    },
  });
}
