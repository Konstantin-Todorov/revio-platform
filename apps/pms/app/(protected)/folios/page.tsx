import Link from "next/link";
import { Receipt, ChevronRight } from "lucide-react";
import { Card, PageHeader, StatusPill } from "@/components/ui/primitives";
import { listFolios } from "@/lib/folio";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FoliosPage() {
  const { rows } = await listFolios();

  return (
    <div>
      <PageHeader title="Folios &amp; Billing" subtitle="In-house guests and their bills. Open a folio to post charges or take payment." />

      {rows.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[14px] font-semibold text-ink-900">No one in house</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-500">
            Folios open automatically when a guest checks in. Check someone in from the{" "}
            <Link href="/dashboard" className="font-semibold text-accent-600 underline">Front Desk</Link>.
          </p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-surface-border">
            {rows.map((r) => (
              <li key={r.reservationId}>
                <Link href={`/folio/${r.reservationId}`} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-muted">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600"><Receipt className="h-4 w-4" /></div>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-ink-900">{r.guestName}</div>
                      <div className="text-[11.5px] text-ink-500">Room {r.units.join(", ") || "—"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.balance == null ? (
                      <StatusPill tone="neutral">Not opened</StatusPill>
                    ) : r.balance === 0 ? (
                      <StatusPill tone="success">Settled</StatusPill>
                    ) : (
                      <span className="tnum text-[13.5px] font-bold text-danger-600">{money(r.balance, r.currency)}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-ink-300" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
