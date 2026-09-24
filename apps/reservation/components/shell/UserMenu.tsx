"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Settings, LogOut, ChevronDown, Languages } from "lucide-react";
import { AccountMenuBody } from "@revio/ui/account-menu-body";
import { openProduct } from "@/lib/actions-switch";
import { GetHelp, GetHelpTrigger } from "@revio/ui/get-help";
import { submitSupportRequest } from "@/lib/actions-support";
import type { ProductLink, ProductUpsell } from "@revio/ui/product-links";
import { logout } from "@/lib/actions-auth";
import { setLocale } from "@/lib/actions-locale";
import { LOCALES, LOCALE_LABELS, translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { shell } from "@/lib/i18n/shell";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "U";
}

/** Top-right account menu: the avatar opens a dropdown → Settings + Log out. */
export function UserMenu({ userName, roleLabel, products, upsells, canSwitchLanguage = false }: {
  userName: string; roleLabel: string; products: ProductLink[]; upsells: ProductUpsell[];
  /** Off until RevioCRS is fully translated (`lib/i18n/ready.ts`) — a switch that changes half a screen is worse than none. */
  canSwitchLanguage?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const t = translate(shell, locale).menu;
  // Beside the menu's own state, never inside the dropdown: closing the menu unmounts what is
  // in it, and a dialog whose state lives there disappears the moment it is asked to appear.
  const [helpOpen, setHelpOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={t.account} className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-surface-muted">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-product-ink text-[12px] font-bold text-white">{initials(userName)}</div>
        <div className="hidden text-left leading-tight sm:block">
          <div className="text-[12.5px] font-semibold text-ink-900">{userName}</div>
          <div className="text-[11px] text-ink-400">{roleLabel}</div>
        </div>
        <ChevronDown className="hidden h-4 w-4 text-ink-400 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-[248px] overflow-hidden rounded-lg border border-surface-border bg-white shadow-pop">
          <AccountMenuBody
            openProduct={openProduct}
            userName={userName}
            roleLabel={roleLabel}
            products={products}
            upsells={upsells}
            /* The route exists in this app, so the "Also available" list offers it instead of
               telling somebody to ring us. The page behind it decides eligibility — this only
               builds the address. */
            trialHref={(key) => `/start-trial/${key}`}
          />
          {/* Your account, not the property's settings. This menu hangs off the avatar and sits above
              "Sign out", so "Settings" here means the signed-in person — the sidebar already covers
              the property. Before the sections existed both links went to the same long page. */}
          <Link href="/settings/account" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-[13px] text-ink-700 transition-colors hover:bg-surface-muted">
            <Settings className="h-4 w-4 text-ink-400" /> {t.yourAccount}
          </Link>
          {/*
            The panel language — each named in its own words, so the one you can read is findable
            whatever is showing now. It is this person's, in every Revio product; the language guests
            are written to is a separate setting (Settings → Guest emails).
          */}
          {canSwitchLanguage && (
            <form action={setLocale} className="flex items-center gap-1.5 border-t border-surface-border px-3 py-2" aria-label={t.language}>
              <Languages className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="submit"
                  name="locale"
                  value={l}
                  lang={LOCALE_LABELS[l].htmlLang}
                  aria-pressed={l === locale}
                  className={`rounded px-2 py-0.5 text-[12.5px] font-semibold transition-colors ${l === locale ? "bg-brand-50 text-brand-800" : "text-ink-600 hover:bg-surface-muted"}`}
                >
                  {LOCALE_LABELS[l].native}
                </button>
              ))}
            </form>
          )}
          <GetHelpTrigger onClick={() => { setHelpOpen(true); setOpen(false); }} />
          <form action={logout} className="border-t border-surface-border">
            <button type="submit" className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-700 transition-colors hover:bg-danger-50 hover:text-danger-600">
              <LogOut className="h-4 w-4 text-ink-400" /> {t.logOut}
            </button>
          </form>
        </div>
      )}
      <GetHelp
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        action={submitSupportRequest}
        product="crs"
        productName="RevioCRS"
      />
    </div>
  );
}
