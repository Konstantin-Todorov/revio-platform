"use client";

import { matrixRows, type BulkTargetRoom, type BulkOp } from "@revio/core";

const inputCls =
  "h-8 w-full rounded-md border border-surface-border bg-white px-2 text-[12.5px] text-ink-900 outline-none focus:border-brand-600";

const OPS: [BulkOp, string, string][] = [
  ["set", "Set to", "€"],
  ["inc_pct", "Increase by", "%"],
  ["dec_pct", "Decrease by", "%"],
  ["inc_amt", "Increase by", "€"],
  ["dec_amt", "Decrease by", "€"],
];

export type MatrixEntry = { op: BulkOp | ""; value: string };

/**
 * The Price control, when the selected plans price per person — CRS §6.4.
 *
 * ## Two entry modes, and why the simple one is the default
 *
 * **Primary + offsets** sets the main price once and derives the rest — Channex's recommended path,
 * and what most hotels actually mean when they say "each extra guest is €20". It is the default
 * because typing four prices to express one rule is how a hotelier decides the feature is not worth
 * it.
 *
 * **Manual** sets each guest count explicitly, for the hotel whose prices follow no rule.
 *
 * ## Rows that cannot reach every selected room say so
 *
 * A selection spanning a 2-guest Double and a 4-guest Family renders four rows — the HIGHEST cap,
 * because rendering to the smallest would hide the Family's larger prices behind a Double that
 * happens to be selected. Rows 3 and 4 are marked as not applying to the Double, so nobody types a
 * price that silently goes nowhere.
 */
export function OccupancyMatrix({
  rooms,
  primaryOccupancy,
  primaryOccupancyNote,
  mode,
  onModeChange,
  entries,
  onEntryChange,
  offset,
  onOffsetChange,
  primaryValue,
  onPrimaryValueChange,
}: {
  rooms: BulkTargetRoom[];
  primaryOccupancy: number;
  /** Set when the main guest count was derived rather than chosen, so the label can say so. */
  primaryOccupancyNote?: string | null;
  mode: "offsets" | "manual";
  onModeChange: (m: "offsets" | "manual") => void;
  entries: Record<number, MatrixEntry>;
  onEntryChange: (occupancy: number, e: MatrixEntry) => void;
  offset: { direction: "inc_amt" | "inc_pct"; value: string };
  onOffsetChange: (o: { direction: "inc_amt" | "inc_pct"; value: string }) => void;
  primaryValue: string;
  onPrimaryValueChange: (v: string) => void;
}) {
  const rows = matrixRows(rooms);
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-surface-border bg-surface-muted/30 p-3">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-ink-700">Price per guest count</span>
        <div className="flex rounded-md border border-surface-border bg-white p-0.5 text-[11.5px] font-semibold">
          {(["offsets", "manual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`rounded px-2 py-1 transition-colors ${
                mode === m ? "bg-brand-800 text-white" : "text-ink-500 hover:text-ink-800"
              }`}
            >
              {m === "offsets" ? "One rule" : "Each one"}
            </button>
          ))}
        </div>
      </div>

      {mode === "offsets" ? (
        <div className="space-y-2.5">
          <div className="grid grid-cols-[auto,1fr] items-center gap-2">
            <span
              className="text-[12px] text-ink-600"
              {...(primaryOccupancyNote ? { title: primaryOccupancyNote } : {})}
            >
              {primaryOccupancy} guests
              {primaryOccupancyNote ? <span className="text-ink-400"> · assumed</span> : null}
            </span>
            <input
              type="number" step="0.01" value={primaryValue}
              onChange={(e) => onPrimaryValueChange(e.target.value)}
              placeholder="Main price (€)" className={inputCls}
            />
          </div>
          <div className="grid grid-cols-[auto,7rem,1fr] items-center gap-2">
            <span className="text-[12px] text-ink-600">each extra guest</span>
            <select
              value={offset.direction}
              onChange={(e) => onOffsetChange({ ...offset, direction: e.target.value as "inc_amt" | "inc_pct" })}
              className={inputCls}
            >
              <option value="inc_amt">+ €</option>
              <option value="inc_pct">+ %</option>
            </select>
            <input
              type="number" step="0.01" value={offset.value}
              onChange={(e) => onOffsetChange({ ...offset, value: e.target.value })}
              placeholder="20" className={inputCls}
            />
          </div>
          <p className="text-[11px] leading-relaxed text-ink-500">
            {/* Says what "each extra" compounds to, because per-step and per-row give different
                answers for a percentage and the difference is invisible until the OTA shows it. */}
            Applied once per guest above {primaryOccupancy} — so {primaryOccupancy + 1} guests gets it
            once and {primaryOccupancy + 2} gets it twice.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const entry = entries[r.occupancy] ?? { op: "", value: "" };
            const unit = OPS.find(([o]) => o === entry.op)?.[2] ?? "";
            return (
              <div key={r.occupancy} className="grid grid-cols-[3.5rem,1fr,6rem] items-center gap-2">
                <span className="text-[12px] text-ink-600">
                  {r.occupancy}p
                  {r.skippedBy.length > 0 && (
                    <span
                      title={`Not applied to ${r.skippedBy.join(", ")} — ${r.skippedBy.length === 1 ? "it does" : "they do"} not sleep that many`}
                      className="ml-0.5 cursor-help text-warning-600"
                    >
                      *
                    </span>
                  )}
                </span>
                <select
                  value={entry.op}
                  onChange={(e) => onEntryChange(r.occupancy, { ...entry, op: e.target.value as BulkOp | "" })}
                  className={inputCls}
                >
                  <option value="">— no change —</option>
                  {OPS.map(([o, label, u]) => (
                    <option key={o} value={o}>{`${label} ${u}`}</option>
                  ))}
                </select>
                <input
                  type="number" step="0.01" value={entry.value}
                  onChange={(e) => onEntryChange(r.occupancy, { ...entry, value: e.target.value })}
                  disabled={entry.op === ""} placeholder={unit || "—"}
                  className={`${inputCls} disabled:opacity-50`}
                />
              </div>
            );
          })}
          {rows.some((r) => r.skippedBy.length > 0) && (
            <p className="pt-1 text-[11px] leading-relaxed text-ink-500">
              * Skipped for rooms that do not sleep that many — never sent as a price they cannot
              take.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
