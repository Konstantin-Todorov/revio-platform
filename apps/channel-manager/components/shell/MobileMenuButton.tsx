"use client";

import { Menu } from "lucide-react";
import { useShell } from "./ShellContext";

/** Hamburger shown only below `lg`; opens the Sidebar drawer. */
export function MobileMenuButton() {
  const { toggle } = useShell();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Open menu"
      className="flex h-9 w-9 items-center justify-center rounded-md text-ink-600 transition-colors hover:bg-surface-muted lg:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
