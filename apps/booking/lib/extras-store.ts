"use client";

import { useSyncExternalStore } from "react";

/**
 * The running extras total, shared between the picker and the summary card.
 *
 * They sit in different columns of a server-rendered page — the summary carries the room photo and
 * is rendered on the server — so lifting state into a common parent would mean turning the whole
 * step into one client component and giving up that. A four-line external store is smaller than the
 * refactor and keeps exactly one number on the page.
 *
 * It is a **preview**, never the price. The server re-derives every amount from the hotel's own
 * catalogue when the form is submitted; this only exists so the total moves the instant a box is
 * ticked instead of after a round trip.
 *
 * Module scope is safe here because a page renders one stay at a time, and the value resets on
 * navigation with the module's own lifetime.
 */
let total = 0;
const listeners = new Set<() => void>();

export function setExtrasTotal(minor: number): void {
  if (minor === total) return;
  total = minor;
  for (const l of listeners) l();
}

export function useExtrasTotal(): number {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => total,
    // The server has no selection yet, so it renders the room-only total — which is also what a
    // guest sees before touching anything. No hydration mismatch, and no flash of a wrong number.
    () => 0,
  );
}
