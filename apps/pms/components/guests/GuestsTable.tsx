"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { money } from "@/lib/format";

export type GuestRow = {
  key: string;
  name: string;
  email: string | null;
  stays: number;
  nights: number;
  ancillaryMinor: number;
  lifetimeMinor: number;
  lastStay: string | null;
};

type Col = "name" | "stays" | "nights" | "ancillary" | "lifetime" | "last";
type Sort = { col: Col; dir: "asc" | "desc" } | null;

function keyOf(r: GuestRow, col: Col): string | number {
  switch (col) {
    case "name": return r.name.toLowerCase();
    case "stays": return r.stays;
    case "nights": return r.nights;
    case "ancillary": return r.ancillaryMinor;
    case "lifetime": return r.lifetimeMinor;
    case "last": return r.lastStay ?? "";
  }
}

/** Operational guest list (PMS-REFINEMENT-R1 §3.1): search by name + 3-click sortable columns
 * (asc → desc → default). Default order is lifetime value, richest first. */
export function GuestsTable({ rows, currency }: { rows: GuestRow[]; currency: string }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>(null);

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = needle ? rows.filter((r) => r.name.toLowerCase().includes(needle) || (r.email ?? "").toLowerCase().includes(needle)) : rows;
    if (sort) {
      const dir = sort.dir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        const ka = keyOf(a, sort.col), kb = keyOf(b, sort.col);
        return (typeof ka === "number" && typeof kb === "number" ? ka - kb : String(ka).localeCompare(String(kb))) * dir;
      });
    }
    return out;
  }, [rows, q, sort]);

  const click = (col: Col) =>
    setSort((p) => (!p || p.col !== col ? { col, dir: "asc" } : p.dir === "asc" ? { col, dir: "desc" } : null));

  const Th = ({ col, label, align = "left" }: { col: Col; label: string; align?: "left" | "right" }) => {
    const active = sort?.col === col;
    const Icon = !active ? ChevronsUpDown : sort!.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th className={`px-4 py-2.5 ${align === "right" ? "text-right" : "text-left"}`}>
        <button type="button" onClick={() => click(col)} className={`group inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""} ${active ? "text-accent-600" : "text-ink-400 hover:text-ink-600"}`}>
          {label}<Icon className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40 group-hover:opacity-70"}`} />
        </button>
      </th>
    );
  };

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-surface-border px-4 py-2.5">
        <Search className="h-4 w-4 text-ink-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-transparent text-[13px] text-ink-900 outline-none placeholder:text-ink-400"
        />
        <span className="shrink-0 text-[11.5px] text-ink-400">{view.length} of {rows.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-[11px] font-semibold uppercase tracking-wide">
              <Th col="name" label="Guest" />
              <Th col="stays" label="Stays" align="right" />
              <Th col="nights" label="Nights" align="right" />
              <Th col="ancillary" label="Ancillary spend" align="right" />
              <Th col="lifetime" label="Lifetime" align="right" />
              <Th col="last" label="Last stay" />
            </tr>
          </thead>
          <tbody>
            {view.map((g) => (
              <tr key={g.key} className="border-b border-surface-border/60 last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-2.5">
                  <Link href={`/guests/${encodeURIComponent(g.key)}`} className="font-semibold text-accent-600 hover:underline">{g.name}</Link>
                  {g.email && <div className="text-[11.5px] text-ink-400">{g.email}</div>}
                </td>
                <td className="tnum px-4 py-2.5 text-right text-ink-700">{g.stays}</td>
                <td className="tnum px-4 py-2.5 text-right text-ink-700">{g.nights}</td>
                <td className="tnum px-4 py-2.5 text-right text-ink-600">{g.ancillaryMinor > 0 ? money(g.ancillaryMinor, currency) : "—"}</td>
                <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{money(g.lifetimeMinor, currency)}</td>
                <td className="tnum px-4 py-2.5 text-ink-500">{g.lastStay ?? "—"}</td>
              </tr>
            ))}
            {view.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[12.5px] text-ink-400">No guests match “{q}”.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
