"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Settings, LogOut, ChevronDown } from "lucide-react";
import { AccountMenuBody } from "@revio/ui/account-menu-body";
import { GetHelp, GetHelpTrigger } from "@revio/ui/get-help";
import { submitSupportRequest } from "@/lib/actions-support";
import type { ProductLink, ProductUpsell } from "@revio/ui/product-links";
import { logout } from "@/lib/actions-auth";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "U";
}

/** Top-right account menu: the avatar opens a dropdown → Settings + Log out. */
export function UserMenu({ userName, roleLabel, products, upsells }: { userName: string; roleLabel: string; products: ProductLink[]; upsells: ProductUpsell[] }) {
  const [open, setOpen] = useState(false);
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
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Account menu" className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-surface-muted">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-product-ink text-[12px] font-bold text-white">{initials(userName)}</div>
        <div className="hidden text-left leading-tight sm:block">
          <div className="text-[12.5px] font-semibold text-ink-900">{userName}</div>
          <div className="text-[11px] text-ink-400">{roleLabel}</div>
        </div>
        <ChevronDown className="hidden h-4 w-4 text-ink-400 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-[248px] overflow-hidden rounded-lg border border-surface-border bg-white shadow-pop">
          <AccountMenuBody userName={userName} roleLabel={roleLabel} products={products} upsells={upsells} />
          {/* Your account, not the property's settings. This menu hangs off the avatar and sits above
              "Sign out", so "Settings" here means the signed-in person — the sidebar already covers
              the property. Before the sections existed both links went to the same long page. */}
          <Link href="/settings/account" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-[13px] text-ink-700 transition-colors hover:bg-surface-muted">
            <Settings className="h-4 w-4 text-ink-400" /> Your account
          </Link>
          <GetHelpTrigger onClick={() => { setHelpOpen(true); setOpen(false); }} />
          <form action={logout} className="border-t border-surface-border">
            <button type="submit" className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-700 transition-colors hover:bg-danger-50 hover:text-danger-600">
              <LogOut className="h-4 w-4 text-ink-400" /> Log out
            </button>
          </form>
        </div>
      )}
      <GetHelp
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        action={submitSupportRequest}
        productName="RevioCRS"
      />
    </div>
  );
}
