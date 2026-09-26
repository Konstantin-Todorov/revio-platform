"use client";

import { Menu } from "lucide-react";
import { useShell } from "./ShellContext";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { shell } from "@/lib/i18n/shell";

/** Hamburger shown only below `lg`; opens the Sidebar drawer. */
export function MobileMenuButton() {
  const { toggle } = useShell();
  const t = translate(shell, useLocale());
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.menu.openMenu}
      className="flex h-9 w-9 items-center justify-center rounded-md text-ink-600 transition-colors hover:bg-surface-muted lg:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
