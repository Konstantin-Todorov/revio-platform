"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeSection, areaForPath, sectionsForPath } from "./navigation";
import { useShell } from "./ShellContext";

/**
 * Level 2: the sections inside the chosen area, as a vertical list.
 *
 * This is the founder's instruction taken literally — *"first a vertical menu, and then if needed,
 * add horizontal inside one of them"* — and it is the shape Settings already had here, which is why
 * it is the one that felt right. Settings now uses THIS panel instead of its own `SettingsNav`, so
 * the console has one vertical menu rather than two doing the same job.
 *
 * ## Why vertical wins at this level
 *
 * A vertical list scales and a tab row does not. Operations has five sections and Settings four; as
 * horizontal tabs they compete with whatever tabs the page itself has, and the reader has to work
 * out which row means what. Down the side there is no competition, there is room for a line of
 * explanation, and adding a seventh section changes nothing about the layout.
 *
 * ## Nothing at all for an area with one screen
 *
 * Overview and Support render no panel and open full width. A list of one item is furniture that
 * takes a column of the window to say nothing — and a panel that appears and disappears with a
 * single item in it is exactly the sort of moving furniture that made the old console feel untidy.
 */
export function SectionPanel() {
  const pathname = usePathname();
  const sections = sectionsForPath(pathname);
  const { setOpen } = useShell();
  if (sections.length === 0) return null;

  const area = areaForPath(pathname);
  const active = activeSection(pathname, sections);

  return (
    <div className="flex h-full w-[232px] shrink-0 flex-col border-r border-surface-border bg-white">
      <div className="px-4 pb-2 pt-[18px]">
        <h2 className="text-[15px] font-bold tracking-tight text-ink-900">{area?.label}</h2>
      </div>

      <nav aria-label={`${area?.label ?? "Section"} sections`} className="flex-1 overflow-y-auto px-2 pb-4">
        {sections.map((s) => {
          const isActive = active === s.href;
          return (
            <Link
              key={s.href}
              href={s.href}
              onClick={() => setOpen(false)}
              aria-current={isActive ? "page" : undefined}
              className={`mb-0.5 block rounded-lg px-3 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-600/40 ${
                isActive ? "bg-brand-50" : "hover:bg-surface-muted"
              }`}
            >
              <span className={`block text-[13px] font-semibold ${isActive ? "text-brand-800" : "text-ink-700"}`}>
                {s.label}
              </span>
              {/*
                * The one-line explanation, shown only for the section you are ON.
                *
                * Showing it on every row turns the panel into a wall of text you have to read past,
                * which is the problem the icon rail just solved one level up. Showing it on the
                * active row confirms where you are without asking anything of the eye.
                */}
              {s.blurb && isActive && (
                <span className="mt-0.5 block text-[11px] leading-snug text-ink-400">{s.blurb}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
