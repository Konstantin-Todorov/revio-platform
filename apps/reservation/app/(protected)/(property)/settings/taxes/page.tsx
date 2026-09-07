import { prisma } from "@/lib/db";
import { getProperty } from "@/lib/data";
import { deleteTaxFee, saveTaxFee } from "@/lib/actions-settings";
import { Card, CardHeader, StatusPill } from "@/components/ui/primitives";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400";

export default async function SettingsTaxesPage() {
  const property = await getProperty();
  const taxes = await prisma.taxFee.findMany({
    where: { propertyId: property.id },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <Card>
        <CardHeader title="Taxes & Fees" />
        {taxes.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                {["Name", "Amount", "Basis", "In displayed rate?", "Status"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {taxes.map((t) => (
                <tr key={t.id} className="group border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{t.name}</td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{t.type === "percent" ? `${t.pct}%` : money(t.amountMinor ?? 0, property.baseCurrency)}</td>
                  <td className="px-4 py-2.5 text-ink-600">{t.basis.replace("_", " ")}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={t.inclusion === "included" ? "info" : "neutral"}>{t.inclusion}</StatusPill></td>
                  <td className="px-4 py-2.5"><StatusPill tone={t.active ? "success" : "neutral"}>{t.active ? "active" : "off"}</StatusPill></td>
                  <td className="px-2 py-2.5 text-right">
                    <span className="opacity-0 transition-opacity group-hover:opacity-100">
                      <DeleteButton action={deleteTaxFee} id={t.id} label={t.name} note="Existing reservations keep their recorded totals." />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        <form action={saveTaxFee} className="grid grid-cols-2 items-end gap-3 border-t border-surface-border/60 p-4 lg:grid-cols-7">
          <div><label className={labelCls}>Name</label><input name="name" required placeholder="City tax" className={inputCls} /></div>
          <div>
            <label className={labelCls}>Type</label>
            <select name="type" defaultValue="fixed" className={inputCls}><option value="fixed">Fixed</option><option value="percent">Percent</option></select>
          </div>
          <div><label className={labelCls}>Amount ({property.baseCurrency})</label><input type="number" step="0.01" min="0" name="amount" placeholder="1.50" className={inputCls} /></div>
          <div><label className={labelCls}>Percent</label><input type="number" step="0.1" min="0" name="pct" placeholder="9" className={inputCls} /></div>
          <div>
            <label className={labelCls}>Basis</label>
            <select name="basis" defaultValue="per_person" className={inputCls}>
              <option value="per_room">Per room</option><option value="per_person">Per person</option>
              <option value="per_night">Per night</option><option value="per_stay">Per stay</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Displayed rate</label>
            <select name="inclusion" defaultValue="excluded" className={inputCls}><option value="excluded">Excluded</option><option value="included">Included</option></select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[12px] font-medium text-ink-700">
              <input type="checkbox" name="active" defaultChecked className="h-3.5 w-3.5 rounded border-surface-border text-brand-600" /> Active
            </label>
            <button className="h-[34px] rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">Add</button>
          </div>
        </form>
      </Card>
    </>
  );
}
