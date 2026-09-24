"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";

/**
 * A list you reorder by dragging — the one way to change an order anywhere in the platform.
 *
 * The founder, 2026-09-25: *"навсякъде където сложихме смяна на позициите да не е нагоре надолу а да е
 * с драг и дроп"*. Up/down arrows move a thing one place per click; putting the fifth floor first was
 * four clicks and four page refreshes. Dragging is the shape everybody already knows from their phone.
 *
 * - **Pointer events, not the HTML5 drag API**, because the HTML5 API does nothing on a touchscreen
 *   and a housekeeper's supervisor reorders floors on a phone.
 * - **The row moves as you drag**, so where it will land is visible before you let go (rule 2 of
 *   `docs/UI-STANDARD.md`: say it before it is read).
 * - **The handle is a real button.** Focus it and press ↑/↓ to move the row a place — the list is
 *   reorderable without a mouse, which the old arrow buttons were and this must stay.
 * - **One save per drag**, with the whole new order, when the pointer is released.
 */
export function SortableList<T extends { id: string }>({
  items,
  render,
  onReorder,
  handleLabel,
  className = "",
}: {
  items: T[];
  render: (item: T, handle: ReactNode) => ReactNode;
  /** Called once, with every id in its new order, when a drag or a keypress ends in a change. */
  onReorder: (ids: string[]) => void | Promise<void>;
  /** "Drag to reorder {name}" — filled per row by the caller's `render` label. */
  handleLabel: (item: T) => string;
  className?: string;
}) {
  const [order, setOrder] = useState(items.map((i) => i.id));
  const [dragging, setDragging] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  const start = useRef<string[]>([]);
  // The order as of the last render, readable from the pointer handlers without a state updater
  // (an updater must stay pure — React may run it twice).
  const current = useRef(order);
  current.current = order;

  // A server refresh brings a new list; take it unless a drag is in progress.
  const key = items.map((i) => i.id).join("|");
  useEffect(() => {
    if (!dragging) setOrder(items.map((i) => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the list's identity
  }, [key]);

  const byId = new Map(items.map((i) => [i.id, i]));

  function moveTo(id: string, clientY: number) {
    setOrder((now) => {
      const others = now.filter((x) => x !== id);
      let index = others.length;
      for (let i = 0; i < others.length; i++) {
        const el = rows.current.get(others[i]!);
        if (!el) continue;
        const box = el.getBoundingClientRect();
        if (clientY < box.top + box.height / 2) { index = i; break; }
      }
      const next = [...others.slice(0, index), id, ...others.slice(index)];
      return next.join("|") === now.join("|") ? now : next;
    });
  }

  function commit(next: string[]) {
    if (next.join("|") !== start.current.join("|")) void onReorder(next);
  }

  function onPointerDown(id: string, e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    start.current = order;
    setDragging(id);
    const move = (ev: PointerEvent) => moveTo(id, ev.clientY);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDragging(null);
      commit(current.current);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function onKey(id: string, e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const i = order.indexOf(id);
    const j = i + (e.key === "ArrowUp" ? -1 : 1);
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    start.current = order;
    setOrder(next);
    commit(next);
    // Keep focus on the handle that moved, so a second press keeps moving the same row.
    requestAnimationFrame(() => rows.current.get(id)?.querySelector<HTMLButtonElement>("[data-sort-handle]")?.focus());
  }

  return (
    <ul className={className}>
      {order.map((id) => {
        const item = byId.get(id);
        if (!item) return null;
        const handle = (
          <button
            type="button"
            data-sort-handle
            aria-label={handleLabel(item)}
            title={handleLabel(item)}
            onPointerDown={(e) => onPointerDown(id, e)}
            onKeyDown={(e) => onKey(id, e)}
            className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-ink-300 transition-colors hover:bg-surface-muted hover:text-ink-600 focus-visible:text-ink-700 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        );
        return (
          <li
            key={id}
            ref={(el) => { if (el) rows.current.set(id, el); else rows.current.delete(id); }}
            className={`transition-shadow ${dragging === id ? "relative z-10 bg-white shadow-pop ring-1 ring-brand-600/30" : ""}`}
          >
            {render(item, handle)}
          </li>
        );
      })}
    </ul>
  );
}
