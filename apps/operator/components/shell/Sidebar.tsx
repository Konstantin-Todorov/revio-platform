"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, CreditCard, KeyRound, Activity, Settings, Tags, ShieldAlert, History, X, Inbox} from "lucide-react";
import { Logo } from "./Logo";
import { useShell } from "./ShellContext";

const SECTIONS: { title?: string; items: { href: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  { items: [
    { href: "/overview", label: "Overview", icon: LayoutDashboard },
    { href: "/clients", label: "Clients", icon: Building2 },
    // Beside Clients on purpose: a demo request is the stage before one, and the two get looked at
    // in the same sitting.
    { href: "/leads", label: "Demo requests", icon: Inbox },
  ] },
  { title: "Platform", items: [
    // Plans sits above Billing: the price list is the decision, the invoices are the consequence.
    { href: "/plans", label: "Plans & pricing", icon: Tags },
    { href: "/billing", label: "Billing", icon: CreditCard },
    { href: "/connectivity", label: "Connectivity", icon: KeyRound },
    { href: "/health", label: "Platform Health", icon: Activity },
    { href: "/platform-history", label: "Platform history", icon: History },
    // Next to Settings rather than under it: it is read when something has gone wrong, and a
    // screen you have to remember lives inside another one is a screen nobody finds in a hurry.
    { href: "/auth-log", label: "Auth log", icon: ShieldAlert },
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

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {SECTIONS.map((section, i) => (
          <div key={i} className="mb-1">
            {section.title && (
              <div className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.13em] text-white/30">{section.title}</div>
            )}
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`group relative mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium outline-none transition-[background-color,color,transform] duration-base ease-standard focus-visible:ring-2 focus-visible:ring-product-mark/70 ${
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
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-white/40">All hotels · super-admin</div>
      </aside>
    </>
  );
}
