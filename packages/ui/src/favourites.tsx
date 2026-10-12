"use client";

import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";

/**
 * Favourites and collapsed groups in a sidebar, remembered per device.
 *
 * Per device and not per account on purpose: the front-desk PC and the manager's phone want different
 * shortcuts even when the same person signs in to both, and nothing about this needs to reach the
 * server. Storage can be empty or blocked (private window); everything still renders, just unpinned.
 */
function read(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(key: string, value: string[]) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: stays in memory */ }
}

function useStoredList(key: string) {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => setList(read(key)), [key]);
  const toggle = useCallback((id: string) => {
    setList((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      write(key, next);
      return next;
    });
  }, [key]);
  return [list, toggle] as const;
}

/** `product` keeps RevioPMS's favourites out of RevioCRS on a device that runs both. */
export function useFavourites(product: string) {
  return useStoredList(`revio:fav:${product}`);
}

export function useCollapsedGroups(product: string) {
  return useStoredList(`revio:collapsed:${product}`);
}

/** The star beside a sidebar row. A separate button, so starring never also navigates. */
export function FavouriteStar({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-opacity hover:bg-white/10 focus-visible:opacity-100 ${
        on ? "text-warning-500 opacity-100" : "text-white/45 opacity-0 group-hover/row:opacity-100 max-lg:opacity-60"
      }`}
    >
      <Star className="h-4 w-4" fill={on ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
