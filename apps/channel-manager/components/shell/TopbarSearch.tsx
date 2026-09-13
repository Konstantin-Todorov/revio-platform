"use client";

import { usePathname, useRouter } from "next/navigation";
import { CommandPalette } from "@revio/ui/command-palette";
import { searchEverything } from "@/lib/actions-search";

/**
 * Global search — now a ⌘K palette, in exactly the slot the old form occupied.
 *
 * ⚠️ **The position is unchanged, deliberately.** The founder's instruction was to improve this
 * "without changing its position, staying right there where it is" — people already know where the
 * box is, and moving it would spend that for nothing.
 *
 * What changed is behind it: the form posted to `/search` and made you wait for a page to find one
 * known thing. Now results arrive as you type and Enter opens the first one. `/search` is still
 * there and Enter on nothing still goes to it — it remains the right screen for "show me
 * everything", and the palette is the fast path to one thing.
 *
 * Still hidden on the Calendar (spec §2.4), because the grid needs the width.
 */
export function TopbarSearch() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname?.startsWith("/calendar")) return <div className="hidden flex-1 md:block" aria-hidden />;

  return (
    <div className="flex flex-1 justify-start">
      <CommandPalette
        search={searchEverything}
        placeholder="Search rooms, rates, channels, reservations…"
        seeAllHref={(q) => `/search?q=${encodeURIComponent(q)}`}
        onNavigate={(href) => router.push(href)}
      />
    </div>
  );
}
