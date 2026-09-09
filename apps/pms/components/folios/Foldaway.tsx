import { ChevronRight } from "lucide-react";

/**
 * A section of the folio that is not what you came here for — folded away, but never hidden.
 *
 * ## Why not tabs
 *
 * Tabs were proposed for this screen and the founder pushed back, correctly: *"won't it be harder
 * for receptionists, won't they get more confused?"* At a front desk, yes. Three reasons, and they
 * are specific to this screen rather than to tabs in general:
 *
 * - **You do not know in advance which tab you need.** The guest says "half on the card, half in
 *   cash" or "can I have it on the company" *after* you have opened the page.
 * - **A tab you never open is a feature you never learn exists.** A receptionist can work for
 *   months without discovering deposits.
 * - **It breaks muscle memory**, and this is done twenty times a day with somebody waiting.
 *
 * Tabs suit the operator's client page, where one person reads at leisure. This is a queue.
 *
 * ## What this does instead
 *
 * Everything stays on one page, in one scroll, in an order that follows what the stay needs now.
 * What is not needed *right now* collapses to a single line — and that line **carries its state**,
 * so the common question is answered without opening anything at all: "are there deposits?" is
 * answered by "none held", not by a click.
 *
 * `<details>`/`<summary>` on purpose: native disclosure, keyboard-operable and findable by the
 * browser's own in-page search even while collapsed, with no client component and no JavaScript. A
 * hand-rolled version would be a client bundle to do worse.
 */
export function Foldaway({
  title,
  /** The one-line answer, so most visits never need to open it. */
  state,
  /**
   * Open on arrival. Reserved for something that must be dealt with before the guest leaves —
   * money held, an unresolved question — never as a default for "this section is important".
   */
  defaultOpen = false,
  /**
   * Whether the state line is something to DO or merely something to know.
   *
   * Caught by looking at the rendered row: "€50 held — apply or refund before checkout" sat in the
   * same quiet grey as "No invoice issued yet". One of those is a fact and the other is a job to be
   * done before a guest walks out of the door, and colour is read before words
   * (`docs/UI-STANDARD.md` rule 2). Reserved for exactly that — if everything is amber, nothing is.
   */
  tone = "quiet",
  children,
}: {
  title: string;
  state: string;
  defaultOpen?: boolean;
  tone?: "quiet" | "attention";
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-surface-border bg-white shadow-sm">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand-600/40 [&::-webkit-details-marker]:hidden"
      >
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-400 transition-transform duration-150 group-open:rotate-90" />
        <span className="text-[13px] font-bold text-ink-900">{title}</span>
        {/* The state, right-aligned and quiet. It is the reason this can stay shut. */}
        <span
          className={`ml-auto text-right text-[11.5px] ${
            tone === "attention" ? "font-semibold text-warning-700" : "text-ink-500"
          }`}
        >
          {state}
        </span>
      </summary>
      <div className="border-t border-surface-border">{children}</div>
    </details>
  );
}
