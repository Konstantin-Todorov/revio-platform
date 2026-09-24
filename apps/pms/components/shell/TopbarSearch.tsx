"use client";

import { useRouter } from "next/navigation";
import { CommandPalette } from "@revio/ui/command-palette";
import { searchEverything } from "@/lib/actions-search";
import { setActiveProperty } from "@/lib/actions-session";

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
export function TopbarSearch({ activePropertyId, placeholder = "Search rooms, guests, reservations…" }: { activePropertyId: string; placeholder?: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-1 justify-start">
      <CommandPalette
        search={searchEverything}
        placeholder={placeholder}
        seeAllHref={(q) => `/search?q=${encodeURIComponent(q)}`}
        onNavigate={async (href, hit) => {
          /* ⚠️ A record in another of the account's hotels needs the workspace switched first, or
             the screen it links to cannot open it — every one of them is scoped to the ACTIVE
             property. Search deliberately reaches them all, so without this a hit from a sister
             hotel landed on "We couldn't find that" for a booking, and on an empty list everywhere
             else: the next screen denying what the search had just proved exists.

             Switching without asking is right HERE and would not be elsewhere: the row carries the
             hotel's name as a badge, so clicking it is a choice to go there, and the workspace
             switcher in this same bar shows where you have arrived. */
          if (hit?.propertyId && hit.propertyId !== activePropertyId) {
            await setActiveProperty(hit.propertyId);
          }
          router.push(href);
        }}
      />
    </div>
  );
}
