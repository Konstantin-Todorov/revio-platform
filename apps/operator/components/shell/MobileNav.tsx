"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { OPERATOR_AREAS, activeSection, areaForPath } from "./navigation";
import { useShell } from "./ShellContext";

/**
 * The same menu on a phone, in the shape a phone wants.
 *
 * An icon rail beside a panel is a **desktop** idea: it trades width for the ability to keep two
 * levels on screen at once, and a phone has no width to trade. Forcing it through would give a 68px
 * drawer of unlabelled icons — the worst possible first day for somebody learning where things are.
 *
 * So the two levels are flattened into one labelled list, with the current area's sections indented
 * beneath it. Nothing is hidden and nothing is renamed; only the arrangement changes, which is what
 * responsive means. It is deliberately NOT an accordion: an area you are not in has nothing worth
 * expanding, and a tap that only reveals more taps is the thing that makes phone menus tiring.
 */
export function MobileNav() {
  const pathname = usePathname();
  const current = areaForPath(pathname);
  const { setOpen } = useShell();
  const close = () => setOpen(false);

  return (
    <div className="flex h-full w-[280px] flex-col bg-brand-900 text-white/90">
      <div className="flex items-center gap-2.5 px-5 py-[18px]">
        <Logo className="h-8 w-8" />
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-tight text-white">Revio</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Operator</div>
        </div>
      </div>

      <nav aria-label="Operator navigation" className="flex-1 overflow-y-auto px-3 pb-4">
        {OPERATOR_AREAS.map((area) => {
          const isCurrent = current?.key === area.key;
          const Icon = area.icon;
          const active = isCurrent ? activeSection(pathname, area.sections) : null;
          return (
            <div key={area.key} className="mb-0.5">
              <Link
                href={area.href}
                onClick={close}
                aria-current={isCurrent && area.sections.length === 0 ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                  isCurrent ? "bg-product-mark/[0.14] text-white" : "text-white/65 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${isCurrent ? "text-product-mark" : "text-white/55"}`} strokeWidth={2} />
                <span className="flex-1">{area.label}</span>
              </Link>

              {/* Only the area you are in opens. Every other area's sections are one tap away and
                  nothing is lost by not showing them. */}
              {isCurrent && area.sections.length >= 2 && (
                <div className="ml-[30px] mt-0.5 border-l border-white/10 pl-2">
                  {area.sections.map((s) => (
                    <Link
                      key={s.href}
                      href={s.href}
                      onClick={close}
                      aria-current={active === s.href ? "page" : undefined}
                      className={`block rounded-md px-3 py-2 text-[13px] transition-colors ${
                        active === s.href ? "font-semibold text-white" : "text-white/55 hover:text-white"
                      }`}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
