"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, CreditCard, KeyRound, Activity, Settings } from "lucide-react";
import { Logo } from "./Logo";

const SECTIONS: { title?: string; items: { href: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  { items: [
    { href: "/overview", label: "Overview", icon: LayoutDashboard },
    { href: "/clients", label: "Clients", icon: Building2 },
  ] },
  { title: "Platform", items: [
    { href: "/billing", label: "Billing", icon: CreditCard },
    { href: "/connectivity", label: "Connectivity", icon: KeyRound },
    { href: "/health", label: "Platform Health", icon: Activity },
    { href: "/settings", label: "Settings", icon: Settings },
  ] },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-[248px] shrink-0 flex-col bg-brand-900 text-white/90">
      <div className="flex items-center gap-2.5 px-5 py-[18px]">
        <Logo className="h-8 w-8" />
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-tight text-white">Revio</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-warning-500">Operator</div>
        </div>
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
                  className={`group relative mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors duration-150 ${
                    active ? "bg-white/[0.13] text-white" : "text-white/65 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-warning-500" />}
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-white/40">All hotels · super-admin</div>
    </aside>
  );
}
