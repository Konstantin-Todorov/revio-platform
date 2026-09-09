"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Logo } from "./Logo";
import { useShell } from "./ShellContext";
import { OPERATOR_AREAS, areaForPath } from "./navigation";

/**
 * Seven areas, and not one screen name among them.
 *
 * The whole point of the change: a menu that lists every screen makes you read fourteen things to
 * find one, and a menu that lists seven *questions* makes you read the one you came with. The
 * screens have not gone anywhere — choosing an area reveals them as a tab row (`AreaTabs`), which is
 * the same underline pattern already used inside a client.
 *
 * The model lives in `navigation.ts` so the sidebar and the tab row cannot disagree about what
 * belongs where, and so the grouping can be argued with in one place.
 */
export function Sidebar() {
  const pathname = usePathname();
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
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-[248px] transform flex-col bg-brand-900 text-white/90 transition-transform duration-200 lg:translate-x-0 lg:transition-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="flex items-center gap-2.5 px-5 py-[18px]">
        <Logo className="h-8 w-8" />
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-tight text-white">Revio</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Operator</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav aria-label="Operator areas" className="flex-1 overflow-y-auto px-3 py-2">
        {(() => {
          const current = areaForPath(pathname);
          return OPERATOR_AREAS.map((area) => {
              // The area is active for every screen inside it, so drilling into `/clients/abc` or
              // `/integrations/stripe` never leaves the menu looking as though you are nowhere.
              const active = current?.key === area.key;
              const Icon = area.icon;
              return (
                <Link
                  key={area.key}
                  // An area is not a page: it opens at its first screen. Ordering inside
                  // `navigation.ts` is therefore a real decision — Plans before Billing, health
                  // before faults — because the first screen is what the area *means*.
                  href={area.screens[0]!.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`group relative mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium outline-none transition-[background-color,color,transform] duration-base ease-standard focus-visible:ring-2 focus-visible:ring-product-mark/70 ${
                    active ? "bg-product-mark/[0.14] text-white" : "text-white/65 hover:translate-x-0.5 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 origin-center rounded-r bg-product-mark transition-transform duration-base ease-out ${
                      active ? "scale-y-100" : "scale-y-0"
                    }`}
                  />
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 transition-colors duration-fast ease-standard ${
                      active ? "text-product-mark" : "text-white/55 group-hover:text-white/85"
                    }`}
                    strokeWidth={2}
                  />
                  <span className="flex-1">{area.label}</span>
                </Link>
              );
          });
        })()}
      </nav>

      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-white/40">All hotels · super-admin</div>
      </aside>
    </>
  );
}
