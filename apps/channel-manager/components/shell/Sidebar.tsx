"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, SlidersHorizontal, BedDouble, Ban, Radio,
  Link2, CalendarCheck, RefreshCw, TriangleAlert, ScrollText, Settings, X,
} from "lucide-react";
import { Logo } from "./Logo";
import { useShell } from "./ShellContext";

type Item = { href: string; label: string; icon: typeof LayoutDashboard; badge?: number; tone?: "danger" | "warning" };

const SECTIONS: { title?: string; items: Item[] }[] = [
  { items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/bulk-update", label: "Bulk Update", icon: SlidersHorizontal },
  ] },
  { title: "Distribution", items: [
    { href: "/rooms-rates", label: "Rooms & Rates", icon: BedDouble },
    { href: "/restrictions", label: "Restrictions", icon: Ban },
    { href: "/channels", label: "Channels", icon: Radio },
    { href: "/mapping", label: "Mapping", icon: Link2 },
    { href: "/reservations", label: "Reservations", icon: CalendarCheck },
  ] },
  { title: "Operations", items: [
    { href: "/sync", label: "Sync Center", icon: RefreshCw },
    { href: "/errors", label: "Error Center", icon: TriangleAlert, badge: 2, tone: "danger" },
    { href: "/audit", label: "Audit Log", icon: ScrollText },
    { href: "/settings", label: "Settings", icon: Settings },
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
            Revio<span className="text-warning-500">Link</span>
          </div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">
            Channel Manager
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
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
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
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-warning-500" />
                  )}
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      item.tone === "danger" ? "bg-danger-500 text-white" : "bg-warning-500 text-brand-900"
                    }`}>
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-white/40">
        Demo · mock connectivity
      </div>
      </aside>
    </>
  );
}
