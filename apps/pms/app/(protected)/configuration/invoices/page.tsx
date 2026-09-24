import { ReceiptText } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { getConfiguration } from "@/lib/config";
import { i18n } from "@/lib/i18n/server";
import { configuration } from "@/lib/i18n/configuration";
import { folio } from "@/lib/i18n/folio";
import { ConfigSectionForm, inputCls, labelCls } from "@/components/config/ui";

export const dynamic = "force-dynamic";

/** Configuration → Invoices: the numbering (read only, first — it is the fact) and who issues them. */
export default async function ConfigInvoicesPage() {
  const { property, defaults: d, nextByDoc } = await getConfiguration();
  const { t: tr } = await i18n();
  const t = tr(configuration);
  const docLabel = tr(folio).docs;

  return (
    <>
      <Card>
        <CardHeader title={t.series.title} subtitle={t.series.subtitle} />
        <div className="px-4 pb-4 text-[13px]">
          {(["invoice", "proforma", "credit_note"] as const).map((dt) => (
            <div key={dt} className="flex items-center justify-between border-b border-surface-border/50 py-1.5 last:border-0">
              <span className="flex items-center gap-1.5 text-ink-700"><ReceiptText className="h-3.5 w-3.5 text-ink-400" /> {docLabel[dt]}</span>
              <span className="tnum text-ink-500">{t.series.next(String(nextByDoc[dt] ?? "—"))}</span>
            </div>
          ))}
        </div>
      </Card>
      <ConfigSectionForm section="invoices" title={t.issuer.title} subtitle={t.issuer.subtitle} save={t.save}>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <div><label className={labelCls}>{t.issuer.legalName}</label><input name="invoiceIssuerName" defaultValue={d?.invoiceIssuerName ?? ""} placeholder={property.name} className={`${inputCls} w-full`} /></div>
          <div><label className={labelCls}>{t.issuer.vatId}</label><input name="invoiceVatId" defaultValue={d?.invoiceVatId ?? ""} placeholder={t.issuer.vatIdPlaceholder} className={`${inputCls} w-full`} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>{t.issuer.address}</label><input name="invoiceAddress" defaultValue={d?.invoiceAddress ?? ""} placeholder={property.address ?? ""} className={`${inputCls} w-full`} /></div>
        </div>
      </ConfigSectionForm>
    </>
  );
}
