import { NextResponse } from "next/server";
import { forSystem } from "@revio/db";
import { invoiceDocData } from "@/lib/invoice-data";
import { invoiceFileHtml, invoiceFileName } from "@/lib/invoice-html";
import { invoiceByPayToken } from "@/lib/pay-page";

export const dynamic = "force-dynamic";

/** The invoice document, from its own page — the same file the email attached. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const invoice = await invoiceByPayToken((await params).token);
  if (!invoice) return new NextResponse("Not found", { status: 404 });
  const [tenant, billing] = await Promise.all([
    forSystem().tenant.findUnique({ where: { id: invoice.tenantId }, select: { name: true } }),
    forSystem().clientBilling.findUnique({ where: { tenantId: invoice.tenantId } }),
  ]);
  const doc = invoiceDocData(invoice, { tenantName: tenant?.name ?? null, company: null, billing });
  return new NextResponse(invoiceFileHtml(doc), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${invoiceFileName(doc)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
