"use client";

import { useState } from "react";
import { GlassWater, Pencil, Plus, Sparkles, Utensils, Wine, X } from "lucide-react";
import { fill } from "@revio/ui/i18n";
import { SubmitButton } from "@revio/ui/submit-button";
import { SortableList } from "@revio/ui/sortable";
import { createPosItem, deletePosItem, reorderPosItems, updatePosItem } from "@/lib/actions-pos";

/** Strings only — a client component takes no functions. Worded on the server. */
export type CatalogStrings = {
  name: string; namePlaceholder: string; outlet: string; type: string; item: string; extra: string;
  price: string; adding: string; add: string; active: string; activeHint: string; save: string; cancel: string;
  itemsOne: string; itemsMany: string; addTo: string; emptyOutlet: string; edit: string; hidden: string;
  dragAria: string; deleteConfirm: string; delete: string; kindHint: string;
  outlets: Record<string, string>;
};

export type CatalogItem = {
  id: string; name: string; outlet: string; category: string; priceMinor: number; active: boolean;
  /** Formatted on the server in the reader's language. */
  price: string;
};

const OUTLET_ICON: Record<string, typeof Wine> = { minibar: Wine, spa: Sparkles, bar: GlassWater, restaurant: Utensils };

const inputCls =
  "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600";

/**
 * The fields of one item, for adding and for editing — one form, so the two cannot drift. The
 * outlet is a dropdown: editing an item is also how it moves to another outlet.
 */
function ItemFields({ t, outlets, item, outlet }: { t: CatalogStrings; outlets: readonly string[]; item?: CatalogItem; outlet: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_9rem_8rem_7rem]">
      <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
        <span className="text-[11px] font-semibold text-ink-600">{t.name}</span>
        <input name="name" required defaultValue={item?.name} placeholder={t.namePlaceholder} autoFocus className={`${inputCls} w-full`} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-ink-600">{t.outlet}</span>
        <select name="outlet" defaultValue={item?.outlet ?? outlet} className={`${inputCls} w-full`}>
          {outlets.map((o) => <option key={o} value={o}>{t.outlets[o] ?? o}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-ink-600">{t.type}</span>
        <select name="category" defaultValue={item?.category ?? (outlet === "minibar" ? "minibar" : "extra")} title={t.kindHint} className={`${inputCls} w-full`}>
          <option value="minibar">{t.item}</option>
          <option value="extra">{t.extra}</option>
        </select>
      </label>
      <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
        <span className="text-[11px] font-semibold text-ink-600">{t.price}</span>
        <input
          name="price" type="text" inputMode="decimal" required placeholder="0.00"
          defaultValue={item ? (item.priceMinor / 100).toFixed(2) : undefined}
          className={`${inputCls} w-full`}
        />
      </label>
    </div>
  );
}

function ItemRow({ item, t, outlets, handle }: { item: CatalogItem; t: CatalogStrings; outlets: readonly string[]; handle: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const iconBtn = "flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-ink-700 disabled:opacity-30 disabled:hover:bg-transparent";

  if (editing) {
    return (
      <div className="bg-surface-muted px-4 py-3">
        <form action={async (fd) => { await updatePosItem(fd); setEditing(false); }} className="space-y-3">
          <input type="hidden" name="id" value={item.id} />
          <ItemFields t={t} outlets={outlets} item={item} outlet={item.outlet} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink-700">
              <input type="checkbox" name="active" defaultChecked={item.active} className="h-4 w-4 rounded border-surface-border text-accent-600 focus:ring-accent-600" />
              {t.activeHint}
            </label>
            <span className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => setEditing(false)} className="text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">{t.cancel}</button>
              <SubmitButton pendingLabel={t.adding} className="inline-flex h-9 items-center rounded-md bg-accent-600 px-3 text-[12.5px] font-semibold text-white hover:bg-accent-500">
                {t.save}
              </SubmitButton>
            </span>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 py-2.5 pl-2 pr-4 ${item.active ? "" : "bg-surface-muted/50"}`}>
      {handle}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13.5px] font-semibold ${item.active ? "text-ink-900" : "text-ink-400"}`}>{item.name}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-400">
          {item.category === "extra" ? t.extra : t.item}
          {!item.active && <span className="rounded bg-ink-100 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-ink-500">{t.hidden}</span>}
        </span>
      </span>
      <span className={`tnum shrink-0 text-[13.5px] font-bold ${item.active ? "text-ink-900" : "text-ink-400"}`}>{item.price}</span>
      <span className="flex shrink-0 items-center">
        <button type="button" onClick={() => setEditing(true)} aria-label={fill(t.edit, { item: item.name })} title={fill(t.edit, { item: item.name })} className={iconBtn}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <form action={deletePosItem}>
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            aria-label={`${t.delete} ${item.name}`}
            title={t.delete}
            onClick={(e) => { if (!confirm(fill(t.deleteConfirm, { item: item.name }))) e.preventDefault(); }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
          >
            <X className="h-4 w-4" />
          </button>
        </form>
      </span>
    </div>
  );
}

/**
 * The catalog, grouped by where each thing is sold — the same shape as the charge screen, so the
 * list you keep is the list you tap. Every outlet is always shown, empty ones included, because an
 * outlet with nowhere to add to is an outlet nobody finds out the hotel can have.
 */
export function CatalogManager({ items, outlets, t }: { items: CatalogItem[]; outlets: readonly string[]; t: CatalogStrings }) {
  const [adding, setAdding] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {outlets.map((outlet) => {
        const list = items.filter((i) => (i.outlet || "minibar") === outlet);
        const Icon = OUTLET_ICON[outlet] ?? Wine;
        const name = t.outlets[outlet] ?? outlet;
        return (
          <section key={outlet} className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
            <div className="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
              <h2 className="flex items-center gap-2 text-[14px] font-bold tracking-tight text-ink-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-50 text-accent-600"><Icon className="h-4 w-4" /></span>
                {name}
                <span className="text-[11.5px] font-normal text-ink-400">{list.length === 1 ? t.itemsOne : fill(t.itemsMany, { n: list.length })}</span>
              </h2>
              <button
                type="button"
                onClick={() => setAdding((a) => (a === outlet ? null : outlet))}
                className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
              >
                <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{fill(t.addTo, { outlet: name })}</span><span className="sm:hidden">{t.add}</span>
              </button>
            </div>

            {adding === outlet && (
              <form
                action={async (fd) => { await createPosItem(fd); setAdding(null); }}
                className="space-y-3 border-b border-surface-border bg-surface-muted px-4 py-3"
              >
                <ItemFields t={t} outlets={outlets} outlet={outlet} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-ink-400">{t.kindHint}</p>
                  <span className="flex items-center gap-2">
                    <button type="button" onClick={() => setAdding(null)} className="text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">{t.cancel}</button>
                    <SubmitButton pendingLabel={t.adding} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12.5px] font-semibold text-white hover:bg-accent-500">
                      <Plus className="h-3.5 w-3.5" /> {t.add}
                    </SubmitButton>
                  </span>
                </div>
              </form>
            )}

            {list.length === 0 ? (
              <p className="px-4 py-3 text-[12.5px] text-ink-400">{t.emptyOutlet}</p>
            ) : (
              <SortableList
                items={list}
                className="divide-y divide-surface-border/70"
                handleLabel={(it) => fill(t.dragAria, { item: it.name })}
                onReorder={(ids) => reorderPosItems(outlet, ids)}
                render={(it, handle) => <ItemRow item={it} t={t} outlets={outlets} handle={handle} />}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
