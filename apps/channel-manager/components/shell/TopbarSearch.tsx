"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

/** Global search — hidden on the Calendar (spec §2.4: suppress the top search bar in calendar view). */
export function TopbarSearch() {
  const pathname = usePathname();
  if (pathname?.startsWith("/calendar")) return <div className="hidden flex-1 md:block" aria-hidden />;
  return (
    <form action="/search" method="GET" className="relative hidden flex-1 md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        type="text"
        name="q"
        placeholder="Search rooms, rates, channels, reservations…"
        aria-label="Search"
        className="h-9 w-full max-w-md rounded-md border border-surface-border bg-surface-muted pl-9 pr-3 text-[13px] text-ink-700 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600 focus:bg-white"
      />
    </form>
  );
}
