import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { getCatalog } from "@/lib/pos";
import { POS_OUTLETS } from "@/lib/roles";
import { i18n } from "@/lib/i18n/server";
import { extras } from "@/lib/i18n/extras";
import { ExtrasTabs } from "@/components/extras/ExtrasTabs";
import { CatalogManager } from "@/components/extras/CatalogManager";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { roleHasCapability } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * The catalog — the second tab of Extras & Charges.
 *
 * It was an inline spreadsheet: four inputs, a checkbox and two icon buttons on every row, every
 * item in one list whatever it was, and "Breakfast" filed under Minibar because that was the
 * default. Now it reads like the charge screen it feeds — by outlet, a name and a price per line,
 * and the editing tucked behind ✎ until somebody asks for it.
 */
export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  // Every write here needs `manage`; an outlet account that types the address goes back to charging.
  const session = await getSession();
  if (!session || !roleHasCapability(session.role, "manage")) redirect("/minibar");
  const { property, items } = await getCatalog();
  const { t, money } = await i18n();
  const x = t(extras);
  const s = x.catalog;

  return (
    /* Full width, like "Charge a guest" beside it: two tabs of one screen must not jump in size and
       position when you switch between them (founder, 2026-09-25). */
    <div>
      {/* The same header as "Charge a guest": a tab changes what is below the tabs, never the page above. */}
      <PageHeader title={x.title} subtitle={x.subtitle} />
      <ExtrasTabs active="catalog" t={x.tabs} catalogCount={items.length} />

      {(error === "price" || error === "fields") && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error === "price" ? s.priceError : s.fieldsError}
        </div>
      )}

      <CatalogManager
        outlets={POS_OUTLETS}
        items={items.map((i) => ({
          id: i.id, name: i.name, outlet: i.outlet ?? "minibar", category: i.category, priceMinor: i.priceMinor,
          active: i.active, price: money(i.priceMinor, property.baseCurrency),
        }))}
        t={{
          // Named one by one: the dictionary carries functions, which cannot cross to a client component.
          name: s.name, namePlaceholder: s.namePlaceholder, outlet: s.outlet, type: s.type, item: s.item, extra: s.extra,
          price: s.price(property.baseCurrency), adding: s.adding, add: s.add, active: s.active, activeHint: s.activeHint,
          save: s.save, cancel: s.cancel, itemsOne: s.itemsOne, itemsMany: s.itemsMany, addTo: s.addTo,
          emptyOutlet: s.emptyOutlet, edit: s.edit, hidden: s.hidden, dragAria: s.dragAria,
          deleteConfirm: s.deleteConfirm, delete: s.delete, kindHint: s.kindHint, outlets: x.outlets,
        }}
      />
    </div>
  );
}
