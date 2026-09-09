"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { OPERATOR_AREAS, areaForPath } from "./navigation";
import { useShell } from "./ShellContext";

/**
 * Level 1: the areas, as icons.
 *
 * Narrow on purpose. Six or seven icons is a thing you learn once and then hit by muscle memory,
 * which is what a top level is for — the fourteen labelled links it replaces had to be *read* every
 * time, and reading a menu is the tax this whole change exists to remove.
 *
 * Settings sits at the bottom, separated. It is the only one you open to change how the console
 * works rather than to do the day's work, and putting it in the run with the others made it the
 * fourteenth thing to read past.
 *
 * Every icon carries its label as a tooltip **and** as `aria-label` — an icon-only rail is
 * unusable with a screen reader otherwise, and unlearnable on the first day.
 */
export function AreaRail() {
  const pathname = usePathname();
  const current = areaForPath(pathname);
  const { setOpen } = useShell();

  const settings = OPERATOR_AREAS.filter((a) => a.key === "settings");
  const main = OPERATOR_AREAS.filter((a) => a.key !== "settings");

  const item = (area: (typeof OPERATOR_AREAS)[number]) => {
    const active = current?.key === area.key;
    const Icon = area.icon;
    return (
      <Link
        key={area.key}
        href={area.href}
        onClick={() => setOpen(false)}
        aria-label={area.label}
        aria-current={active ? "page" : undefined}
        title={area.label}
        className={`group relative flex h-11 w-11 items-center justify-center rounded-xl outline-none transition-colors duration-base ease-standard focus-visible:ring-2 focus-visible:ring-product-mark/70 ${
          active ? "bg-product-mark/[0.16] text-white" : "text-white/55 hover:bg-white/[0.08] hover:text-white"
        }`}
      >
        {/* The active rail, kept from the old sidebar — it is the one piece of this chrome people
            already read, and there was no reason to redraw it. */}
        <span
          aria-hidden="true"
          className={`absolute left-[-10px] top-1/2 h-5 w-[3px] -translate-y-1/2 origin-center rounded-r bg-product-mark transition-transform duration-base ease-out ${
            active ? "scale-y-100" : "scale-y-0"
          }`}
        />
        <Icon className={`h-[19px] w-[19px] ${active ? "text-product-mark" : ""}`} strokeWidth={2} />
        {/* A real tooltip rather than only `title`: the native one takes a second to appear, which
            is exactly long enough to make an icon rail feel like a guessing game on day one. */}
        <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-brand-900 px-2 py-1 text-[11.5px] font-semibold text-white shadow-float group-hover:block lg:block lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
          {area.label}
        </span>
      </Link>
    );
  };

  return (
    <div className="flex h-full w-[68px] shrink-0 flex-col items-center gap-1 border-r border-white/10 bg-brand-900 py-3">
      <Link href="/overview" onClick={() => setOpen(false)} aria-label="Revio Operator" className="mb-2 flex h-9 w-9 items-center justify-center">
        <Logo className="h-8 w-8" />
      </Link>
      {main.map(item)}
      <div className="mt-auto flex flex-col items-center gap-1 pt-2">{settings.map(item)}</div>
    </div>
  );
}
