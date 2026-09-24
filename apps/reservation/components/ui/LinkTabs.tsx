import Link from "next/link";

export type LinkTab = { href: string; label: string; active: boolean; badge?: string | undefined; warn?: boolean };

/**
 * Views of one thing, on top — the second half of the Settings shape (docs/UI-STANDARD.md §8):
 * sections on the left, tabs on top. Links, not buttons, so each view has an address that a support
 * answer or a "Save" can land on, and the browser's Back goes where a person expects.
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
              {t.label}
              {t.badge && <span className="tnum rounded-full bg-surface-sunken px-1.5 py-px text-[10.5px] font-bold text-ink-500">{t.badge}</span>}
              {t.warn && <span aria-label="Something a guest would miss" className="h-1.5 w-1.5 rounded-full bg-warning-500" />}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
