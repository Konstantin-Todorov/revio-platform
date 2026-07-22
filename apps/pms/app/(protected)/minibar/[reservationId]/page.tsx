import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, Receipt, AlertTriangle, Wine, Sparkles, GlassWater, Utensils, Trash2 } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { getMinibarBoard } from "@/lib/pos";
import { postPosItem } from "@/lib/actions-pos";
import { voidFolioLine } from "@/lib/actions-folio";
import { POS_OUTLETS, POS_OUTLET_LABEL } from "@/lib/roles";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const OUTLET_ICON: Record<string, typeof Wine> = { minibar: Wine, spa: Sparkles, bar: GlassWater, restaurant: Utensils };

export default async function MinibarStagePage({ params, searchParams }: { params: Promise<{ reservationId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { reservationId } = await params;
  const { error } = await searchParams;
  const data = await getMinibarBoard(reservationId);
  if (!data) redirect("/minibar");
  const { reservation: r, items, folio, posted, totals } = data!;

  const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
  const rooms = r.assignments.map((a) => a.unit.label).join(", ");
  const closed = folio.status !== "open";
  // Group the catalog by OUTLET (spec §3.7) — Minibar is one outlet among several.
  const byOutlet = POS_OUTLETS.map((o) => ({ outlet: o, items: items.filter((i) => (i.outlet ?? "minibar") === o) })).filter((g) => g.items.length > 0);

  const grid = (list: typeof items) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {list.map((i) => (
        <form key={i.id} action={postPosItem}>
          <input type="hidden" name="reservationId" value={reservationId} />
          <input type="hidden" name="posItemId" value={i.id} />
          <button type="submit" disabled={closed} className="flex w-full flex-col items-start gap-1 rounded-lg border border-surface-border bg-white p-3 text-left shadow-card transition-colors hover:border-accent-500 hover:bg-accent-50 disabled:cursor-not-allowed disabled:opacity-50">
            <span className="flex items-center gap-1 text-[10.5px] font-semibold text-accent-600"><Plus className="h-3 w-3" />Add</span>
            <span className="text-[13.5px] font-semibold leading-tight text-ink-900">{i.name}</span>
            <span className="tnum text-[12px] font-bold text-ink-500">{money(i.priceMinor, folio.currency)}</span>
          </button>
        </form>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/minibar" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Extras &amp; Charges
      </Link>
      <PageHeader
        title={`Room ${rooms || "—"}`}
        subtitle={`${guestName} · tap an item to add it to the folio`}
        action={
          <Link href={`/folio/${reservationId}`} className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-2 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
            <Receipt className="h-4 w-4" /> Folio · {money(totals.balance, folio.currency)}
          </Link>
        }
      />

      {error === "closed" && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> This folio is closed — the guest has checked out.
        </div>
      )}

      {closed ? (
        <Card className="p-6 text-center text-[13px] text-ink-500">This guest has checked out — the folio is closed.</Card>
      ) : items.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-ink-500">
          No catalog items yet. Add some in <Link href="/minibar/catalog" className="font-semibold text-accent-600 underline">Manage catalog</Link>.
        </Card>
      ) : (
        <div className="space-y-5">
          {byOutlet.map(({ outlet, items: list }) => {
            const Icon = OUTLET_ICON[outlet] ?? Wine;
            return (
              <section key={outlet}>
                <h2 className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-400"><Icon className="h-3.5 w-3.5" /> {POS_OUTLET_LABEL[outlet]}</h2>
                {grid(list)}
              </section>
            );
          })}
        </div>
      )}

      {/* Posted this stay = the control surface (§5.4): each line can be voided while the folio is open
          (→ a credit note once closed, §4.6). */}
      {posted.length > 0 && (
        <Card className="mt-5">
          <div className="border-b border-surface-border px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-ink-400">Posted this stay</div>
          <ul className="divide-y divide-surface-border">
            {posted.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]">
                <span className="min-w-0 truncate text-ink-700">{l.description}</span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="tnum font-semibold text-ink-900">{money(l.amountMinor, folio.currency)}</span>
                  {!closed && (
                    <form action={voidFolioLine}>
                      <input type="hidden" name="reservationId" value={reservationId} />
                      <input type="hidden" name="lineId" value={l.id} />
                      <button type="submit" title="Void this charge" className="rounded p-1 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-surface-border/60 px-4 py-2 text-[11px] text-ink-400">Voiding keeps the line visible on the folio, struck through — nothing is deleted.</p>
        </Card>
      )}
    </div>
  );
}
