"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { SUPPORT_KINDS, searchHelp, type ProductKey, type SupportKind } from "@revio/core";

/**
 * "Get help" — one dialog, shared by all three hotel products.
 *
 * ## What it captures without asking
 *
 * The screen the person is on (`usePathname`) travels with the request. So does the product, the
 * hotel and the user, added by the action on the server. Nobody mid-incident should be asked which
 * page they were on, and nobody should have to describe their own hotel to the company running it.
 *
 * ## The promise is shown BEFORE they send
 *
 * Each kind carries the reply window we actually commit to, and it is visible at the moment they
 * choose — not buried in a confirmation afterwards. A person deciding whether to phone somebody
 * instead deserves to know before they type, and a promise revealed after the fact is not a promise,
 * it is an excuse.
 *
 * ⚠️ There is no 24/7 anything here, deliberately. The windows in `SUPPORT_KINDS` are modest and
 * keepable; a response time nobody can meet costs more trust than no promise at all.
 *
 * ## Why the dialog is portalled to `<body>`
 *
 * The trigger belongs in the account menu; the dialog cannot. That menu is an `absolute`,
 * `overflow-hidden`, 248px-wide dropdown, and a modal rendered inside it is clipped by the overflow
 * and trapped in the menu's stacking context — the first version shipped that way and the backdrop
 * never covered the page, the panel sat under the menu and the top of the form was cut off above the
 * viewport.
 *
 * `createPortal` moves the dialog to the document body, so it is laid out against the viewport
 * rather than against a 248px box. Opening it also closes the menu (`onOpen`), because two open
 * surfaces stacked on each other is confusing even once the geometry is right.
 */

export type GetHelpResult = { ok: boolean; error?: string; reference?: string } | null;

/**
 * The button that opens it. Lives in the menu; the dialog does not.
 *
 * Separate from `GetHelp` for a reason that cost a release: the menu is rendered conditionally, so
 * closing it UNMOUNTS everything inside — including a dialog whose open state lives there, which
 * vanished the instant it was asked to appear. The menu's click-outside handler did the same, since
 * a portalled dialog is outside the menu's ref by definition.
 *
 * So the trigger sits in the menu and the dialog sits beside it, at a level that is always mounted.
 */
export function GetHelpTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-700 transition-colors hover:bg-surface-muted"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 3.2 2.4c-.7.2-1.2.9-1.2 1.6v.5M12 17h.01" strokeLinecap="round" />
      </svg>
      Get help
    </button>
  );
}

export function GetHelp({
  open,
  onClose,
  action,
  productName,
  product,
}: {
  open: boolean;
  onClose: () => void;
  action: (prev: GetHelpResult, fd: FormData) => Promise<GetHelpResult>;
  productName: string;
  /** Which product this is, so the suggestions never offer an answer that is wrong here. */
  product: ProductKey;
}) {
  const [kind, setKind] = useState<SupportKind>("problem");
  const [state, formAction, pending] = useActionState<GetHelpResult, FormData>(action, null);
  const pathname = usePathname();
  // Route-led, so the answers fit the screen they are stuck on rather than a search they have
  // not written yet. Two at most — see the note where they are rendered.
  const suggestions = searchHelp({ product, route: pathname }, 2);

  // The portal target only exists in the browser; on the server there is no document to render into.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Escape closes it, which every dialog should honour and a keyboard user will try first.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Get help"
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-ink-900/50 p-0 sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="my-auto max-h-[92dvh] w-full overflow-y-auto rounded-t-xl bg-white p-5 text-left shadow-pop sm:w-[480px] sm:max-w-[calc(100vw-2rem)] sm:rounded-xl">
        {state?.ok ? (
          <>
            <h2 className="text-[16px] font-semibold text-ink-900">We have it</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-600">
              Your reference is{" "}
              <span className="font-semibold tabular-nums text-ink-900">{state.reference}</span>. We
              have your email address and will reply there — {SUPPORT_KINDS.find((k) => k.key === kind)?.promise}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 h-10 rounded-md bg-brand-800 px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Close
            </button>
          </>
        ) : (
          <form action={formAction}>
            <h2 className="text-[16px] font-semibold text-ink-900">Get help</h2>
            <p className="mt-1 text-[12.5px] text-ink-500">
              We can see which hotel and which screen you are on, so start with what went wrong.
            </p>

            {/*
              Answers for THIS screen, before they type.
              Shown because most requests are not faults — they are "where do I change that", and an
              answer now is better for the hotel than a reply tomorrow. Never more than two: a wall
              of suggestions reads as a wall put up to avoid answering.
            */}
            {suggestions.length > 0 && (
              <div className="mt-3 rounded-lg border border-surface-border bg-surface-muted/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  This might be it
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {suggestions.map((a) => (
                    <li key={a.id}>
                      <details className="group">
                        <summary className="cursor-pointer list-none text-[12.5px] font-medium text-brand-700 hover:underline">
                          {a.question}
                        </summary>
                        <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-ink-600">
                          {a.answer}
                        </p>
                      </details>
                    </li>
                  ))}
                </ul>
                <a href="/help" className="mt-2 inline-block text-[11.5px] font-semibold text-ink-500 hover:text-ink-900">
                  All help →
                </a>
              </div>
            )}

            <input type="hidden" name="route" value={pathname} />
            <input type="hidden" name="kind" value={kind} />

            <fieldset className="mt-4">
              <legend className="sr-only">How urgent is it?</legend>
              <div className="space-y-1.5">
                {SUPPORT_KINDS.map((k) => (
                  <label
                    key={k.key}
                    className={`block cursor-pointer rounded-lg border p-2.5 transition-colors ${
                      kind === k.key ? "border-brand-600 bg-brand-50/60" : "border-surface-border hover:bg-surface-muted"
                    }`}
                  >
                    <span className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="kindChoice"
                        checked={kind === k.key}
                        onChange={() => setKind(k.key)}
                        className="mt-0.5 h-3.5 w-3.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-ink-900">{k.label}</span>
                        <span className="block text-[11.5px] leading-snug text-ink-500">{k.hint}</span>
                        <span className="mt-0.5 block text-[11.5px] font-medium text-brand-700">{k.promise}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mt-4 block">
              <span className="mb-1 block text-[12.5px] font-semibold text-ink-700">What is happening?</span>
              <textarea
                name="message"
                rows={4}
                required
                autoFocus
                placeholder="Booking page returns an error when I press save on rates."
                className="w-full rounded-md border border-surface-border bg-white px-3 py-2 text-[14px] text-ink-900 outline-none transition-colors focus:border-brand-600"
              />
            </label>

            {state?.error ? (
              <p role="alert" className="mt-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>
            ) : null}

            <div className="mt-4 flex items-center gap-2">
              <button
                type="submit"
                disabled={pending}
                className="h-10 rounded-md bg-brand-800 px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                {pending ? "Sending…" : "Send to Revio"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-md px-3 text-[13.5px] font-medium text-ink-600 transition-colors hover:bg-surface-muted"
              >
                Cancel
              </button>
              <span className="ml-auto text-[11px] text-ink-400">{productName}</span>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
