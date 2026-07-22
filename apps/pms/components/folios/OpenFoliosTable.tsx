"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Receipt, ChevronRight, Search, ArrowDownWideNarrow } from "lucide-react";
import { StatusPill } from "@/components/ui/primitives";
import { money } from "@/lib/format";

export type OpenFolioRow = {
  reservationId: string;
  guestName: string;
  units: string[];
  balance: number | null;
  currency: string;
};

/** Open folios (PMS-REFINEMENT-R1 §4.3): the live operational list. Search by guest/room + a
 * "who owes money" sort that floats the biggest balances up. */
export function OpenFoliosTable({ rows }: { rows: OpenFolioRow[] }) {
  const [q, setQ] = useState("");
  const [byBalance, setByBalance] = useState(false);

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = needle ? rows.filter((r) => r.guestName.toLowerCase().includes(needle) || r.units.join(" ").toLowerCase().includes(needle)) : rows;
    if (byBalance) out = [...out].sort((a, b) => (b.balance ?? -1) - (a.balance ?? -1));
    return out;
  }, [rows, q, byBalance]);

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-surface-border px-4 py-2.5">
        <Search className="h-4 w-4 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guest or room…" className="w-full bg-transparent text-[13px] text-ink-900 outline-none placeholder:text-ink-400" />
        <button
          type="button"
          onClick={() => setByBalance((v) => !v)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${byBalance ? "border-accent-500 bg-accent-50 text-accent-700" : "border-surface-border text-ink-500 hover:bg-surface-muted"}`}
        >
          <ArrowDownWideNarrow className="h-3.5 w-3.5" /> Who owes
        </button>
      </div>
      <ul className="divide-y divide-surface-border">
        {view.map((r) => (
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
        {view.length === 0 && <li className="px-4 py-6 text-center text-[12.5px] text-ink-400">No open folios match “{q}”.</li>}
      </ul>
    </div>
  );
}
