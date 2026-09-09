"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Copy the payment link.
 *
 * The URL is long, truncated on screen, and about to be pasted into an email — selecting it by hand
 * is exactly the operation that produces a link missing its last character, which fails for the
 * customer and looks like our bug.
 *
 * It confirms in place rather than through a toast: the answer to "did that copy?" belongs on the
 * button that was pressed, and a toast for something this small is furniture.
 */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard access can be refused (an insecure origin, a permission policy). Saying
          // nothing would look like the copy worked, so the button admits it instead.
          setCopied(false);
          window.prompt("Copy this link:", url);
        }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
