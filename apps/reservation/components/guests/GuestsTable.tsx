"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { ColumnsMenu, useColumnVisibility, type ColumnDef } from "@revio/ui/column-visibility";
import { translate, type Locale } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { guests as guestsDict } from "@/lib/i18n/guests";

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
function columnsFor(locale: Locale): GuestColumn[] {
  const t = translate(guestsDict, locale).table.cols;
  return [
  {
    key: "guest",
    label: t.guest,
    locked: true,
    cell: (g) => (
      <Link href={`/guests/${g.id}`} className="font-semibold text-brand-700 hover:underline">
        {g.lastName}, {g.firstName}
      </Link>
    ),
  },
  { key: "email", label: t.email, cell: (g) => <span className="text-ink-600">{g.email ?? "—"}</span> },
  { key: "phone", label: t.phone, cell: (g) => <span className="tnum text-ink-600">{g.phone ?? "—"}</span> },
  { key: "company", label: t.company, cell: (g) => <span className="text-ink-600">{g.company ?? "—"}</span> },
  {
    key: "bookings",
    label: t.bookings,
    align: "right",
    cell: (g) => <span className="tnum font-semibold text-ink-900">{g.bookings}</span>,
  },
  ];
}

/** Its own key: a hotel that hides Company here has said nothing about the reservation list. */
const STORAGE_KEY = "revio.crs.guests.columns";

export function GuestsTable({ rows }: { rows: GuestRow[] }) {
  const locale = useLocale();
  const COLUMNS = useMemo(() => columnsFor(locale), [locale]);
  const count = translate(guestsDict, locale).table.count;
  const { hidden, visible, toggle, reset } = useColumnVisibility(STORAGE_KEY, COLUMNS);
  const cols = visible as GuestColumn[];

  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-surface-border px-3 py-2">
        <span className="tnum text-[11.5px] text-ink-400">
          {count(rows.length)}
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
