import { Landmark } from "lucide-react";
import { getConfiguration } from "@/lib/config";
import { i18n } from "@/lib/i18n/server";
import { configuration } from "@/lib/i18n/configuration";
import { ConfigSectionForm, inputCls, labelCls } from "@/components/config/ui";

export const dynamic = "force-dynamic";

/** Configuration → Compliance: the jurisdiction pack — fiscalization and e-invoicing. */
export default async function ConfigCompliancePage() {
  const { defaults: d } = await getConfiguration();
  const { t: tr } = await i18n();
  const t = tr(configuration);

  return (
    <ConfigSectionForm section="compliance" title={t.compliance.title} subtitle={t.compliance.subtitle} save={t.save}>
      <div className="space-y-3 p-4">
        <div className="max-w-sm">
          <label className={labelCls}><Landmark className="mr-1 inline h-3 w-3" />{t.compliance.jurisdiction}</label>
          <select name="jurisdiction" defaultValue={d?.jurisdiction ?? "generic"} className={`${inputCls} w-full`}>
            <option value="generic">{t.compliance.generic}</option>
            <option value="bg">{t.compliance.bulgaria}</option>
            <option value="eu">{t.compliance.eu}</option>
          </select>
        </div>
        <label className="flex items-start gap-2 text-[12.5px] text-ink-700"><input type="checkbox" name="fiscalizationEnabled" defaultChecked={d?.fiscalizationEnabled ?? false} className="mt-0.5 h-4 w-4 rounded border-surface-border text-accent-600" /> {t.compliance.fiscalization}</label>
        <label className="flex items-start gap-2 text-[12.5px] text-ink-700"><input type="checkbox" name="eInvoicingEnabled" defaultChecked={d?.eInvoicingEnabled ?? false} className="mt-0.5 h-4 w-4 rounded border-surface-border text-accent-600" /> {t.compliance.eInvoicing}</label>
        <p className="text-[11px] text-ink-400">{t.compliance.note}</p>
      </div>
    </ConfigSectionForm>
  );
}
