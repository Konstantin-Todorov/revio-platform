"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tabsForPath } from "./navigation";

/**
 * The screens inside the area you are in.
 *
 * Deliberately the **same underline tabs already shipped on `/clients/[id]`** — same border weight,
 * same active colours, same type size. That pattern was built, reviewed and kept ("I like the tabs
 * you did"), so applying it one level up costs nothing to learn and cannot drift into a second
 * dialect of the same idea. `docs/UI-STANDARD.md` rule 3: one component per concept, and rule 1:
 * borrow the shape people already know.
 *
 * It renders nothing at all on an area with a single screen, and nothing on a detail page — see
 * `tabsForPath`. A tab row that is sometimes one item and sometimes absent would be furniture that
 * moves, and furniture that moves is what made the old console feel untidy.
 *
 * Horizontally scrollable, because Operations has five screens and a phone has none of the room for
 * them. The row scrolls; the page never does (`docs/UI-STANDARD.md`).
 */
export function AreaTabs() {
  const pathname = usePathname();
  const tabs = tabsForPath(pathname);
  if (tabs.length === 0) return null;

  return (
    <nav
      aria-label="Section"
      className="mb-4 -mx-4 overflow-x-auto border-b border-surface-border px-4 lg:-mx-6 lg:px-6"
    >
      <div className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors ${
                active ? "border-brand-700 text-brand-800" : "border-transparent text-ink-500 hover:text-ink-900"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
