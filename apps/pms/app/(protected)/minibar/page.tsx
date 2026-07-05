import Link from "next/link";
import { Wine, ChevronRight, Settings2, DoorOpen } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { listFolios } from "@/lib/folio";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MinibarPage() {
  const { rows } = await listFolios();

  return (
    <div>
      <PageHeader
        title="Minibar / POS"
        subtitle="Pick a room to post minibar items and extras to the guest’s folio."
        action={
          <Link href="/minibar/catalog" className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-2 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
            <Settings2 className="h-4 w-4" /> Manage catalog
          </Link>
        }
      />

      {rows.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[14px] font-semibold text-ink-900">No occupied rooms</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-500">
            Minibar charges post to an in-house guest’s folio. Check someone in from the{" "}
            <Link href="/dashboard" className="font-semibold text-accent-600 underline">Front Desk</Link> first.
          </p>
        </Card>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Link key={r.reservationId} href={`/minibar/${r.reservationId}`} className="flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-white p-3.5 shadow-card transition-colors hover:bg-surface-muted">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600"><DoorOpen className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="text-[15px] font-bold tracking-tight text-ink-900">{r.units.join(", ") || "—"}</div>
                  <div className="truncate text-[11.5px] text-ink-500">{r.guestName}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {r.balance != null && r.balance > 0 && <span className="tnum text-[11.5px] font-semibold text-ink-400">{money(r.balance, r.currency)}</span>}
                <ChevronRight className="h-4 w-4 text-ink-300" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
