"use client";

import { useEffect, useState } from "react";

/**
 * On a phone: the room you are looking at, its price and "Select", always under your thumb.
 *
 * A room card on a phone is taller than the screen — photo, facts, rates — so the button that books
 * it scrolls away while the guest is still reading about the room. Booking.com and Airbnb keep the
 * price and the action pinned for exactly this reason.
 *
 * It follows the card most in view (`data-room-card`), and steps out of the way whenever that card's
 * own best-rate row is on screen (`data-best-rate`) — two identical buttons in view is noise. Desktop
 * never sees it: there the card's button is always reachable.
 */
type Current = { name: string; total: string; href: string };

export function StickyRoomBar({ selectLabel, totalLabel }: { selectLabel: string; totalLabel: string }) {
  const [current, setCurrent] = useState<Current | null>(null);
  const [ownButtonVisible, setOwnButtonVisible] = useState(true);

  useEffect(() => {
    const cards = [...document.querySelectorAll<HTMLElement>("[data-room-card]")];
    if (cards.length === 0) return;
    const ratio = new Map<Element, number>();
    const bestVisible = new Map<Element, boolean>();
    let active: HTMLElement | null = null;

    const recompute = () => {
      let top: HTMLElement | null = null;
      let best = 0;
      for (const c of cards) {
        const r = ratio.get(c) ?? 0;
        if (r > best) { best = r; top = c; }
      }
      active = best > 0.05 ? top : null;
      if (!active) { setCurrent(null); return; }
      setCurrent({
        name: active.dataset.roomName ?? "",
        total: active.dataset.roomTotal ?? "",
        href: active.dataset.roomHref ?? "",
      });
      const bestRow = active.querySelector("[data-best-rate]");
      setOwnButtonVisible(bestRow ? bestVisible.get(bestRow) ?? false : false);
    };

    const cardObs = new IntersectionObserver((entries) => {
      // Visible height, not ratio: a card with its rates opened is taller than the screen, and its
      // ratio stays small even while it is the only thing the guest can see.
      for (const e of entries) ratio.set(e.target, e.intersectionRect.height / window.innerHeight);
      recompute();
    }, { threshold: [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] });
    const rowObs = new IntersectionObserver((entries) => {
      // Mostly on screen, not merely touching the edge — a sliver of the row is not a reachable button.
      for (const e of entries) bestVisible.set(e.target, e.intersectionRatio >= 0.6);
      recompute();
    }, { threshold: [0, 0.6, 1] });

    for (const c of cards) {
      cardObs.observe(c);
      const row = c.querySelector("[data-best-rate]");
      if (row) rowObs.observe(row);
    }
    return () => { cardObs.disconnect(); rowObs.disconnect(); };
  }, []);

  const show = current && !ownButtonVisible;
  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-40 border-t px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 transition-transform duration-200 sm:hidden ${show ? "translate-y-0" : "pointer-events-none translate-y-full"}`}
      style={{ backgroundColor: "hsl(var(--surface))", borderColor: "hsl(var(--line))", boxShadow: "0 -6px 20px hsl(var(--ink) / 0.08)" }}
    >
      {current && (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">{current.name}</div>
            <div className="nums text-[15px] font-bold">
              {current.total} <span className="text-[12px] font-normal" style={{ color: "hsl(var(--ink-faint))" }}>{totalLabel}</span>
            </div>
          </div>
          <a href={current.href} tabIndex={show ? 0 : -1} className="btn btn-brand shrink-0 px-6">{selectLabel}</a>
        </div>
      )}
    </div>
  );
}
