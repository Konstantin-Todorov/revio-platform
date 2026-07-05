"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BedDouble, Sparkles, Receipt, Wine, Wrench, Settings, X, type LucideIcon,
} from "lucide-react";
import { Logo } from "./Logo";
import { useShell } from "./ShellContext";

type Item = { href: string; label: string; icon: LucideIcon; soon?: string };

// Phase 1 ships Units & Housekeeping; later phases light up the rest of the sitemap
// (docs/PMS-REFERENCE.md "MVP build order"). "soon" items render disabled with their phase tag.
const SECTIONS: { title?: string; items: Item[] }[] = [
  { items: [
    { href: "/dashboard", label: "Front Desk", icon: LayoutDashboard },
    { href: "/rooms", label: "Rooms", icon: BedDouble },
    { href: "/housekeeping", label: "Housekeeping", icon: Sparkles },
    { href: "/folios", label: "Folios & Billing", icon: Receipt },
    { href: "/minibar", label: "Minibar / POS", icon: Wine },
  ] },
  { title: "Coming next", items: [
    { href: "/maintenance", label: "Maintenance", icon: Wrench, soon: "P5" },
    { href: "/settings", label: "Settings", icon: Settings, soon: "P5" },
  ] },
];

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
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-[248px] shrink-0 transform flex-col bg-gradient-to-b from-brand-900 to-brand-800 text-white/90 transition-transform duration-200 lg:static lg:translate-x-0 lg:transition-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="flex items-center gap-2.5 px-5 py-[18px]">
        <Logo className="h-8 w-8" />
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-tight text-white">
            Revio<span className="text-accent-500">PMS</span>
          </div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">
            Operations
          </div>
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

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {SECTIONS.map((section, i) => (
          <div key={i} className="mb-1">
            {section.title && (
              <div className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.13em] text-white/35">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              if (item.soon) {
                return (
                  <div
                    key={item.href}
                    className="mb-0.5 flex cursor-default items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium text-white/30"
                    title={`${item.label} arrives in phase ${item.soon.slice(1)}`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                    <span className="flex-1">{item.label}</span>
                    <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/40">
                      {item.soon}
                    </span>
                  </div>
                );
              }
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`group relative mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors duration-150 ${
                    active ? "bg-white/[0.13] text-white" : "text-white/70 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-accent-500" />
                  )}
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-white/40">
        RevioPMS · Phase 2 · Front Desk
      </div>
      </aside>
    </>
  );
}
