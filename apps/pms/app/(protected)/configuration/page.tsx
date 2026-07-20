import Link from "next/link";
import { Lock, Percent, ReceiptText, ShieldCheck, Sparkles, Wine, Landmark } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { getConfiguration } from "@/lib/config";
import { saveConfiguration, saveDepositType, deleteDepositType } from "@/lib/actions-config";
import { POS_OUTLETS, POS_OUTLET_LABEL } from "@/lib/roles";
import { DOC_LABEL } from "@/lib/invoice";

export const dynamic = "force-dynamic";

const inputCls = "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600";
const labelCls = "mb-1 block text-[11px] font-semibold text-ink-600";

export default async function ConfigurationPage() {
  const { property, canManage, defaults, depositTypes, nextByDoc, outletCounts } = await getConfiguration();
  const d = defaults;

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-warning-50 text-warning-600"><Lock className="h-6 w-6" /></div>
        <h1 className="text-[16px] font-bold text-ink-900">Configuration is manager-only</h1>
        <p className="mt-1 text-[13px] text-ink-500">Ask an Owner, Admin or Manager to change tax, invoicing and deposit settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Configuration" subtitle={`${property.name} · the property-level setup the money modules need`} />

      {/* Taxes, invoicing & compliance — one save */}
      <form action={saveConfiguration} className="space-y-4">
        <Card>
          <CardHeader title="Taxes & VAT" subtitle="Shared with the CRS tax setup; the invoice-specific rates live here" />
          <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
            <div>
              <label className={labelCls}><Percent className="mr-1 inline h-3 w-3" />Standard VAT %</label>
              <input name="vatStandardPct" type="number" min={0} max={100} defaultValue={d?.vatStandardPct ?? 20} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className={labelCls}><Percent className="mr-1 inline h-3 w-3" />Reduced VAT % <span className="text-ink-400">(accommodation)</span></label>
              <input name="vatReducedPct" type="number" min={0} max={100} defaultValue={d?.vatReducedPct ?? 9} className={`${inputCls} w-full`} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>City tax</label>
              <select name="cityTaxMode" defaultValue={d?.cityTaxMode ?? "payable_on_spot"} className={`${inputCls} w-full`}>
                <option value="payable_on_spot">Payable on spot — posts as a folio fee</option>
                <option value="included">Included in the rate — suppressed on the folio</option>
              </select>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Invoice issuer" subtitle="Your legal identity on the tax document (falls back to the property name/address)" />
          <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-3">
            <div><label className={labelCls}>Legal name</label><input name="invoiceIssuerName" defaultValue={d?.invoiceIssuerName ?? ""} placeholder={property.name} className={`${inputCls} w-full`} /></div>
            <div><label className={labelCls}>VAT ID</label><input name="invoiceVatId" defaultValue={d?.invoiceVatId ?? ""} placeholder="e.g. BG123456789" className={`${inputCls} w-full`} /></div>
            <div><label className={labelCls}>Address</label><input name="invoiceAddress" defaultValue={d?.invoiceAddress ?? ""} placeholder={property.address ?? ""} className={`${inputCls} w-full`} /></div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Housekeeping" subtitle="Inspection gate (spec §3.4)" />
            <label className="flex cursor-pointer items-start gap-2.5 p-4">
              <input type="checkbox" name="inspectionGate" defaultChecked={d?.inspectionGate ?? false} className="mt-0.5 h-4 w-4 rounded border-surface-border text-accent-600 focus:ring-accent-600" />
              <span className="text-[12.5px] text-ink-700">
                <span className="font-semibold text-ink-900">Require inspection before a room is sellable.</span> On: a cleaned room is <em>pending inspection</em> and can’t be assigned until a supervisor marks it Inspected. Off: cleaned counts as ready.
              </span>
            </label>
          </Card>

          <Card>
            <CardHeader title="Compliance pack" subtitle="Fiscalization / e-invoicing (spec §4.7) — gated per market" />
            <div className="space-y-2.5 p-4">
              <div>
                <label className={labelCls}><Landmark className="mr-1 inline h-3 w-3" />Jurisdiction</label>
                <select name="jurisdiction" defaultValue={d?.jurisdiction ?? "generic"} className={`${inputCls} w-full`}>
                  <option value="generic">Generic (EU)</option>
                  <option value="bg">Bulgaria</option>
                  <option value="eu">EU (structured e-invoicing)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-[12.5px] text-ink-700"><input type="checkbox" name="fiscalizationEnabled" defaultChecked={d?.fiscalizationEnabled ?? false} className="h-4 w-4 rounded border-surface-border text-accent-600" /> Real-time fiscalization (BG N-18) — routes receipts through a certified provider</label>
              <label className="flex items-center gap-2 text-[12.5px] text-ink-700"><input type="checkbox" name="eInvoicingEnabled" defaultChecked={d?.eInvoicingEnabled ?? false} className="h-4 w-4 rounded border-surface-border text-accent-600" /> Structured e-invoicing (EN 16931 / Peppol) for B2B</label>
              <p className="text-[11px] text-ink-400">The boundary is built (F3); flipping these on connects the certified provider — the invoice/receipt core stays generic.</p>
            </div>
          </Card>
        </div>

        <div className="flex justify-end">
          <button className="rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700">Save configuration</button>
        </div>
      </form>

      {/* Deposit types */}
      <Card>
        <CardHeader title="Deposit types" subtitle="A deposit is a liability, not revenue (spec §4.4) — behaviour + VAT timing per type" />
        <div className="divide-y divide-surface-border/60">
          {depositTypes.map((t) => (
            <form key={t.id} action={saveDepositType} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <input type="hidden" name="id" value={t.id} />
              <input name="name" defaultValue={t.name} className={`${inputCls} w-36`} />
              <select name="behaviour" defaultValue={t.behaviour} className={`${inputCls} w-28`}>
                <option value="held">Held</option>
                <option value="applied">Applied</option>
              </select>
              <select name="vatTiming" defaultValue={t.vatTiming} className={`${inputCls} w-36`} title="When VAT applies">
                <option value="use">VAT at use</option>
                <option value="capture">VAT at capture</option>
              </select>
              <label className="flex items-center gap-1.5 text-[11.5px] text-ink-600"><input type="checkbox" name="active" defaultChecked={t.active} className="h-4 w-4 rounded border-surface-border text-accent-600" /> Active</label>
              <button className="rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-surface-muted">Save</button>
              <button formAction={deleteDepositType} className="rounded-md px-2 py-1.5 text-[12px] font-semibold text-ink-400 hover:text-danger-600">Delete</button>
            </form>
          ))}
        </div>
        <form action={saveDepositType} className="flex flex-wrap items-end gap-2 border-t border-surface-border bg-surface-muted px-4 py-3">
          <input name="name" required placeholder="New type (e.g. Damage)" className={`${inputCls} w-40`} />
          <select name="behaviour" defaultValue="held" className={`${inputCls} w-28`}><option value="held">Held</option><option value="applied">Applied</option></select>
          <select name="vatTiming" defaultValue="use" className={`${inputCls} w-36`}><option value="use">VAT at use</option><option value="capture">VAT at capture</option></select>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12.5px] font-semibold text-white hover:bg-accent-500"><ShieldCheck className="h-3.5 w-3.5" /> Add type</button>
        </form>
      </Card>

      {/* Read-only: invoice series + outlets */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Invoice series" subtitle="Gapless numbering per document type" />
          <div className="p-4 text-[13px]">
            {(["invoice", "proforma", "credit_note"] as const).map((dt) => (
              <div key={dt} className="flex items-center justify-between border-b border-surface-border/50 py-1.5 last:border-0">
                <span className="flex items-center gap-1.5 text-ink-700"><ReceiptText className="h-3.5 w-3.5 text-ink-400" /> {DOC_LABEL[dt]}</span>
                <span className="tnum text-ink-500">next #{nextByDoc[dt] ?? 1}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Outlets" subtitle="Charge sources & their catalogs" action={<Link href="/minibar/catalog" className="text-[12px] font-semibold text-accent-600 hover:underline">Manage catalog →</Link>} />
          <div className="flex flex-wrap gap-2 p-4">
            {POS_OUTLETS.map((o) => (
              <span key={o} className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700">
                {o === "spa" ? <Sparkles className="h-3 w-3 text-accent-500" /> : <Wine className="h-3 w-3 text-accent-500" />}
                {POS_OUTLET_LABEL[o]}
                <StatusPill tone="neutral">{outletCounts.get(o) ?? 0}</StatusPill>
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
