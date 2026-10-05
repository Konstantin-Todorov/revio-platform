import { Landmark } from "lucide-react";
import { getConfiguration } from "@/lib/config";
import { i18n } from "@/lib/i18n/server";
import { configuration } from "@/lib/i18n/configuration";
import { ConfigSectionForm, inputCls, labelCls } from "@/components/config/ui";
import { FISCAL_TAX_GROUPS } from "@revio/core";
import { fiscalGroupsFor } from "@/lib/fiscal";
import { PrinterSetup } from "@/components/fiscal/PrinterSetup";

export const dynamic = "force-dynamic";

/** What each Н-18 group usually carries, so a letter means something to the person choosing it. */
const GROUP_RATE: Record<string, string> = { "А": "0%", "Б": "20%", "Г": "9%" };

/** Configuration → Compliance: the jurisdiction pack — fiscalization and e-invoicing. */
export default async function ConfigCompliancePage() {
  const { defaults: d } = await getConfiguration();
  const { t: tr } = await i18n();
  const t = tr(configuration);
  const f = t.compliance.fiscal;
  const groups = fiscalGroupsFor(d);

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
        <div className="max-w-sm">
          <label className={labelCls}>{t.compliance.estiUin} <span className="text-ink-400">{t.compliance.estiUinAside}</span></label>
          <input name="estiPlaceUin" defaultValue={d?.estiPlaceUin ?? ""} maxLength={500} className={`${inputCls} w-full`} />
          <p className="mt-1 text-[10.5px] text-ink-400">{t.compliance.estiUinHint}</p>
        </div>
        <label className="flex items-start gap-2 text-[12.5px] text-ink-700"><input type="checkbox" name="fiscalizationEnabled" defaultChecked={d?.fiscalizationEnabled ?? false} className="mt-0.5 h-4 w-4 rounded border-surface-border text-accent-600" /> {t.compliance.fiscalization}</label>
        <label className="flex items-start gap-2 text-[12.5px] text-ink-700"><input type="checkbox" name="eInvoicingEnabled" defaultChecked={d?.eInvoicingEnabled ?? false} className="mt-0.5 h-4 w-4 rounded border-surface-border text-accent-600" /> {t.compliance.eInvoicing}</label>
        <p className="text-[11px] text-ink-400">{t.compliance.note}</p>

        {d?.jurisdiction === "bg" && <section className="space-y-3 border-t border-surface-border pt-4">
          <div>
            <h3 className="text-[13px] font-bold text-ink-900">{f.title}</h3>
            <p className="mt-0.5 max-w-xl text-[12px] text-ink-500">{f.lead}</p>
          </div>
          <fieldset className="space-y-1.5">
            <legend className={labelCls}>{f.device}</legend>
            {(["none", "erpnet"] as const).map((v) => (
              <label key={v} className="flex items-start gap-2 text-[12.5px] text-ink-700">
                <input type="radio" name="fiscalDevice" value={v} defaultChecked={(d?.fiscalDevice ?? "none") === v} className="mt-0.5 h-4 w-4 border-surface-border text-accent-600" />
                {v === "none" ? f.deviceNone : f.deviceErpnet}
              </label>
            ))}
          </fieldset>
          <div>
            <p className={labelCls}>{f.groups}</p>
            <div className="grid max-w-xl gap-2 sm:grid-cols-2">
              {(["reduced", "standard", "city_tax", "exempt"] as const).map((c) => (
                <label key={c} className="flex items-center justify-between gap-2 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] text-ink-700">
                  {f.cat[c]}
                  <select name={`fiscalGroup_${c}`} defaultValue={groups[c]} className="h-7 rounded border border-surface-border bg-white px-1.5 text-[12px] font-semibold">
                    {FISCAL_TAX_GROUPS.map((g) => <option key={g} value={g}>{GROUP_RATE[g] ? `${g} — ${GROUP_RATE[g]}` : g}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <p className="mt-1 text-[10.5px] text-ink-400">{f.groupsHint}</p>
          </div>
          <PrinterSetup s={f.printer} />
          <p className="text-[11px] text-ink-500">{f.guide} <a href="https://reviosoft.app/bg/guides/fiscal-printer" target="_blank" rel="noreferrer" className="font-semibold text-accent-600 underline underline-offset-2">ErpNet.FP →</a></p>
        </section>}
      </div>
    </ConfigSectionForm>
  );
}
