"use client";

import { useRouter } from "next/navigation";
import { CommandPalette } from "@revio/ui/command-palette";
import { searchEverything } from "@/lib/actions-search";

/**
 * Global search — now a ⌘K palette, in exactly the slot the old form occupied.
 *
 * ⚠️ **The position is unchanged, deliberately.** The founder's instruction was to improve this
 * "without changing its position, staying right there where it is".
 *
 * This is the one palette that crosses tenants — see `lib/actions-search.ts` for why that is correct
 * here and nowhere else, and for the rule that keeps demo hotels findable but badged.
 */
export function TopbarSearch() {
  const router = useRouter();
  return (
    <div className="flex flex-1 justify-start">
      <CommandPalette
        search={searchEverything}
        placeholder="Search clients, hotels, people, invoices…"
        seeAllHref={(q) => `/search?q=${encodeURIComponent(q)}`}
        onNavigate={(href) => router.push(href)}
      />
    </div>
  );
}
