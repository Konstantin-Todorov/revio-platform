"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import type { Flash } from "./flash.js";

const STYLE: Record<Flash["kind"], { cls: string; Icon: typeof Info }> = {
  error: { cls: "border-danger-600/30 bg-danger-50 text-danger-700", Icon: AlertTriangle },
  success: { cls: "border-success-600/30 bg-success-50 text-success-700", Icon: CheckCircle2 },
  info: { cls: "border-surface-border bg-surface text-ink-700", Icon: Info },
};

/**
 * Shows the one-shot message a server action left behind, then clears it.
 *
 * Clearing happens here, in the browser, because a server component cannot write a cookie during
 * render. The effect runs once on mount and expires the cookie, so a refresh does not replay a
 * message about something the user already dealt with.
 *
 * An error stays until it is dismissed. A success disappears on its own — the difference matters:
 * somebody who missed a confirmation loses nothing, and somebody who missed a refusal is about to
 * press the button again.
 */
export function FlashToast({ flash, cookieName }: { flash: Flash | null; cookieName: string }) {
  const [shown, setShown] = useState(true);

  useEffect(() => {
    document.cookie = `${cookieName}=; path=/; max-age=0`;
    if (flash?.kind === "error") return;
    const t = setTimeout(() => setShown(false), 4500);
    return () => clearTimeout(t);
  }, [flash, cookieName]);

  if (!flash || !shown) return null;
  const { cls, Icon } = STYLE[flash.kind];

  return (
    <div
      // `assertive` for a refusal, `polite` for a confirmation: a screen reader should interrupt to
      // say something did not happen, and should not to say it did.
      role="status"
      aria-live={flash.kind === "error" ? "assertive" : "polite"}
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6"
    >
      <div className={`pointer-events-auto flex max-w-lg items-start gap-2.5 rounded-lg border px-4 py-3 shadow-lg ${cls}`}>
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-[13px] font-medium">{flash.message}</p>
        <button
          type="button" onClick={() => setShown(false)} aria-label="Dismiss"
          className="-mr-1 -mt-0.5 shrink-0 rounded p-1 opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
