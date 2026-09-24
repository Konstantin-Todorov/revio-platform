"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";

type Rect = { left: number; top: number; right: number; bottom: number };

/**
 * A list you reorder by dragging — the one way to change an order anywhere in the platform.
 *
 * The founder, 2026-09-25: *"навсякъде където сложихме смяна на позициите да не е нагоре надолу а да е
 * с драг и дроп"*. Up/down arrows move a thing one place per click; putting the fifth floor first was
 * four clicks and four page refreshes. Dragging is the shape everybody already knows from their phone.
 *
 * - **Pointer events, not the HTML5 drag API**, because the HTML5 API does nothing on a touchscreen
 *   and a housekeeper's supervisor reorders floors on a phone.
 * - **The row you hold stays under your finger** and the others glide out of its way, so where it
 *   will land is visible before you let go (rule 2 of `docs/UI-STANDARD.md`: say it before it is
 *   read). The first version snapped the held row from slot to slot and felt like it was jumping —
 *   the founder's "не работи окей и смуут" (2026-09-25).
 * - **Slots, not rows, decide where it lands.** The places are measured once when the drag starts,
 *   and the pointer is matched against those; matching against rows that are themselves moving made
 *   the order flicker back and forth at a boundary.
 * - **The handle is a real button.** Focus it and press ↑/↓ (and ←/→ in a grid) to move the row a
 *   place — reorderable without a mouse, which the old arrow buttons were and this must stay.
 * - **One save per drag**, with the whole new order, when the pointer is released.
 */
