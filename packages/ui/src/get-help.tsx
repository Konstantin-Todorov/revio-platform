"use client";

import { useActionState, useState } from "react";
import { usePathname } from "next/navigation";
import { SUPPORT_KINDS, type SupportKind } from "@revio/core";

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
 */

export type GetHelpResult = { ok: boolean; error?: string; reference?: string } | null;

export function GetHelp({
  action,
  productName,
  onDone,
}: {
  action: (prev: GetHelpResult, fd: FormData) => Promise<GetHelpResult>;
  productName: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SupportKind>("problem");
  const [state, formAction, pending] = useActionState<GetHelpResult, FormData>(action, null);
  const pathname = usePathname();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white p-5 shadow-pop sm:max-w-[480px] sm:rounded-xl">
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
              onClick={() => { setOpen(false); onDone?.(); }}
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
                onClick={() => setOpen(false)}
                className="h-10 rounded-md px-3 text-[13.5px] font-medium text-ink-600 transition-colors hover:bg-surface-muted"
              >
                Cancel
              </button>
              <span className="ml-auto text-[11px] text-ink-400">{productName}</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
