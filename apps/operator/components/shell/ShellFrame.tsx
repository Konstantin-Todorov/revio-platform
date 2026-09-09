"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { sectionsForPath } from "./navigation";

/**
 * The gap the chrome leaves for the page.
 *
 * It has to move, because the chrome is not always the same width: an area with sections shows the
 * panel (68 + 232), and one without shows only the rail (68). Overview and Support therefore open
 * across the whole window instead of beside an empty column.
 *
 * It reads `navigation.ts` — the same function `SectionPanel` uses to decide whether to render at
 * all — so the gap and the panel cannot disagree. Two constants would drift the first time a section
 * was added to an area that had none, and the symptom is a page sitting under its own menu.
 */
export function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hasPanel = sectionsForPath(pathname).length > 0;
  return (
    <div className={`flex min-h-screen min-w-0 flex-col ${hasPanel ? "lg:pl-[300px]" : "lg:pl-[68px]"}`}>
      {children}
    </div>
  );
}
