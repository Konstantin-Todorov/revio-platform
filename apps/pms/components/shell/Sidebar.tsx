"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BedDouble, Sparkles, Receipt, Wine, Wrench, Moon, Users, UserCog, SlidersHorizontal, X, type LucideIcon, CalendarRange, BookUser,
} from "lucide-react";
import { Logo } from "./Logo";
import { useShell } from "./ShellContext";
import { navTail } from "@revio/ui/nav-tail";
import { roleAllowsPath } from "@/lib/roles";

type Item = { href: string; label: string; icon: LucideIcon; soon?: string };

// Nav regrouped to the roles that use each area (spec §2): Front Office (reception) · Rooms &
// Housekeeping · Setup (manager/admin) · End of Day. New tabs (Guests / User Management /
// Configuration) land as placeholders until their phase builds them (D4 / D8 / E7).
const SECTIONS: { title?: string; tail?: boolean; items: Item[] }[] = [
  { title: "Front office", items: [
    { href: "/dashboard", label: "Front Desk", icon: LayoutDashboard },
    // Between Front Desk and Guests on purpose: Front Desk is today as a list, the calendar is the
    // coming weeks as a grid. Same question, two time horizons.
    { href: "/calendar", label: "Calendar", icon: CalendarRange },
    { href: "/guests", label: "Guests", icon: Users },
    { href: "/folios", label: "Folios & Billing", icon: Receipt },
    // Beside Guests rather than under Setup: it is filled in at the desk, from a passport, while
    // somebody waits — not configured once by a manager.
    { href: "/register", label: "Guest Register", icon: BookUser },
    { href: "/minibar", label: "Extras & Charges", icon: Wine },
  ] },
  { title: "Rooms & housekeeping", items: [
    { href: "/housekeeping", label: "Housekeeping", icon: Sparkles },
    { href: "/rooms", label: "Rooms", icon: BedDouble },
    { href: "/maintenance", label: "Maintenance", icon: Wrench },
  ] },
  { title: "Setup", items: [
    { href: "/users", label: "Staff & Access", icon: UserCog },
    { href: "/configuration", label: "Configuration", icon: SlidersHorizontal },
  ] },
  { title: "End of day", items: [
    { href: "/closeday", label: "Close Day", icon: Moon },
  ] },
  /*
   * The shared tail — see `@revio/ui/nav-tail`.
   *
   * ⚠️ **This product had no link to `/settings` anywhere in its sidebar.** Settings exists here
   * (Property · Operations · Connections · Your account · Billing) and was reachable only from the
   * account dropdown, while "Configuration" — a different area entirely — sat in the main nav. So
   * a hotel looking for its billing details in RevioPMS could not find them from the menu at all.
   * Found on 2026-09-11 when the founder asked why the billing page showed nothing.
   *
   * Help and Activity moved out of "Setup" for the same reason they are in the tail everywhere
   * else: they are the software, not the hotel's work. Close Day stays above the rule because it
   * IS the hotel's work — a nightly operation somebody performs, not a preference.
   */
  {
    tail: true,
    items: navTail(["/activity", "/help", "/settings"]).map((t) => ({
      href: t.href,
      label: t.label,
      icon: t.Icon,
    })),
  },
];

export function Sidebar({ role, footer }: { role: string; footer: string }) {
  const pathname = usePathname();
  const { open, setOpen } = useShell();
  // Scoped roles (housekeeper, outlet/POS…) see only their allowed sections (spec §3.4 / §3.7).
  const sections = SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((i) => roleAllowsPath(role, i.href)) }))
    .filter((s) => s.items.length > 0);
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
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-[248px] transform flex-col bg-gradient-to-b from-brand-900 to-brand-800 text-white/90 transition-transform duration-200 lg:translate-x-0 lg:transition-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="flex items-center gap-2.5 px-5 py-[18px]">
        <Logo className="h-8 w-8" />
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-tight text-white">
            Revio<span className="text-product-mark">PMS</span>
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

      {/*
        `flex-col` so the tail can be pushed to the bottom with `mt-auto` — Activity · Help ·
        Settings sit at the foot of the sidebar in all three products, which is what makes Settings
        the same target everywhere without anybody reading the label.
      */}
      <nav className="flex flex-1 flex-col overflow-y-auto px-3 pb-4">
        {sections.map((section, i) => (
          <div key={i} className={section.tail ? "mb-1 mt-auto border-t border-white/10 pt-2" : "mb-1"}>
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
                    title={`${item.label} — arrives in phase ${item.soon}`}
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
                  className={`group relative mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium outline-none transition-[background-color,color,transform] duration-base ease-standard focus-visible:ring-2 focus-visible:ring-product-mark/70 ${
                    active ? "bg-product-mark/[0.14] text-white" : "text-white/70 hover:translate-x-0.5 hover:bg-white/[0.07] hover:text-white"
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
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* The open business date — the thing night-audit staff need at a glance, not build metadata. */}
      <div className="truncate border-t border-white/10 px-5 py-3 text-[11px] text-white/40">{footer}</div>
      </aside>
    </>
  );
}
