"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Columns3, Lock, RotateCcw } from "lucide-react";
import { Menu } from "./menu";

/**
 * "Hide fields" for a hand-rolled table.
 *
 * A reservation row carries seven columns because seven different people need one of them. A
 * receptionist working arrivals does not need Booked or Total; an owner reconciling a month needs
 * exactly those two and not Room. Rather than argue the default, let each person put the columns
 * they never read away — and, critically, be told they did.
 *
 * ## Four rules, each of which is a bug that would otherwise ship
 *
 * 1. **What is stored is the HIDDEN set, never the visible set.** Store "visible" and the next
 *    column we add is invisible to every user who has ever opened this menu — a shipped feature
 *    nobody sees, with no error anywhere to say so. Store "hidden" and a new column arrives on.
 * 2. **A locked column is listed, disabled — not omitted.** A menu that silently leaves out Guest
 *    is a menu that disagrees with the table in front of it. Say "always shown" instead.
 * 3. **The trigger states the count when anything is hidden.** A silent hide is how somebody
 *    concludes the Total column "disappeared from the system" and opens a support thread.
 * 4. **The preference applies after hydration, never during the first render.** Reading storage in
 *    a `useState` initializer makes the client's first tree differ from the server's, which React
 *    resolves by throwing the markup away. First paint shows every column; the stored choice lands
 *    a frame later.
 *
 * Storage is per browser, per table (`storageKey`), and every read and write is guarded: a private
 * window, a browser set to block site data, and a thumbnail capture all throw on access, and a
 * column picker is never worth a blank screen.
 */

export interface ColumnDef {
  key: string;
  label: string;
  /** Locked columns are the record's identity — the link out of the row. Never hideable. */
  locked?: boolean;
}

/**
 * The visible columns, given what the reader has hidden.
 *
 * Pure, and exported on purpose: the table header and the table body must derive their columns from
 * one call, or they drift by one cell and every value lands under the wrong heading.
 */
export function visibleColumns<T extends ColumnDef>(columns: T[], hidden: ReadonlySet<string>): T[] {
  return columns.filter((c) => c.locked || !hidden.has(c.key));
}

/**
 * A stored value, read back safely.
 *
 * Pure and exported so the rules below are testable without a browser — the storage call around it
 * is the part that cannot be: a private window, a browser blocking site data and a thumbnail
 * capture each throw on `localStorage` access, and a column picker is never worth a blank screen.
 *
 * Anything that is not a list of currently-known, currently-hideable keys reads as "nothing
 * hidden". A key that no longer exists is dropped rather than kept, so a renamed column cannot
 * leave a ghost entry that silently hides its replacement if the name is ever reused; a key that
 * has since been locked is dropped too, because the table will show that column regardless and a
 * menu row claiming otherwise is a lie.
 */
export function parseHidden(raw: string | null, columns: ColumnDef[]): Set<string> {
  if (!raw) return new Set();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Set();
  }
  if (!Array.isArray(parsed)) return new Set();
  const hideable = new Set(columns.filter((c) => !c.locked).map((c) => c.key));
  return new Set(parsed.filter((k): k is string => typeof k === "string" && hideable.has(k)));
}

/** The hidden set after clicking one row. A locked column never moves. */
export function nextHidden(current: ReadonlySet<string>, key: string, columns: ColumnDef[]): Set<string> {
  const col = columns.find((c) => c.key === key);
  const next = new Set(current);
  if (!col || col.locked) return next;
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function readHidden(storageKey: string, columns: ColumnDef[]): Set<string> {
  try {
    return parseHidden(window.localStorage.getItem(storageKey), columns);
  } catch {
    return new Set();
  }
}

export function useColumnVisibility(storageKey: string, columns: ColumnDef[]) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  // Rule 4 — after hydration, not during it.
  useEffect(() => {
    const stored = readHidden(storageKey, columns);
    if (stored.size > 0) setHidden(stored);
    // `columns` is a literal defined at module scope by every caller; keying on the storage key
    // alone keeps this to one read per table rather than one per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = useCallback(
    (next: Set<string>) => {
      setHidden(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // A preference that cannot be remembered still applies for this visit.
      }
    },
    [storageKey],
  );

  const toggle = useCallback(
    (key: string) => {
      setHidden((prev) => {
        const next = nextHidden(prev, key, columns);
        try {
          window.localStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {
          /* see persist */
        }
        return next;
      });
    },
    [columns, storageKey],
  );

  const reset = useCallback(() => persist(new Set()), [persist]);

  const visible = useMemo(() => visibleColumns(columns, hidden), [columns, hidden]);

  return { hidden, visible, toggle, reset, hiddenCount: hidden.size };
}

/** The trigger + checklist. Kept beside the hook so the two never describe different columns. */
export function ColumnsMenu({
  columns,
  hidden,
  onToggle,
  onReset,
}: {
  columns: ColumnDef[];
  hidden: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onReset: () => void;
}) {
  const count = hidden.size;
  return (
    <Menu
      align="right"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-semibold transition-colors ${
            count > 0
              ? "border-brand-600/30 bg-brand-50 text-brand-800"
              : "border-surface-border bg-white text-ink-600 hover:bg-surface-muted"
          }`}
        >
          <Columns3 className="h-3.5 w-3.5" />
          Columns
          {/* Rule 3 — hidden is a state the reader can see, not a state they have to remember. */}
          {count > 0 && <span className="tnum">· {count} hidden</span>}
        </button>
      )}
    >
      <div className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
        Show columns
      </div>
      {columns.map((c) => {
        const on = c.locked || !hidden.has(c.key);
        return (
          <button
            key={c.key}
            type="button"
            role="menuitemcheckbox"
            aria-checked={on}
            aria-disabled={c.locked || undefined}
            disabled={c.locked}
            onClick={() => onToggle(c.key)}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] outline-none transition-colors duration-fast ease-standard focus-visible:shadow-focus ${
              c.locked ? "cursor-default text-ink-600" : "text-ink-700 hover:bg-accent-50 hover:text-ink-900"
            }`}
          >
            <span
              aria-hidden
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                on ? "border-brand-700 bg-brand-700 text-white" : "border-surface-border bg-white"
              }`}
            >
              {on && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            {c.label}
            {/* Rule 2 — listed and explained, never quietly absent. */}
            {c.locked && (
              <span className="ml-auto flex items-center gap-1 text-[10.5px] uppercase tracking-wide text-ink-400">
                <Lock className="h-2.5 w-2.5" /> always
              </span>
            )}
          </button>
        );
      })}
      {count > 0 && (
        <>
          <div className="my-1 h-px bg-surface-border" role="separator" />
          <button
            type="button"
            role="menuitem"
            onClick={onReset}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-brand-700 outline-none transition-colors duration-fast hover:bg-accent-50 focus-visible:shadow-focus"
          >
            <RotateCcw className="h-3 w-3" /> Show all columns
          </button>
        </>
      )}
    </Menu>
  );
}
