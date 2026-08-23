"use client";

import { Download } from "lucide-react";

/**
 * Turn the document on screen into a file.
 *
 * `window.print()` with the print rules in `globals.css` produces exactly the document — no sidebar,
 * no topbar, no search box — and every browser's print dialog offers "Save as PDF". That is a real
 * PDF a guest can be emailed and an accountant can file, at no runtime cost.
 *
 * **Why not render the PDF on the server.** It would mean headless Chromium in the container: a
 * large binary and a memory-hungry process, on a platform that has already been taken down once by
 * a compute limit. A server-rendered document is strictly better for two things — attaching to an
 * email, and archiving a byte-identical copy — and worse for everything else. When invoices need to
 * be *sent* rather than saved by a person, that is the moment to pay for it. Recorded in GO-LIVE.md
 * rather than guessed at now.
 *
 * `data-print-hide` so the button never appears on the thing it produces.
 */
export function DownloadDocument({ label = "Download / print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      data-print-hide
      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700"
    >
      <Download className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
