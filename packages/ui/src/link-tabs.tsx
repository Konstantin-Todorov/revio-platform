import type { ReactNode } from "react";
import Link from "next/link";

export type LinkTab = {
  href: string;
  label: string;
  active: boolean;
  icon?: ReactNode;
  /** A count read without opening the tab — "3" photos, "12" items. */
  badge?: string | undefined;
  /** `danger` when the count is of things that are wrong — failed pushes, not photos. */
  badgeTone?: "neutral" | "danger";
  /** A dot: something here needs attention (a guest would miss something), said before it is opened. */
  warn?: boolean;
};

/**
 * Views of one thing, on top — the second half of the shape every set-up screen has
 * (docs/UI-STANDARD.md §8): sections on the left, tabs on top.
 *
 * Links, not buttons: each view is an address that a support answer, a bookmark or a save's redirect
 * can land on, and the browser's Back goes where a person expects. One component for every product,
 * because the same concept drawn three ways is three things to learn (and the copy that drifts is the
 * one that loses the badge).
 */
export function LinkTabs({ tabs, label }: { tabs: LinkTab[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max items-center gap-1 border-b border-surface-border px-1">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              scroll={false}
              aria-current={t.active ? "page" : undefined}
              className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors ${
                t.active ? "border-brand-700 text-brand-800" : "border-transparent text-ink-500 hover:text-ink-700"
              }`}
            >
              {t.icon}
              {t.label}
              {t.badge && (
                <span className={`tnum rounded-full px-1.5 py-px text-[10.5px] font-bold ${t.badgeTone === "danger" ? "bg-danger-500 text-white" : "bg-surface-sunken text-ink-500"}`}>{t.badge}</span>
              )}
              {t.warn && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning-500" />}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
