"use client";

import { Printer } from "lucide-react";

/**
 * Print, through the browser's own dialog.
 *
 * Deliberately not a server-rendered PDF. That means headless Chromium in the container — a large
 * binary and a memory-hungry process — on a platform that has already been taken down once by a
 * compute limit. The print stylesheet turns this page into a correct one-page document and the
 * browser's "Save as PDF" produces the file, at no runtime cost.
 *
 * The case this genuinely cannot cover is ATTACHING an invoice to an email, because that needs the
 * bytes on the server. That is when to revisit it, and not before.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
    >
      <Printer className="h-4 w-4" /> Print / Save as PDF
    </button>
  );
}
