import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { getTaxInvoice, DOC_LABEL } from "@/lib/invoice";
import { TAX_LABEL } from "@/lib/posting";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

type TaxRow = { category: string; ratePct: number; netMinor: number; taxMinor: number; grossMinor: number };
type SnapLine = { kind: string; description: string; outlet: string | null; taxCategory: string | null; amountMinor: number };

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getTaxInvoice(id);
  if (!data) notFound();
  const { invoice: inv, guestName } = data;
  const cur = inv.currency;
  const rows = (inv.taxSummary as unknown as TaxRow[]) ?? [];
  const lines = (inv.lineSnapshot as unknown as SnapLine[]) ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center justify-between">
        <Link href={`/folio/${inv.reservationId}`} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
          <ArrowLeft className="h-4 w-4" /> Folio
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-400"><Printer className="h-3.5 w-3.5" /> Ctrl/Cmd-P to print</span>
      </div>

      {/* The tax document */}
      <div className="rounded-lg border border-surface-border bg-white p-6 shadow-card">
        <div className="flex items-start justify-between border-b border-surface-border pb-4">
          <div>
            <div className="text-[18px] font-bold text-ink-900">{inv.issuerName}</div>
            {inv.issuerAddress && <div className="text-[12px] text-ink-500">{inv.issuerAddress}</div>}
            {inv.issuerVatId && <div className="text-[12px] text-ink-500">VAT ID: {inv.issuerVatId}</div>}
          </div>
          <div className="text-right">
            <div className="text-[16px] font-bold uppercase tracking-wide text-ink-900">{DOC_LABEL[inv.docType] ?? inv.docType}</div>
            <div className="tnum text-[13px] font-semibold text-accent-600">{inv.number}</div>
            {inv.status === "void" && <div className="text-[11px] font-bold uppercase text-danger-600">VOID</div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-surface-border py-4 text-[12.5px]">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Bill to</div>
            <div className="mt-0.5 font-semibold text-ink-900">{inv.buyerName}</div>
            {inv.buyerAddress && <div className="text-ink-500">{inv.buyerAddress}</div>}
            {inv.buyerVatId && <div className="text-ink-500">VAT ID: {inv.buyerVatId}</div>}
            <div className="mt-1 text-[11px] text-ink-400">Stay: {guestName}</div>
          </div>
          <div className="text-right">
            <div><span className="text-ink-400">Issue date </span><span className="tnum font-semibold text-ink-800">{fmtDate(inv.issueDate)}</span></div>
            <div><span className="text-ink-400">Date of supply </span><span className="tnum font-semibold text-ink-800">{fmtDate(inv.supplyDate)}</span></div>
            <div><span className="text-ink-400">Currency </span><span className="font-semibold text-ink-800">{cur}</span></div>
          </div>
        </div>

        {/* Charge lines */}
        <table className="w-full py-3 text-[12.5px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-surface-border/50 last:border-0">
                <td className="py-1.5 text-ink-700">{l.description}{l.outlet && l.outlet !== "room" ? <span className="ml-1 text-[10.5px] text-ink-400">· {l.outlet}</span> : null}</td>
                <td className="tnum py-1.5 text-right text-ink-900">{money(l.amountMinor, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tax summary per rate — accommodation broken out at its own rate (spec §4.3) */}
        <div className="mt-2 border-t border-surface-border pt-3">
          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Tax summary</div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10.5px] text-ink-400">
                <th className="py-1">Rate</th>
                <th className="py-1 text-right">Net</th>
                <th className="py-1 text-right">VAT</th>
                <th className="py-1 text-right">Gross</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="py-1 text-ink-600">{TAX_LABEL[r.category] ?? r.category} {r.ratePct > 0 ? `${r.ratePct}%` : ""}</td>
                  <td className="tnum py-1 text-right text-ink-600">{money(r.netMinor, cur)}</td>
                  <td className="tnum py-1 text-right text-ink-600">{money(r.taxMinor, cur)}</td>
                  <td className="tnum py-1 text-right font-semibold text-ink-800">{money(r.grossMinor, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex justify-between border-t border-surface-border pt-2 text-[15px] font-bold text-ink-900">
            <span>Total</span>
            <span className="tnum">{money(inv.grossMinor, cur)}</span>
          </div>
          <div className="mt-0.5 flex justify-between text-[11.5px] text-ink-400">
            <span>of which VAT</span>
            <span className="tnum">{money(inv.taxMinor, cur)}</span>
          </div>
        </div>

        <p className="mt-4 border-t border-surface-border pt-3 text-[10.5px] text-ink-400">
          {inv.fiscalRef ? `Fiscal reference: ${inv.fiscalRef}` : "Not yet fiscalized — real-time fiscal reporting (e.g. Bulgaria N-18) connects at the compliance boundary."}
        </p>
      </div>
    </div>
  );
}
