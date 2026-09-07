"use client";

import type { ProductLink } from "./product-links";

/**
 * The inside of the account menu, shared by all four staff apps.
 *
 * Each app keeps its own `UserMenu` — the trigger, the avatar colour and the sign-out action are
 * genuinely per-product — but what the dropdown *says* should not drift between them. Before this,
 * every menu held one link and Log out.
 *
 * ## Two things it adds, and why each earns its place
 *
 * **Who you are.** The trigger shows the name only from `sm:` up, so on a phone the menu was
 * anonymous. It matters more here than in most software: one identity spans every product a hotel
 * bought, and demo accounts exist alongside real ones. "Which account am I in" should never need a
 * trip to Settings.
 *
 * **Where else you can go.** One login, every product you bought is the platform's central claim,
 * and until now there was no way to act on it — a manager in RevioCRS who wanted the front desk had
 * to know the hostname. Rendered only when the hotel owns more than the product they are looking at,
 * because a switcher whose single destination is the current page is noise pretending to be a
 * feature.
 *
 * Cross-product links are plain `<a>`, not `next/link`: they are separate deployments on separate
 * hostnames, and the client router cannot prefetch or soft-navigate to them.
 */
export function AccountMenuBody({
  userName,
  userEmail,
  roleLabel,
  products,
}: {
  userName: string;
  userEmail?: string | null;
  roleLabel: string;
  products: ProductLink[];
}) {
  return (
    <>
      <div className="border-b border-surface-border px-3 py-2.5">
        <div className="truncate text-[13px] font-semibold text-ink-900">{userName}</div>
        {userEmail ? (
          <div className="truncate text-[11.5px] text-ink-500">{userEmail}</div>
        ) : null}
        <div className="mt-0.5 text-[11px] text-ink-400">{roleLabel}</div>
      </div>

      {products.length > 0 && (
        <div className="border-b border-surface-border py-1">
          <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
            Your products
          </p>
          {products.map((p) =>
            p.current ? (
              <div
                key={p.key}
                aria-current="true"
                className="flex items-center justify-between gap-2 bg-surface-muted/60 px-3 py-1.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-ink-900">{p.name}</span>
                  <span className="block truncate text-[11px] text-ink-400">{p.tagline}</span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  Here
                </span>
              </div>
            ) : (
              <a
                key={p.key}
                href={p.href}
                className="block px-3 py-1.5 transition-colors hover:bg-surface-muted"
              >
                <span className="block truncate text-[13px] text-ink-700">{p.name}</span>
                <span className="block truncate text-[11px] text-ink-400">{p.tagline}</span>
              </a>
            ),
          )}
        </div>
      )}
    </>
  );
}