export function SortableList<T extends { id: string }>({
  items,
  render,
  onReorder,
  handleLabel,
  className = "",
  itemClassName,
  layout = "list",
}: {
  items: T[];
  /** `index` is the row's place in the order as it stands now — mid-drag included. */
  render: (item: T, handle: ReactNode, index: number) => ReactNode;
  /** Called once, with every id in its new order, when a drag or a keypress ends in a change. */
  onReorder: (ids: string[]) => void | Promise<void>;
  /** "Drag to reorder {name}" — filled per row by the caller's `render` label. */
  handleLabel: (item: T) => string;
  className?: string;
  /** Classes for the slot at `index` — a gallery makes its first slot (the cover) larger. */
  itemClassName?: (index: number) => string;
  /**
   * `grid` for tiles that wrap — a photo gallery. The slot under the pointer is found in both
   * directions, and ←/→ move a tile as well as ↑/↓.
   */
  layout?: "list" | "grid";
}) {
  const [order, setOrder] = useState(items.map((i) => i.id));
  const [dragging, setDragging] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  const start = useRef<string[]>([]);
  // The order as of the last render, readable from the pointer handlers without a state updater
  // (an updater must stay pure — React may run it twice).
  const current = useRef(order);
  current.current = order;

  const drag = useRef<{ id: string; grabX: number; grabY: number; x: number; y: number; slots: Rect[] } | null>(null);
  /** Where every row was ON SCREEN just before the order changed — the "first" of FLIP. */
  const before = useRef<Map<string, DOMRect> | null>(null);

  // A server refresh brings a new list; take it unless a drag is in progress.
  const key = items.map((i) => i.id).join("|");
  useEffect(() => {
    if (!dragging) setOrder(items.map((i) => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the list's identity
  }, [key]);

  const byId = new Map(items.map((i) => [i.id, i]));

  /** Keep the held row under the pointer, wherever its slot now is. */
  function followPointer() {
    const d = drag.current;
    const el = d && rows.current.get(d.id);
    if (!d || !el) return;
    el.style.transition = "none";
    el.style.transform = "";
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${d.x - d.grabX - r.left}px, ${d.y - d.grabY - r.top}px) scale(1.02)`;
  }

  /** Slide every other row from where it was to where it now is. */
  useLayoutEffect(() => {
    const first = before.current;
    before.current = null;
    if (first) {
      for (const [id, el] of rows.current) {
        if (id === drag.current?.id) continue;
        const was = first.get(id);
        if (!was) continue;
        el.style.transition = "none";
        el.style.transform = "";
        const now = el.getBoundingClientRect();
        const dx = was.left - now.left;
        const dy = was.top - now.top;
        if (dx === 0 && dy === 0) continue;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        void el.offsetWidth; // commit the inverted position before animating out of it
        el.style.transition = "transform 180ms cubic-bezier(0.2, 0, 0, 1)";
        el.style.transform = "";
      }
    }
    followPointer();
  }, [order]);

  function snapshot() {
    const m = new Map<string, DOMRect>();
    for (const [id, el] of rows.current) m.set(id, el.getBoundingClientRect());
    before.current = m;
  }

  function slotAt(px: number, py: number, slots: Rect[]): number | null {
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]!;
      const inY = py >= s.top && py <= s.bottom;
      const inX = layout === "list" || (px >= s.left && px <= s.right);
      if (inX && inY) return i;
    }
    // Above the first slot or below the last: the ends of the list.
    if (slots.length > 0 && py < slots[0]!.top) return 0;
    if (slots.length > 0 && py > Math.max(...slots.map((s) => s.bottom))) return slots.length - 1;
    return null;
  }

  function onPointerDown(id: string, e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    const el = rows.current.get(id);
    if (!el) return;
    e.preventDefault();
    const box = el.getBoundingClientRect();
    const sx = window.scrollX;
    const sy = window.scrollY;
    // Slots in PAGE coordinates, so a wheel scroll mid-drag does not shift where things land.
    const slots = order.map((oid) => {
      const r = rows.current.get(oid)!.getBoundingClientRect();
      return { left: r.left + sx, top: r.top + sy, right: r.right + sx, bottom: r.bottom + sy };
    });
    drag.current = { id, grabX: e.clientX - box.left, grabY: e.clientY - box.top, x: e.clientX, y: e.clientY, slots };
    start.current = order;
    setDragging(id);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      d.x = ev.clientX;
      d.y = ev.clientY;
      // Near the edge of the screen, scroll — a long floor list on a phone does not fit.
      if (ev.clientY < 60) window.scrollBy(0, -12);
      else if (ev.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
      const to = slotAt(ev.clientX + window.scrollX, ev.clientY + window.scrollY, d.slots);
      const now = current.current;
      const from = now.indexOf(d.id);
      if (to !== null && to !== from) {
        const next = now.filter((x) => x !== d.id);
        next.splice(to, 0, d.id);
        snapshot();
        setOrder(next);
      } else {
        followPointer();
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      const held = rows.current.get(id);
      drag.current = null;
      if (held) {
        // Settle into its slot rather than teleporting there.
        held.style.transition = "transform 180ms cubic-bezier(0.2, 0, 0, 1)";
        held.style.transform = "";
      }
      setDragging(null);
      const next = current.current;
      if (next.join("|") !== start.current.join("|")) void onReorder(next);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function onKey(id: string, e: React.KeyboardEvent<HTMLButtonElement>) {
    const back = e.key === "ArrowUp" || (layout === "grid" && e.key === "ArrowLeft");
    const forward = e.key === "ArrowDown" || (layout === "grid" && e.key === "ArrowRight");
    if (!back && !forward) return;
    e.preventDefault();
    const i = order.indexOf(id);
    const j = i + (back ? -1 : 1);
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    snapshot();
    setOrder(next);
    void onReorder(next);
    // Keep focus on the handle that moved, so a second press keeps moving the same row.
    requestAnimationFrame(() => rows.current.get(id)?.querySelector<HTMLButtonElement>("[data-sort-handle]")?.focus());
  }

  return (
    <ul className={className}>
      {order.map((id, index) => {
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
            className="flex h-8 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-ink-400 transition-colors hover:bg-surface-muted hover:text-ink-700 focus-visible:text-ink-700 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        );
        return (
          <li
            key={id}
            ref={(el) => { if (el) rows.current.set(id, el); else rows.current.delete(id); }}
            className={`${itemClassName?.(index) ?? ""} ${dragging === id ? "relative z-20 rounded-lg bg-white shadow-pop ring-1 ring-brand-600/30" : "relative"}`}
          >
            {render(item, handle, index)}
          </li>
        );
      })}
    </ul>
  );
}
