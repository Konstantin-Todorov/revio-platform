"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A table row that opens its record wherever it is clicked — the way every admin list the team has
 * used behaves (founder, 2026-09-28: "let the whole row open it, not only the title").
 *
 * The client's name stays a real link inside the row, so keyboard, screen-reader and middle-click
 * users keep a proper link; this only widens the mouse target. A click on anything interactive
 * inside the row, or a text selection, is left alone.
 */
export function RowLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <tr
      className={`cursor-pointer ${className ?? ""}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button,input,select,textarea,label")) return;
        if (window.getSelection()?.toString()) return;
        if (e.metaKey || e.ctrlKey) { window.open(href, "_blank"); return; }
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
