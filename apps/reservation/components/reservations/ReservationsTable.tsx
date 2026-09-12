"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { ColumnsMenu, useColumnVisibility, type ColumnDef } from "@revio/ui/column-visibility";
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

export type SortCol = "guest" | "stay" | "room" | "source" | "total" | "status" | "booked";
type Sort = { col: SortCol; dir: "asc" | "desc" } | null;

/**
 * ⚠️ ONE definition per column — heading, sort key and cell together.
 *
 * The header row and the body row used to be two hand-written lists that happened to be in the same
 * order. That is fine until a column can be hidden: drop the fourth `<th>` and not the fourth
 * `<td>`, and every value from there on sits under the wrong heading — a table that is confidently,
 * silently wrong, which is the worst thing a reservation list can be. Deriving both from this array
 * makes that impossible to express.
 */
interface ResColumn extends ColumnDef {
  key: SortCol;
  align?: "left" | "right";
  /** Per-column sort key (§3.1): asc → desc → back to the default chronological order. */
  sortKey: (r: ResRow) => string | number;
  cell: (r: ResRow) => ReactNode;
}

const COLUMNS: ResColumn[] = [
  {
    key: "guest",
    label: "Guest",
    // The only column that cannot be hidden: it carries the link out of the row, so a table
    // without it is a list you can read and never open.
    locked: true,
    sortKey: (r) => r.guestName.toLowerCase(),
    cell: (r) => (
      <>
        <Link href={`/reservations/${r.id}`} className="font-semibold text-brand-700 hover:underline">{r.guestName}</Link>
        <div className="tnum text-[11px] text-ink-400">#{r.externalId ?? r.id.slice(-6)}</div>
      </>
    ),
  },
  {
    key: "stay",
    label: "Stay",
    sortKey: (r) => r.checkIn ?? "",
    cell: (r) => <span className="tnum text-ink-600">{r.checkIn && r.checkOut ? `${r.checkIn} → ${r.checkOut}` : "—"}</span>,
  },
  {
    key: "room",
    label: "Room",
    sortKey: (r) => `${r.roomTypeName ?? ""}`.toLowerCase() + String(r.quantity).padStart(3, "0"),
    cell: (r) => <span className="text-ink-600">{r.roomTypeName ? `${r.roomTypeName}${r.quantity > 1 ? ` ×${r.quantity}` : ""}` : "—"}</span>,
  },
  {
    key: "source",
    label: "Source",
    sortKey: (r) => r.source.toLowerCase(),
    cell: (r) => <span className="text-ink-600">{r.source}</span>,
  },
  {
    key: "total",
    label: "Total",
    align: "right",
    sortKey: (r) => r.totalMinor,
    cell: (r) => <span className="tnum font-semibold text-ink-900">{money(r.totalMinor, r.currency)}</span>,
  },
  {
    key: "status",
    label: "Status",
    sortKey: (r) => STATUS_RANK[r.status] ?? 99,
    cell: (r) => <StatusPill tone={STATUS_TONES[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</StatusPill>,
  },
  {
    key: "booked",
    label: "Booked",
    sortKey: (r) => r.bookedIso,
    cell: (r) => <span className="tnum text-ink-500">{r.bookedIso}</span>,
  },
];

/** Per browser, per table. Named for the screen so the Guests picker never inherits this one. */
const STORAGE_KEY = "revio.crs.reservations.columns";

/** Reservations table with 3-click sortable columns (CRS-REFINEMENT-R2 §3): asc → desc → back to the
 * default chronological order. Single active sort; display-only (never mutates data); respects the
 * server-applied filters (it only reorders the rows it was given). */
export function ReservationsTable({ rows }: { rows: ResRow[] }) {
  const [sort, setSort] = useState<Sort>(null);
  const { hidden, visible, toggle, reset } = useColumnVisibility(STORAGE_KEY, COLUMNS);

  /*
   * Hiding the column you sorted by clears the sort. Leaving it would order the table by something
   * no longer on screen — the rows look shuffled and nothing explains why.
   */
  useEffect(() => {
    if (sort && hidden.has(sort.col)) setSort(null);
  }, [hidden, sort]);

  const click = (col: SortCol) =>
    setSort((prev) => (!prev || prev.col !== col ? { col, dir: "asc" } : prev.dir === "asc" ? { col, dir: "desc" } : null));

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const def = COLUMNS.find((c) => c.key === sort.col);
    if (!def) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const ka = def.sortKey(a), kb = def.sortKey(b);
      if (typeof ka === "number" && typeof kb === "number") return (ka - kb) * dir;
      return String(ka).localeCompare(String(kb)) * dir;
    });
  }, [rows, sort]);

  const cols = visible as ResColumn[];

  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-surface-border px-3 py-2">
        <span className="tnum text-[11.5px] text-ink-400">
          {rows.length} reservation{rows.length === 1 ? "" : "s"}
        </span>
        <ColumnsMenu columns={COLUMNS} hidden={hidden} onToggle={(k) => toggle(k)} onReset={reset} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-[11px] font-semibold uppercase tracking-wide">
              {cols.map((c) => {
                const active = sort?.col === c.key;
                const Icon = !active ? ChevronsUpDown : sort!.dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th key={c.key} className={`px-4 py-2.5 ${c.align === "right" ? "text-right" : "text-left"}`}>
                    <button
                      type="button"
                      onClick={() => click(c.key)}
                      className={`group inline-flex items-center gap-1 ${c.align === "right" ? "flex-row-reverse" : ""} ${active ? "text-brand-700" : "text-ink-400 hover:text-ink-600"}`}
                    >
                      {c.label}
                      <Icon className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40 group-hover:opacity-70"}`} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                {cols.map((c) => (
                  <td key={c.key} className={`px-4 py-2.5 ${c.align === "right" ? "text-right" : ""}`}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
