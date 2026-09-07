"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_SECTIONS, SETTINGS_ELSEWHERE } from "./sections";

/**
 * Sections down the side, content on the right.
 *
 * Settings had grown to eight cards on one scrolling page — standing defaults, the permission
 * matrix, staff, taxes, the property profile, the pricing model, 2FA and sessions — and every new
 * feature made it worse. This is an information-architecture change and not a feature: nothing new
 * can be done here, but a setting can now be found, and a support answer can be a link to the exact
 * section rather than "scroll down on Settings".
 *
 * `aria-current="page"` marks the active link rather than colour alone, so the position is available
 * to a screen reader and not only to someone who can see the highlight.
 */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="lg:w-[212px] lg:shrink-0">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-0">
        {SETTINGS_SECTIONS.map((s) => {
          const active = pathname === s.href;
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                  active
                    ? "bg-brand-50 text-brand-800 font-semibold"
                    : "text-ink-600 hover:bg-surface-muted hover:text-ink-900"
                }`}
              >
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Named and linked rather than hidden: somebody hunting for "where do I change the booking
          page" should find the answer in Settings even though the screen lives elsewhere. */}
      <p className="mt-4 hidden px-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400 lg:block">
        Elsewhere
      </p>
      <ul className="mt-1 hidden space-y-0.5 lg:block">
        {SETTINGS_ELSEWHERE.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="block rounded-md px-2.5 py-1.5 text-[12.5px] text-ink-500 transition-colors hover:bg-surface-muted hover:text-ink-900"
            >
              {s.label} <span aria-hidden="true">↗</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
