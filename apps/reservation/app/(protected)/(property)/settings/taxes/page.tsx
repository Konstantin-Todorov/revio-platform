import { i18n } from "@/lib/i18n/server";
import { settings as settingsDict } from "@/lib/i18n/settings";
import { prisma } from "@/lib/db";
import { getProperty } from "@/lib/data";
import { deleteTaxFee, saveTaxFee } from "@/lib/actions-settings";
import { Card, CardHeader, StatusPill } from "@/components/ui/primitives";
import { DeleteButton } from "@/components/ui/DeleteButton";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
const labelCls = "mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400";

export default async function SettingsTaxesPage() {
  const property = await getProperty();
  const { t: tr, money } = await i18n();
  const t = tr(settingsDict).taxes;
  const taxes = await prisma.taxFee.findMany({
    where: { propertyId: property.id },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <Card>
        <CardHeader title={t.title} />
        {taxes.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                {[t.cols.name, t.cols.amount, t.cols.basis, t.cols.inRate, t.cols.status].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {taxes.map((tax) => (
                <tr key={tax.id} className="group border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{tax.name}</td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{tax.type === "percent" ? `${tax.pct}%` : money(tax.amountMinor ?? 0, property.baseCurrency)}</td>
                  <td className="px-4 py-2.5 text-ink-600">{t.basis[tax.basis as keyof typeof t.basis] ?? tax.basis.replace("_", " ")}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={tax.inclusion === "included" ? "info" : "neutral"}>{t.inclusion[tax.inclusion as keyof typeof t.inclusion] ?? tax.inclusion}</StatusPill></td>
                  <td className="px-4 py-2.5"><StatusPill tone={tax.active ? "success" : "neutral"}>{tax.active ? t.active : t.off}</StatusPill></td>
                  <td className="px-2 py-2.5 text-right">
                    <span className="opacity-0 transition-opacity group-hover:opacity-100">
                      <DeleteButton action={deleteTaxFee} id={tax.id} label={tax.name} note={t.deleteNote} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        <form action={saveTaxFee} className="grid grid-cols-2 items-end gap-3 border-t border-surface-border/60 p-4 lg:grid-cols-7">
          <div><label className={labelCls}>{t.name}</label><input name="name" required placeholder={t.namePlaceholder} className={inputCls} /></div>
          <div>
            <label className={labelCls}>{t.type}</label>
            <select name="type" defaultValue="fixed" className={inputCls}><option value="fixed">{t.fixed}</option><option value="percent">{t.percent}</option></select>
          </div>
          <div><label className={labelCls}>{t.amount(property.baseCurrency)}</label><input type="number" step="0.01" min="0" name="amount" placeholder="1.50" className={inputCls} /></div>
          <div><label className={labelCls}>{t.pct}</label><input type="number" step="0.1" min="0" name="pct" placeholder="9" className={inputCls} /></div>
          <div>
            <label className={labelCls}>{t.basisLabel}</label>
            <select name="basis" defaultValue="per_person" className={inputCls}>
              <option value="per_room">{cap(t.basis.per_room)}</option><option value="per_person">{cap(t.basis.per_person)}</option>
              <option value="per_night">{cap(t.basis.per_night)}</option><option value="per_stay">{cap(t.basis.per_stay)}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t.displayed}</label>
            <select name="inclusion" defaultValue="excluded" className={inputCls}><option value="excluded">{cap(t.inclusion.excluded)}</option><option value="included">{cap(t.inclusion.included)}</option></select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[12px] font-medium text-ink-700">
              <input type="checkbox" name="active" defaultChecked className="h-3.5 w-3.5 rounded border-surface-border text-brand-600" /> {t.activeLabel}
            </label>
            <button className="h-[34px] rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">{t.add}</button>
          </div>
        </form>
      </Card>
    </>
  );
}
