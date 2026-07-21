"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { StatusPill, type Tone } from "@/components/ui/primitives";
import { money } from "@/lib/format";

export type ResRow = {
  id: string;
  guestName: string;
  externalId: string | null;
  checkIn: string | null;
  checkOut: string | null;
  roomTypeName: string | null;
  quantity: number;
  source: string;
  totalMinor: number;
  currency: string;
  status: string;
  bookedIso: string;
};

const STATUS_TONES: Record<string, Tone> = {
  confirmed: "success", modified: "info", cancelled: "neutral", no_show: "warning",
  overbooked: "danger", failed_import: "danger", expired: "neutral", hold: "warning", draft: "neutral",
};
// Lifecycle order (spec §3.1) — Status sorts by this, not alphabetically.
const STATUS_RANK: Record<string, number> = {
  draft: 0, hold: 1, confirmed: 2, modified: 3, overbooked: 4, no_show: 5, expired: 6, failed_import: 7, cancelled: 8,
};

type SortCol = "guest" | "stay" | "room" | "source" | "total" | "status" | "booked";
type Sort = { col: SortCol; dir: "asc" | "desc" } | null;

// Per-column sort key (§3.1): defined so "third click returns to the default chronological order".
function keyOf(r: ResRow, col: SortCol): string | number {
  switch (col) {
    case "guest": return r.guestName.toLowerCase();
    case "stay": return r.checkIn ?? "";
    case "room": return `${r.roomTypeName ?? ""}`.toLowerCase() + String(r.quantity).padStart(3, "0");
    case "source": return r.source.toLowerCase();
    case "total": return r.totalMinor;
    case "status": return STATUS_RANK[r.status] ?? 99;
    case "booked": return r.bookedIso;
  }
}

/** Reservations table with 3-click sortable columns (CRS-REFINEMENT-R2 §3): asc → desc → back to the
 * default chronological order. Single active sort; display-only (never mutates data); respects the
 * server-applied filters (it only reorders the rows it was given). */
export function ReservationsTable({ rows }: { rows: ResRow[] }) {
  const [sort, setSort] = useState<Sort>(null);

  const click = (col: SortCol) =>
    setSort((prev) => (!prev || prev.col !== col ? { col, dir: "asc" } : prev.dir === "asc" ? { col, dir: "desc" } : null));

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const ka = keyOf(a, sort.col), kb = keyOf(b, sort.col);
      if (typeof ka === "number" && typeof kb === "number") return (ka - kb) * dir;
      return String(ka).localeCompare(String(kb)) * dir;
    });
  }, [rows, sort]);

  const Th = ({ col, label, align = "left" }: { col: SortCol; label: string; align?: "left" | "right" }) => {
    const active = sort?.col === col;
    const Icon = !active ? ChevronsUpDown : sort!.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th className={`px-4 py-2.5 ${align === "right" ? "text-right" : "text-left"}`}>
        <button
          type="button"
          onClick={() => click(col)}
          className={`group inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""} ${active ? "text-brand-700" : "text-ink-400 hover:text-ink-600"}`}
        >
          {label}
          <Icon className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40 group-hover:opacity-70"}`} />
        </button>
      </th>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-surface-border text-[11px] font-semibold uppercase tracking-wide">
            <Th col="guest" label="Guest" />
            <Th col="stay" label="Stay" />
            <Th col="room" label="Room" />
            <Th col="source" label="Source" />
            <Th col="total" label="Total" align="right" />
            <Th col="status" label="Status" />
            <Th col="booked" label="Booked" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
              <td className="px-4 py-2.5">
                <Link href={`/reservations/${r.id}`} className="font-semibold text-brand-700 hover:underline">{r.guestName}</Link>
                <div className="tnum text-[11px] text-ink-400">#{r.externalId ?? r.id.slice(-6)}</div>
              </td>
              <td className="tnum px-4 py-2.5 text-ink-600">{r.checkIn && r.checkOut ? `${r.checkIn} → ${r.checkOut}` : "—"}</td>
              <td className="px-4 py-2.5 text-ink-600">{r.roomTypeName ? `${r.roomTypeName}${r.quantity > 1 ? ` ×${r.quantity}` : ""}` : "—"}</td>
              <td className="px-4 py-2.5 text-ink-600">{r.source}</td>
              <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{money(r.totalMinor, r.currency)}</td>
              <td className="px-4 py-2.5"><StatusPill tone={STATUS_TONES[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</StatusPill></td>
              <td className="tnum px-4 py-2.5 text-ink-500">{r.bookedIso}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
