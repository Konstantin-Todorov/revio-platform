"use client";

import { X } from "lucide-react";
import { AreaRail } from "./AreaRail";
import { MobileNav } from "./MobileNav";
import { SectionPanel } from "./SectionPanel";
import { useShell } from "./ShellContext";

/**
 * The console's chrome: the icon rail, and the section panel beside it when there is one.
 *
 * This component owns only the *frame* — the fixed positioning, the mobile drawer and its backdrop.
 * What is in it lives in `AreaRail` (level 1) and `SectionPanel` (level 2), and what belongs where
 * is decided once in `navigation.ts`.
 *
 * ## The width changes with the area, and that is the point
 *
 * Overview and Support have no sections, so no panel is drawn and the page opens across the whole
 * window. Operations has five, so the panel is there. The content offset follows in
 * `(protected)/layout.tsx` — one `ShellFrame` reads the same `navigation.ts`, so the gap and the
 * panel cannot disagree about how wide the chrome is.
 *
 * On a phone the whole thing is one drawer: rail and panel together at 300px, which fits, and
 * choosing anything closes it.
 */
export function Sidebar() {
  const { open, setOpen } = useShell();

  return (
    <>
      {/* Backdrop — mobile only, closes the drawer on tap */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-30 bg-brand-900/50 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen transform transition-transform duration-200 lg:translate-x-0 lg:transition-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Two levels side by side, which is what the width is for. */}
        <div className="hidden h-full lg:flex">
          <AreaRail />
          <SectionPanel />
        </div>

        {/* One labelled list, which is what a phone is for. Same routes, same order, same names. */}
        <div className="h-full lg:hidden">
          <MobileNav />
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="absolute right-2 top-3.5 flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </aside>
    </>
  );
}
