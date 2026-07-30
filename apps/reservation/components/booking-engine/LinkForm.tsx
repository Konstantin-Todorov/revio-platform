"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Copy, Globe, Lock } from "lucide-react";
import { saveBookingEngineLink, type LinkResult } from "@/lib/actions-booking-engine";

/**
 * The public address and the on/off switch.
 *
 * Two states, because the address behaves differently before and after it exists:
 *
 *  - **Not issued yet** — an editable field, because this is the one moment the hotel gets to choose.
 *  - **Issued** — read-only, with the whole link and a copy button. The address escapes the product
 *    the moment it is shared: printed on a QR card, pasted into a bio, given to a print shop.
 *    Editing it later would break material already in the world, and the breakage would land on a
 *    guest trying to book, where the hotel never sees it. So it is issued once and frozen, and the
 *    screen says so rather than letting someone discover it.
 *
 * A client component so a rejected slug can say WHY. This is the one field that can fail for a
 * reason outside the hotel's control — someone else took the name — and "nothing happened" would be
 * the worst possible answer to that.
 */
export function LinkForm({
  origin, slug, enabled, suggestion,
}: {
  /** The real address guests will use, or null when the booking service isn't published yet. */
  origin: string | null;
  slug: string | null;
  enabled: boolean;
  /** Built from the hotel's name, shown as the placeholder so the field is never a blank guess. */
  suggestion: string;
}) {
  const [state, formAction, pending] = useActionState<LinkResult | null, FormData>(
    saveBookingEngineLink,
    null,
  );
  const [copied, setCopied] = useState(false);

  const issued = slug ?? state?.slug ?? null;
  const fullUrl = issued && origin ? `${origin}/${issued}` : null;
  const prefix = origin ? `${origin.replace(/^https?:\/\//, "")}/` : "your-address/";

  async function copy() {
    if (!fullUrl) return;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <form action={formAction} className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[18rem] flex-1">
          <label htmlFor="publicSlug" className="block text-[12px] font-semibold text-ink-700">
            Public address
          </label>

          {issued ? (
            <>
              <div className="mt-1.5 flex items-stretch overflow-hidden rounded-md border border-surface-border bg-surface-muted">
                <span className="flex items-center gap-1.5 whitespace-nowrap border-r border-surface-border px-2.5 text-[12.5px] text-ink-500">
                  <Lock className="h-3.5 w-3.5" />
                  {prefix}
                </span>
                <span className="min-w-0 flex-1 truncate px-2.5 py-1.5 text-[13px] font-semibold text-ink-900">
                  {issued}
                </span>
                {fullUrl && (
                  <button
                    type="button"
                    onClick={copy}
                    className="flex cursor-pointer items-center gap-1.5 border-l border-surface-border px-2.5 text-[12px] font-semibold text-ink-600 transition-colors hover:bg-white hover:text-ink-900"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-ink-400">
                Set once and permanent. Guests, QR codes and printed material rely on it, so it can only be
                changed by contacting us — and we redirect the old address rather than break it.
              </p>
            </>
          ) : (
            <>
              <div className="mt-1.5 flex items-stretch overflow-hidden rounded-md border border-surface-border bg-white focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600">
                <span className="flex items-center gap-1.5 whitespace-nowrap border-r border-surface-border bg-surface-muted px-2.5 text-[12.5px] text-ink-500">
                  <Globe className="h-3.5 w-3.5" />
                  {prefix}
                </span>
                <input
                  id="publicSlug"
                  name="publicSlug"
                  defaultValue=""
                  placeholder={suggestion}
                  className="min-w-0 flex-1 px-2.5 py-1.5 text-[13px] text-ink-900 outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-ink-500">
                Letters, numbers and hyphens. Leave it blank and we will build one from your hotel name.{" "}
                <span className="font-semibold text-ink-700">Choose carefully — this is set once and then locked</span>,
                because it goes on QR codes and printed material.
              </p>
            </>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-2 pb-6">
          <input
            type="checkbox"
            name="bookingEngineEnabled"
            defaultChecked={enabled}
            className="h-4 w-4 cursor-pointer accent-brand-700"
          />
          <span className="text-[13px] font-semibold text-ink-900">Accept bookings</span>
        </label>

        <button
          disabled={pending}
          className="mb-6 cursor-pointer rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : issued ? "Save" : "Create my link"}
        </button>
      </form>

      {state?.error && (
        <div className="flex items-start gap-2 border-t border-surface-border/60 bg-danger-50 px-4 py-2.5 text-[12.5px] text-danger-600">
          <AlertCircle className="mt-px h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.ok && (
        <div className="flex items-center gap-2 border-t border-surface-border/60 bg-success-50 px-4 py-2.5 text-[12.5px] text-success-600">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Saved.{" "}
            {fullUrl ? (
              <>
                Your page is at <span className="font-semibold">{fullUrl}</span>
              </>
            ) : (
              <>Your address is reserved and goes live with your booking page.</>
            )}
          </span>
        </div>
      )}
    </>
  );
}
