"use client";

import { useEffect, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

/**
 * Collapse/expand every room-type section at once (spec §3.2): ONE toggle whose label reflects
 * the current state. Works on the native <details> elements, so per-room collapse keeps working
 * independently after a global toggle. The chosen state persists per user (localStorage) because
 * this screen stays open all day and the layout should survive a reload.
 */
const STORE_KEY = "cm-calendar-collapsed";

export function CollapseAll({ containerId }: { containerId: string }) {
  const [collapsed, setCollapsed] = useState(false);

  const apply = (c: boolean) => {
    document.querySelectorAll<HTMLDetailsElement>(`#${containerId} > details`).forEach((d) => {
      d.open = !c;
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORE_KEY) === "1";
    if (saved) apply(true);
    setCollapsed(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const next = !collapsed;
    apply(next);
    setCollapsed(next);
    localStorage.setItem(STORE_KEY, next ? "1" : "0");
  };

  const Icon = collapsed ? ChevronsUpDown : ChevronsDownUp;
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted"
    >
      <Icon className="h-3.5 w-3.5" />
      {collapsed ? "Expand all" : "Collapse all"}
    </button>
  );
}
