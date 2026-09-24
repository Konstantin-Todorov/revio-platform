"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Sections down the side, content on the right — the shape Settings has in every Revio product.
 *
 * ## Why it is shared
 *
 * Settings grows. Every product's had reached seven or eight cards on one scrolling page — the
 * property profile, delivery, staff, taxes, 2FA, sessions — and each new feature made it worse. The
 * fix is an information-architecture change rather than a feature: nothing new can be done, but a
 * setting can be *found*, and a support answer can be a link to the exact section instead of
 * "scroll down on Settings".
 *
 * It lives here rather than in each app because a hotel running two products would otherwise meet
 * two different shapes for the same job, and because four copies of one nav is four chances for
 * them to drift. Each app supplies its own `sections` — the list differs, the shape must not.
 *
 * `aria-current="page"` marks the active link rather than colour alone, so the position is available
 * to a screen reader and not only to somebody who can see the highlight. On a phone the list becomes
 * a horizontal strip rather than eating the screen before the content starts.
 */

export interface SettingsSection {
  href: string;
  label: string;
  /** What a person is looking for when they land here. Used by the section's own heading. */
  blurb: string;
  /**
   * Also active on the pages below it — `/help/requests/abc` highlights "Your requests". Off by
   * default because `/settings` sections are leaves, and a prefix there would light up two at once.
   */
  prefix?: boolean;
  /** A short note beside the label — "2 open" — so a count is read without opening the section. */
  badge?: string;
}

export function SettingsNav({
  sections,
  elsewhere = [],
  labels = { nav: "Settings sections", elsewhere: "Elsewhere" },
}: {
  sections: SettingsSection[];
  /**
   * Settings that live on their own screens, linked rather than moved: each already owns a URL that
   * support answers and bookmarks point at, and breaking those to tidy a menu is a poor trade. The
   * nav's job is that somebody looking for a setting finds it — not that everything renders here.
   */
  elsewhere?: SettingsSection[];
  /** The nav's own two words, for a product rendering in another language. English by default. */
  labels?: { nav: string; elsewhere: string };
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={labels.nav} className="lg:w-[212px] lg:shrink-0">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-0">
        {sections.map((s) => {
          const active = pathname === s.href || (s.prefix === true && pathname.startsWith(`${s.href}/`));
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                  active
                    ? "bg-brand-50 font-semibold text-brand-800"
                    : "text-ink-600 hover:bg-surface-muted hover:text-ink-900"
                }`}
              >
                {s.label}
                {s.badge && (
                  <span className="ml-1.5 rounded-full bg-warning-50 px-1.5 py-0.5 text-[10.5px] font-bold text-warning-600">
                    {s.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {elsewhere.length > 0 && (
        <>
          <p className="mt-4 hidden px-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400 lg:block">
            {labels.elsewhere}
          </p>
          <ul className="mt-1 hidden space-y-0.5 lg:block">
            {elsewhere.map((s) => (
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
        </>
      )}
    </nav>
  );
}
