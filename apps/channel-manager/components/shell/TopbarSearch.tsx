"use client";

import { usePathname, useRouter } from "next/navigation";
import { CommandPalette } from "@revio/ui/command-palette";
import { searchEverything } from "@/lib/actions-search";
import { setActiveProperty } from "@/lib/actions-session";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { shell } from "@/lib/i18n/shell";

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
export function TopbarSearch({ activePropertyId }: { activePropertyId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = translate(shell, useLocale());
  if (pathname?.startsWith("/calendar")) return <div className="hidden flex-1 md:block" aria-hidden />;

  return (
    <div className="flex flex-1 justify-start">
      <CommandPalette
        search={searchEverything}
        placeholder={t.search}
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
