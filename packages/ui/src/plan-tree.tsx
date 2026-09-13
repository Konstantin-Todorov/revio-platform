"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Link2, Minus, Search, X } from "lucide-react";
import {
  invertSelection, isRoomOnly, matchesSearch, pairKey, roomCheckState, selectAll,
  selectionCount, selectionSummary, toggleRoom, togglePlan,
  type SelectablePlan, type SelectableRoom,
} from "@revio/core";

/**
 * "Which rate plans would you like to apply these changes to?" — one room-first tree.
 *
 * ## What it replaces, and why the shape was the bug
 *
 * Bulk Update had two independent blocks: room types, then rate plans. Two lists cannot show that a
 * plan belongs to a room, and on 13 September that produced BUG-022 — both plan checkboxes rendered
 * a truncated list of room types instead of their own names, so the one screen where you choose
 * between two plans displayed them identically.
 *
 * It is the same property-scoped-vs-room-scoped mismatch as BUG-019 arriving on a second screen:
 * the selector treated rate plans as property-level objects while every operation it drives is
 * room-scoped. Fixing the label alone would have left the confusion exactly where it was.
 *
 * ## ⚠️ Shown, not hidden
 *
 * Derived and inactive plans appear greyed and unselectable. A plan you cannot see is a plan you
 * cannot reason about — without BB Mobile on screen, "apply to the whole room" is a promise whose
 * scope nobody can check, and the hotel has no way to know what the change will cascade to.
 *
 * ## The summary is the safeguard
 *
 * §5.1 calls it the most valuable part of the pattern, and it is: until now the Review dialog was
 * the ONLY place plan names appeared correctly, and it comes after the choice is made.
 */
