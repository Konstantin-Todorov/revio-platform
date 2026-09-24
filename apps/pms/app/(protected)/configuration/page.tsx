import { Percent } from "lucide-react";
import { getConfiguration } from "@/lib/config";
import { i18n } from "@/lib/i18n/server";
import { configuration } from "@/lib/i18n/configuration";
import { ConfigSectionForm, inputCls, labelCls } from "@/components/config/ui";

export const dynamic = "force-dynamic";

/** Configuration → Taxes: VAT, the tourist tax and how the city tax is shown to a guest. */
export default async function ConfigTaxesPage() {
  const { defaults: d, suggestedBeds } = await getConfiguration();
  const { t: tr } = await i18n();
  const t = tr(configuration);

  return (
    <ConfigSectionForm section="taxes" title={t.taxes.title} subtitle={t.taxes.subtitle} save={t.save}>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
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
          <p className="mt-1 text-[10.5px] text-ink-400">{t.taxes.bedsHint(suggestedBeds)}</p>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>{t.taxes.cityTax}</label>
          <select name="cityTaxMode" defaultValue={d?.cityTaxMode ?? "payable_on_spot"} className={`${inputCls} w-full`}>
            <option value="payable_on_spot">{t.taxes.payableOnSpot}</option>
            <option value="included">{t.taxes.included}</option>
          </select>
        </div>
      </div>
    </ConfigSectionForm>
  );
}
