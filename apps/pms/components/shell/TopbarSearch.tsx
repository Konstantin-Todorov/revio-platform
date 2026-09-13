"use client";

import { useRouter } from "next/navigation";
import { CommandPalette } from "@revio/ui/command-palette";
import { searchEverything } from "@/lib/actions-search";

/**
 * Global search — now a ⌘K palette, in exactly the slot the old form occupied.
 *
 * ⚠️ **The position is unchanged, deliberately.** The founder's instruction was to improve this
 * "without changing its position, staying right there where it is". People already know where the
 * box is; moving it would spend that for nothing.
 *
 * The form posted to `/search` and made you wait for a page to find one known thing — at a front
 * desk with somebody standing in front of you. Now results arrive as you type and Enter opens the
 * first one. `/search` is still there and Enter on nothing still goes to it.
 *
 * Unlike RevioLink and RevioCRS there is no screen this hides on: RevioPMS's calendar is narrower
 * than a year-wide ARI grid, and the front desk is exactly where the fast path is worth most.
 */
export function TopbarSearch() {
  const router = useRouter();
  return (
    <div className="flex flex-1 justify-start">
      <CommandPalette
        search={searchEverything}
        placeholder="Search rooms, guests, reservations…"
        seeAllHref={(q) => `/search?q=${encodeURIComponent(q)}`}
        onNavigate={(href) => router.push(href)}
      />
    </div>
  );
}
