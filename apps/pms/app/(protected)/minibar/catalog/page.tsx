import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save, AlertTriangle } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { getCatalog } from "@/lib/pos";
import { createPosItem, updatePosItem, deletePosItem } from "@/lib/actions-pos";
import { POS_OUTLETS, POS_OUTLET_LABEL } from "@/lib/roles";

export const dynamic = "force-dynamic";

const inputCls = "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { property, items } = await getCatalog();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/minibar" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Minibar / POS
      </Link>
      <PageHeader title="Catalog" subtitle={`${property.name} · items you can tap-to-post to a folio`} />

      {error === "fields" && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Enter a name and a positive price.
        </div>
      )}

      {/* Add */}
      <Card className="mb-4 p-4">
        <h3 className="mb-3 text-[13px] font-bold text-ink-900">Add an item</h3>
        <form action={createPosItem} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-600">Name</span>
            <input name="name" required placeholder="e.g. Espresso" className={`${inputCls} w-40`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-600">Outlet</span>
            <select name="outlet" defaultValue="minibar" className={`${inputCls} w-28`}>
              {POS_OUTLETS.map((o) => <option key={o} value={o}>{POS_OUTLET_LABEL[o]}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-600">Type</span>
            <select name="category" defaultValue="minibar" className={`${inputCls} w-24`}>
              <option value="minibar">Item</option>
              <option value="extra">Extra</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-600">Price ({property.baseCurrency})</span>
            <input name="price" type="text" inputMode="decimal" required placeholder="0.00" className={`${inputCls} w-24`} />
          </label>
          <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-500">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </form>
      </Card>

      {/* List — inline editable */}
      {items.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-ink-500">No catalog items yet.</Card>
      ) : (
        <Card>
          <ul className="divide-y divide-surface-border">
            {items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <form action={updatePosItem} className="flex flex-1 flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={it.id} />
                  <input name="name" defaultValue={it.name} className={`${inputCls} w-36 flex-1`} />
                  <select name="outlet" defaultValue={it.outlet ?? "minibar"} className={`${inputCls} w-24`}>
                    {POS_OUTLETS.map((o) => <option key={o} value={o}>{POS_OUTLET_LABEL[o]}</option>)}
                  </select>
                  <select name="category" defaultValue={it.category} className={`${inputCls} w-20`}>
                    <option value="minibar">Item</option>
                    <option value="extra">Extra</option>
                  </select>
                  <input name="price" type="text" inputMode="decimal" defaultValue={(it.priceMinor / 100).toFixed(2)} className={`${inputCls} w-20`} />
                  <label className="flex items-center gap-1.5 text-[11.5px] text-ink-600">
                    <input type="checkbox" name="active" defaultChecked={it.active} className="h-4 w-4 rounded border-surface-border text-accent-600 focus:ring-accent-600" />
                    Active
                  </label>
                  <button type="submit" aria-label="Save" title="Save" className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-ink-500 transition-colors hover:bg-surface-muted hover:text-accent-600">
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </form>
                <form action={deletePosItem}>
                  <input type="hidden" name="id" value={it.id} />
                  <button type="submit" aria-label="Delete" title="Delete" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-danger-50 hover:text-danger-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
