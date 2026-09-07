"use client";

import { useEffect, useState } from "react";
import { isStaleDeploymentError, shouldAutoReload } from "@revio/core";

/**
 * Turns "the app changed underneath this tab" into a reload instead of an apology.
 *
 * Every error boundary in the platform asks this first. When it returns `true` the boundary must
 * render the stale message rather than its generic one, because the generic one is a false statement
 * — the product is not unavailable, this tab is out of date — and its Reload button calls `reset()`,
 * which re-renders the SAME stale bundle and fails again. A recovery button that cannot recover is
 * worse than no button.
 *
 * ## Why the reload is guarded rather than immediate
 *
 * A hard reload IS the fix, so doing it without asking is the kindest behaviour. But a reload on
 * every mount of a boundary that keeps throwing is an infinite loop, and an app that reloads forever
 * is far worse than one that shows a button. So the last attempt is remembered across the reload in
 * `sessionStorage` and repeated attempts inside a cooldown fall back to a manual button.
 *
 * If `sessionStorage` cannot be read at all — private mode, blocked site data — we deliberately do
 * **not** auto-reload. Without somewhere to remember the attempt there is nothing standing between
 * us and the loop, and the manual button still fixes it in one click.
 */

const KEY = "revio_stale_reload_at";

export function useStaleDeployment(error: unknown): { stale: boolean; reload: () => void } {
  const stale = isStaleDeploymentError(error);
  const [, setTried] = useState(false);

  useEffect(() => {
    if (!stale) return;
    let last: number | null = null;
    let canRemember = true;
    try {
      const raw = window.sessionStorage.getItem(KEY);
      last = raw == null ? null : Number(raw);
    } catch {
      canRemember = false;
    }
    // No memory means no loop protection. Show the button instead.
    if (!canRemember) return setTried(true);
    if (!shouldAutoReload(last, Date.now())) return setTried(true);
    try {
      window.sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      return setTried(true);
    }
    // A hard reload, never `reset()` — the point is to fetch the NEW bundle.
    window.location.reload();
  }, [stale]);

  return { stale, reload: () => window.location.reload() };
}
