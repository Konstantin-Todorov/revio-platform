import Link from "next/link";
import { Lock, Percent, ReceiptText, ShieldCheck, Sparkles, Wine, Landmark } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { getConfiguration } from "@/lib/config";
import { saveConfiguration, saveDepositType, deleteDepositType } from "@/lib/actions-config";
import { POS_OUTLETS } from "@/lib/roles";
import { i18n } from "@/lib/i18n/server";
import { configuration } from "@/lib/i18n/configuration";
import { extras } from "@/lib/i18n/extras";
import { folio } from "@/lib/i18n/folio";

export const dynamic = "force-dynamic";

const inputCls = "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600";
const labelCls = "mb-1 block text-[11px] font-semibold text-ink-600";

export default async function ConfigurationPage() {
  const { property, canManage, defaults, depositTypes, nextByDoc, outletCounts, suggestedBeds } = await getConfiguration();
  const d = defaults;
  const { t: tr } = await i18n();
  const t = tr(configuration);
  const outletLabel = tr(extras).outlets;
  const docLabel = tr(folio).docs;

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-warning-50 text-warning-600"><Lock className="h-6 w-6" /></div>
        <h1 className="text-[16px] font-bold text-ink-900">{t.lockedTitle}</h1>
        <p className="mt-1 text-[13px] text-ink-500">{t.lockedBody}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t.title} subtitle={t.subtitle(property.name)} />

      {/* Taxes, invoicing & compliance — one save */}
      <form action={saveConfiguration} className="space-y-4">
        <Card>
          <CardHeader title={t.taxes.title} subtitle={t.taxes.subtitle} />
          <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
            <div>
              <label className={labelCls}><Percent className="mr-1 inline h-3 w-3" />{t.taxes.vatStandard}</label>
              <input name="vatStandardPct" type="number" min={0} max={100} defaultValue={d?.vatStandardPct ?? 20} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className={labelCls}><Percent className="mr-1 inline h-3 w-3" />{t.taxes.vatReduced} <span className="text-ink-400">{t.taxes.accommodation}</span></label>
              <input name="vatReducedPct" type="number" min={0} max={100} defaultValue={d?.vatReducedPct ?? 9} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className={labelCls}>{t.taxes.touristTax} <span className="text-ink-400">{t.taxes.touristTaxAside}</span></label>
              {/* Blank, never a default. The council sets this per settlement and per category, and a
                  number we invented would eventually be filed as though we knew it. */}
              <input
                name="touristTaxRate" type="number" step="0.01" min={0} max={100}
                defaultValue={d?.touristTaxRateMinor != null ? (d.touristTaxRateMinor / 100).toFixed(2) : ""}
                placeholder={t.taxes.touristTaxPlaceholder} className={`${inputCls} w-full`}
              />
              <p className="mt-1 text-[10.5px] text-ink-400">{t.taxes.touristTaxHint}</p>
            </div>
            <div>
              <label className={labelCls}>{t.taxes.beds} <span className="text-ink-400">{t.taxes.bedsAside}</span></label>
              <input
                name="touristTaxBeds" type="number" min={0} max={10000}
                defaultValue={d?.touristTaxBeds ?? ""} placeholder={String(suggestedBeds)}
                className={`${inputCls} w-full`}
              />
              <p className="mt-1 text-[10.5px] text-ink-400">
                {t.taxes.bedsHint(suggestedBeds)}
              </p>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>{t.taxes.cityTax}</label>
              <select name="cityTaxMode" defaultValue={d?.cityTaxMode ?? "payable_on_spot"} className={`${inputCls} w-full`}>
                <option value="payable_on_spot">{t.taxes.payableOnSpot}</option>
                <option value="included">{t.taxes.included}</option>
              </select>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={t.issuer.title} subtitle={t.issuer.subtitle} />
          <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-3">
            <div><label className={labelCls}>{t.issuer.legalName}</label><input name="invoiceIssuerName" defaultValue={d?.invoiceIssuerName ?? ""} placeholder={property.name} className={`${inputCls} w-full`} /></div>
            <div><label className={labelCls}>{t.issuer.vatId}</label><input name="invoiceVatId" defaultValue={d?.invoiceVatId ?? ""} placeholder={t.issuer.vatIdPlaceholder} className={`${inputCls} w-full`} /></div>
            <div><label className={labelCls}>{t.issuer.address}</label><input name="invoiceAddress" defaultValue={d?.invoiceAddress ?? ""} placeholder={property.address ?? ""} className={`${inputCls} w-full`} /></div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title={t.housekeeping.title} subtitle={t.housekeeping.subtitle} />
            <div className="divide-y divide-surface-border/60">
              <label className="flex cursor-pointer items-start gap-2.5 p-4">
                <input type="checkbox" name="inspectionGate" defaultChecked={d?.inspectionGate ?? false} className="mt-0.5 h-4 w-4 rounded border-surface-border text-accent-600 focus:ring-accent-600" />
                <span className="text-[12.5px] text-ink-700">
                  <span className="font-semibold text-ink-900">{t.housekeeping.inspectionLead}</span> {t.housekeeping.inspectionBefore} <em>{t.housekeeping.pendingInspection}</em> {t.housekeeping.inspectionAfter}
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 p-4">
                <input type="checkbox" name="autoAssignEnabled" defaultChecked={d?.autoAssignEnabled ?? false} className="mt-0.5 h-4 w-4 rounded border-surface-border text-accent-600 focus:ring-accent-600" />
                <span className="text-[12.5px] text-ink-700">
                  <span className="font-semibold text-ink-900">{t.housekeeping.autoAssignLead}</span> {t.housekeeping.autoAssignBody}
                </span>
              </label>
            </div>
          </Card>

          {/* §3.4 — the two timings that decide when an unclosed day starts nagging and when the
              system ends it. Per-property because the business-day boundary already varies: a
              property that audits at 03:00 and one that audits at midnight cannot share a deadline. */}
          <Card>
            <CardHeader title={t.endOfDay.title} subtitle={t.endOfDay.subtitle} />
            <div className="space-y-2.5 p-4">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>{t.endOfDay.remindAfter}</label>
                  <input
                    name="closeDeadlineMinutes"
                    type="number"
                    min="0"
                    max="1439"
                    defaultValue={d?.closeDeadlineMinutes ?? 30}
                    className={`${inputCls} w-full`}
                  />
                  <p className="mt-1 text-[11px] text-ink-400">{t.endOfDay.remindHint}</p>
                </div>
                <div>
                  <label className={labelCls}>{t.endOfDay.closeAfter}</label>
                  <input
                    name="closeReminderWindowHours"
                    type="number"
                    min="1"
                    max="72"
                    defaultValue={d?.closeReminderWindowHours ?? 22}
                    className={`${inputCls} w-full`}
                  />
                  <p className="mt-1 text-[11px] text-ink-400">{t.endOfDay.closeHint}</p>
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-surface-border p-3">
                <input
                  type="checkbox"
                  name="autoCloseEnabled"
                  defaultChecked={d?.autoCloseEnabled ?? true}
                  className="mt-0.5 h-4 w-4 rounded border-surface-border text-accent-600 focus:ring-accent-600"
                />
                <span className="text-[12.5px] text-ink-700">
                  <span className="font-semibold text-ink-900">{t.endOfDay.autoCloseLead}</span>{" "}
                  {t.endOfDay.autoCloseBody}
                </span>
              </label>
            </div>
          </Card>

          <Card>
            <CardHeader title={t.compliance.title} subtitle={t.compliance.subtitle} />
            <div className="space-y-2.5 p-4">
              <div>
                <label className={labelCls}><Landmark className="mr-1 inline h-3 w-3" />{t.compliance.jurisdiction}</label>
                <select name="jurisdiction" defaultValue={d?.jurisdiction ?? "generic"} className={`${inputCls} w-full`}>
                  <option value="generic">{t.compliance.generic}</option>
                  <option value="bg">{t.compliance.bulgaria}</option>
                  <option value="eu">{t.compliance.eu}</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-[12.5px] text-ink-700"><input type="checkbox" name="fiscalizationEnabled" defaultChecked={d?.fiscalizationEnabled ?? false} className="h-4 w-4 rounded border-surface-border text-accent-600" /> {t.compliance.fiscalization}</label>
              <label className="flex items-center gap-2 text-[12.5px] text-ink-700"><input type="checkbox" name="eInvoicingEnabled" defaultChecked={d?.eInvoicingEnabled ?? false} className="h-4 w-4 rounded border-surface-border text-accent-600" /> {t.compliance.eInvoicing}</label>
              <p className="text-[11px] text-ink-400">{t.compliance.note}</p>
            </div>
          </Card>
        </div>

        <div className="flex justify-end">
          <button className="rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700">{t.save}</button>
        </div>
      </form>

      {/* Deposit types */}
      <Card>
        <CardHeader title={t.deposits.title} subtitle={t.deposits.subtitle} />
        <div className="divide-y divide-surface-border/60">
          {depositTypes.map((dt) => (
            <form key={dt.id} action={saveDepositType} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <input type="hidden" name="id" value={dt.id} />
              <input name="name" defaultValue={dt.name} className={`${inputCls} w-36`} />
              <select name="behaviour" defaultValue={dt.behaviour} className={`${inputCls} w-28`}>
                <option value="held">{t.deposits.held}</option>
                <option value="applied">{t.deposits.applied}</option>
              </select>
              <select name="vatTiming" defaultValue={dt.vatTiming} className={`${inputCls} w-36`} title={t.deposits.vatWhen}>
                <option value="use">{t.deposits.vatAtUse}</option>
                <option value="capture">{t.deposits.vatAtCapture}</option>
              </select>
              <label className="flex items-center gap-1.5 text-[11.5px] text-ink-600"><input type="checkbox" name="active" defaultChecked={dt.active} className="h-4 w-4 rounded border-surface-border text-accent-600" /> {t.deposits.active}</label>
              <button className="rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-surface-muted">{t.deposits.save}</button>
              <button formAction={deleteDepositType} className="rounded-md px-2 py-1.5 text-[12px] font-semibold text-ink-400 hover:text-danger-600">{t.deposits.delete}</button>
            </form>
          ))}
        </div>
        <form action={saveDepositType} className="flex flex-wrap items-end gap-2 border-t border-surface-border bg-surface-muted px-4 py-3">
          <input name="name" required placeholder={t.deposits.newPlaceholder} className={`${inputCls} w-40`} />
          <select name="behaviour" defaultValue="held" className={`${inputCls} w-28`}><option value="held">{t.deposits.held}</option><option value="applied">{t.deposits.applied}</option></select>
          <select name="vatTiming" defaultValue="use" className={`${inputCls} w-36`}><option value="use">{t.deposits.vatAtUse}</option><option value="capture">{t.deposits.vatAtCapture}</option></select>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12.5px] font-semibold text-white hover:bg-accent-500"><ShieldCheck className="h-3.5 w-3.5" /> {t.deposits.add}</button>
        </form>
      </Card>

      {/* Read-only: invoice series + outlets */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t.series.title} subtitle={t.series.subtitle} />
          <div className="p-4 text-[13px]">
            {(["invoice", "proforma", "credit_note"] as const).map((dt) => (
              <div key={dt} className="flex items-center justify-between border-b border-surface-border/50 py-1.5 last:border-0">
                <span className="flex items-center gap-1.5 text-ink-700"><ReceiptText className="h-3.5 w-3.5 text-ink-400" /> {docLabel[dt]}</span>
                <span className="tnum text-ink-500">{t.series.next(String(nextByDoc[dt] ?? "—"))}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title={t.outlets.title} subtitle={t.outlets.subtitle} action={<Link href="/minibar/catalog" className="text-[12px] font-semibold text-accent-600 hover:underline">{t.outlets.manage}</Link>} />
          <div className="flex flex-wrap gap-2 p-4">
            {POS_OUTLETS.map((o) => (
              <span key={o} className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700">
                {o === "spa" ? <Sparkles className="h-3 w-3 text-accent-500" /> : <Wine className="h-3 w-3 text-accent-500" />}
                {outletLabel[o] ?? o}
                <StatusPill tone="neutral">{outletCounts.get(o) ?? 0}</StatusPill>
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
