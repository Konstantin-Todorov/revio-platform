"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarRange, Wrench, CalendarCheck, Tags, BarChart3,
  Share2, Users, Settings, Globe, X, type LucideIcon, History,
} from "lucide-react";
import { Logo } from "./Logo";
import { useShell } from "./ShellContext";

type Item = { href: string; label: string; icon: LucideIcon; soon?: string };

// Phase 1 ships the inventory foundation; later phases light up the rest of the sitemap
// (docs/CRS-REFERENCE.md "MVP build order"). "soon" items render disabled with their phase tag.
// V2 nav (docs/specs/CRS-GUIDE-V1.md §2): screens sorted by mode — overview / bookings /
// commercial control / configuration. Rates & Restrictions dissolved three ways (products →
// Rooms & Rates; standing defaults → Settings; rules → Bulk); Inventory Setup merged away.
const SECTIONS: { title?: string; items: Item[] }[] = [
  { title: "Overview", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/reports", label: "Analytics", icon: BarChart3 },
  ] },
  { title: "Bookings", items: [
    { href: "/reservations", label: "Reservations", icon: CalendarCheck },
    { href: "/guests", label: "Guests", icon: Users },
  ] },
  { title: "Inventory & Rates", items: [
    { href: "/inventory", label: "Inventory Calendar", icon: CalendarRange },
    { href: "/rooms-rates", label: "Rooms & Rates", icon: Tags },
    { href: "/bulk", label: "Bulk Rates & Availability", icon: Wrench },
  ] },
  { title: "Configuration", items: [
    { href: "/distribution", label: "Distribution", icon: Share2 },
    // The direct channel gets its own screen next to the OTA one — it is a sales channel the hotel
    // configures, not a preference buried in Settings.
    { href: "/booking-engine", label: "Booking Engine", icon: Globe },
    { href: "/settings", label: "Settings", icon: Settings },
    // One history per property, whichever product wrote the row — a CRS-only client would
    // otherwise have no way to see any of it.
    { href: "/activity", label: "Activity", icon: History },
  ] },
];

export function Sidebar({ footer }: { footer: string }) {
  const pathname = usePathname();
  const { open, setOpen } = useShell();
  return (
    <>
      {/* Backdrop — mobile only, closes the drawer on tap */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-30 bg-brand-900/50 backdrop-blur-sm transition-opacity duration-enter ease-out lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-[248px] transform flex-col border-r border-white/[0.06] bg-gradient-to-b from-brand-900 to-brand-800 text-white/90 transition-transform duration-enter ease-out lg:translate-x-0 lg:transition-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="flex items-center gap-2.5 px-5 py-[18px]">
        <Logo className="h-8 w-8" />
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-tight text-white">
            Revio<span className="text-product-mark">CRS</span>
          </div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">
            Central Reservations
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-white/60 outline-none transition-[background-color,color,transform] duration-fast ease-standard hover:scale-105 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-product-mark/70 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {SECTIONS.map((section, i) => (
          <div key={i} className="mb-1">
            {section.title && (
              <div className="px-3 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
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
                    title={`${item.label} arrives in ${item.soon}`}
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
                  aria-current={active ? "page" : undefined}
                  /*
                   * Transitions colour AND transform AND background together (motion rule 1) — a
                   * `transition-colors` link changes hue and nothing else, which is what made the
                   * whole nav feel like a static list rather than something you are operating.
                   * The focus ring is rule 2: there were two on the entire platform.
                   */
                  className={`group relative mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium outline-none transition-[background-color,color,transform] duration-base ease-standard focus-visible:ring-2 focus-visible:ring-product-mark/70 ${
                    active
                      ? "bg-product-mark/[0.14] text-white"
                      : "text-white/70 hover:translate-x-0.5 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  {/*
                   * The rail is always rendered and scales in, rather than being mounted only when
                   * active. Mounting it on activation means it pops into existence at full size on
                   * every navigation; scaling from 0 lets it grow out of the edge it belongs to.
                   * `origin-center` with scale-y keeps it centred while it grows.
                   */}
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
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* The account this session belongs to — useful for a group, and never build metadata. */}
      <div className="truncate border-t border-white/10 px-5 py-3 text-[11px] text-white/40">{footer}</div>
      </aside>
    </>
  );
}
