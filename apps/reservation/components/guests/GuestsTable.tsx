"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { ColumnsMenu, useColumnVisibility, type ColumnDef } from "@revio/ui/column-visibility";

export type GuestRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  bookings: number;
};

interface GuestColumn extends ColumnDef {
  align?: "left" | "right";
  cell: (g: GuestRow) => ReactNode;
}

/** Same rule as the reservations table: heading and cell come from ONE entry, so a hidden column
 * can never take its heading and leave its values (or the reverse). */
const COLUMNS: GuestColumn[] = [
  {
    key: "guest",
    label: "Guest",
    locked: true,
    cell: (g) => (
      <Link href={`/guests/${g.id}`} className="font-semibold text-brand-700 hover:underline">
        {g.lastName}, {g.firstName}
      </Link>
    ),
  },
  { key: "email", label: "Email", cell: (g) => <span className="text-ink-600">{g.email ?? "—"}</span> },
  { key: "phone", label: "Phone", cell: (g) => <span className="tnum text-ink-600">{g.phone ?? "—"}</span> },
  { key: "company", label: "Company", cell: (g) => <span className="text-ink-600">{g.company ?? "—"}</span> },
  {
    key: "bookings",
    label: "Bookings",
    align: "right",
    cell: (g) => <span className="tnum font-semibold text-ink-900">{g.bookings}</span>,
  },
];

/** Its own key: a hotel that hides Company here has said nothing about the reservation list. */
const STORAGE_KEY = "revio.crs.guests.columns";

export function GuestsTable({ rows }: { rows: GuestRow[] }) {
  const { hidden, visible, toggle, reset } = useColumnVisibility(STORAGE_KEY, COLUMNS);
  const cols = visible as GuestColumn[];

  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-surface-border px-3 py-2">
        <span className="tnum text-[11.5px] text-ink-400">
          {rows.length} guest{rows.length === 1 ? "" : "s"}
        </span>
        <ColumnsMenu columns={COLUMNS} hidden={hidden} onToggle={(k) => toggle(k)} onReset={reset} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              {cols.map((c) => (
                <th key={c.key} className={`px-4 py-2.5 ${c.align === "right" ? "text-right" : ""}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id} className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                {cols.map((c) => (
                  <td key={c.key} className={`px-4 py-2.5 ${c.align === "right" ? "text-right" : ""}`}>
                    {c.cell(g)}
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