export function PlanTree({
  rooms,
  selected,
  onChange,
  accentText = "text-brand-700",
}: {
  rooms: SelectableRoom[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  accentText?: string;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    if (!query.trim()) return rooms;
    return rooms
      .map((r) => {
        // A room whose own name matches keeps all its plans; otherwise only the matching ones.
        if (matchesSearch(r, null, query)) return r;
        const plans = r.plans.filter((p) => matchesSearch(r, p, query));
        return plans.length > 0 ? { ...r, plans } : null;
      })
      .filter((r): r is SelectableRoom => r !== null);
  }, [rooms, query]);

  const groups = selectionSummary(rooms, selected);

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="rounded-lg border border-surface-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-border px-3 py-2">
        <span className="relative flex min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a plan or room, by name or code…"
            className="h-8 w-full rounded-md border border-surface-border bg-white pl-7 pr-2 text-[12.5px] outline-none focus:border-brand-600"
          />
        </span>
        <button type="button" onClick={() => onChange(selectAll(rooms))} className={`text-[12px] font-semibold ${accentText} hover:underline`}>
          Select all
        </button>
        <button type="button" onClick={() => onChange(invertSelection(rooms, selected))} className={`text-[12px] font-semibold ${accentText} hover:underline`}>
          Inverse
        </button>
        <button type="button" onClick={() => onChange(new Set())} className="text-[12px] font-semibold text-ink-500 hover:underline">
          Clear
        </button>
      </div>

      <div className="max-h-[24rem] overflow-y-auto p-2">
        {visible.length === 0 && (
          <p className="px-2 py-6 text-center text-[12.5px] text-ink-400">Nothing matches “{query}”.</p>
        )}

        {visible.map((room) => {
          const state = roomCheckState(room, selected);
          const isCollapsed = collapsed.has(room.id);
          /*
           * A room with nothing tickable is still selectable — allocation and every restriction are
           * written per room type, and this is exactly the room (just created, no plan linked yet)
           * whose allocation somebody needs to set. It says so on the row, because a ticked room
           * over greyed children would otherwise read as a bug.
           */
          const roomOnly = isRoomOnly(room);
          return (
            <div key={room.id} className="mb-1 last:mb-0">
              <div className="flex items-center gap-1.5 rounded-md px-1 py-1 hover:bg-surface-muted">
                <button
                  type="button"
                  onClick={() => toggleCollapse(room.id)}
                  aria-label={isCollapsed ? `Expand ${room.name}` : `Collapse ${room.name}`}
                  className="rounded p-0.5 text-ink-400 hover:text-ink-700"
                >
                  {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {/* Tri-state: one glance says whether a room is fully or partly selected (§5.3 rule 5). */}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={state === "indeterminate" ? "mixed" : state === "checked"}
                  onClick={() => onChange(toggleRoom(room, selected))}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    state === "unchecked"
                      ? "border-surface-border bg-white"
                      : "border-brand-700 bg-brand-700 text-white"
                  }`}
                >
                  {state === "checked" && <span className="text-[10px] leading-none">✓</span>}
                  {state === "indeterminate" && <Minus className="h-2.5 w-2.5" strokeWidth={4} />}
                </button>

                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-800">{room.name}</span>
                {roomOnly && (
                  <span
                    title="No rate plan you can edit is linked to this room. Allocation and restrictions still apply to it; a price change does not."
                    className="shrink-0 rounded bg-warning-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-700"
                  >
                    allocation &amp; restrictions only
                  </span>
                )}
                {room.code && <span className="shrink-0 text-[11px] text-ink-400">{room.code}</span>}
              </div>

              {!isCollapsed && (
                /*
                  A rule down the left, not just indentation. The room and its plans carried similar
                  weight, so which plans belonged to which room took a second look — and this is the
                  screen where getting that wrong prices the wrong product.
                */
                <ul className="ml-[1.15rem] space-y-0.5 border-l border-surface-border pl-3">
                  {room.plans.map((p) => (
                    <PlanRow
                      key={p.id}
                      plan={p}
                      checked={selected.has(pairKey(room.id, p.id))}
                      onToggle={() => onChange(togglePlan(room, p.id, selected))}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/*
        ⚠️ The safeguard. Until now the Review dialog was the only place plan names appeared
        correctly, and it comes AFTER the choice. This says what is about to change, in plain names,
        grouped by room, each removable — before anything is applied.
      */}
      <div className="border-t border-surface-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-ink-700">{selectionCount(groups)}</span>
          {groups.length > 0 && (
            <button type="button" onClick={() => onChange(new Set())} className="text-[12px] font-semibold text-ink-500 hover:underline">
              Clear
            </button>
          )}
        </div>
        {groups.map((g) => (
          <div key={g.roomTypeId} className="mt-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{g.roomTypeName}</div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {g.roomOnly && (
                <span className="rounded-md border border-warning-600/25 bg-warning-50 px-2 py-0.5 text-[11.5px] text-warning-700">
                  the room itself — allocation &amp; restrictions
                </span>
              )}
              {g.plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const room = rooms.find((r) => r.id === g.roomTypeId);
                    if (room) onChange(togglePlan(room, p.id, selected));
                  }}
                  className="flex items-center gap-1 rounded-md border border-brand-600/25 bg-brand-50 py-0.5 pl-2 pr-1 text-[11.5px] text-brand-800 transition-colors hover:border-danger-600/40 hover:bg-danger-50 hover:text-danger-700"
                >
                  {p.name}
                  <X className="h-3 w-3 opacity-50" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanRow({
  plan, checked, onToggle,
}: { plan: SelectablePlan; checked: boolean; onToggle: () => void }) {
  const derived = plan.priceLogic === "derived";
  const unavailable = derived || !plan.active;

  if (unavailable) {
    /*
     * Shown and not selectable — §5.3 rules 3 and 4. A derived plan says what it follows, so the
     * hotel can see what the change will cascade to; an inactive one says it is switched off, which
     * is why it is not in the count.
     */
    return (
      <li className="flex items-center gap-2 rounded-md px-1 py-1 text-[12.5px] text-ink-300">
        <span aria-hidden className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-dashed border-surface-border" />
        <span className="min-w-0 truncate">{plan.name}</span>
        {plan.code && <span className="shrink-0 text-[10.5px]">{plan.code}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-1 text-[10.5px] uppercase tracking-wide">
          {derived ? (
            <>
              <Link2 className="h-3 w-3" /> follows {plan.parentName ?? "its parent"}
            </>
          ) : (
            "inactive"
          )}
        </span>
      </li>
    );
  }

  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[12.5px] hover:bg-surface-muted">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-3.5 w-3.5 shrink-0 rounded border-surface-border text-brand-600"
        />
        {/* ⚠️ The PLAN's name is the label. Never a list of room types — that was BUG-022. */}
        <span className="min-w-0 truncate font-medium text-ink-800">{plan.name}</span>
        {plan.code && <span className="shrink-0 text-[10.5px] text-ink-400">{plan.code}</span>}
        {/*
          No "MANUAL" badge. Every row you can tick is manual by definition — the derived and
          inactive ones are greyed and say what they are — so it appeared on every single line,
          carried nothing, and competed with the two badges in this column that DO mean something.
        */}
      </label>
    </li>
  );
}
