"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Globe } from "lucide-react";
import { saveBookingEngineLink, type LinkResult } from "@/lib/actions-booking-engine";

/**
 * The public address and the on/off switch.
 *
 * A client component purely so a rejected slug can say WHY. This is the one field on the screen
 * that can fail for a reason outside the hotel's control — someone else took the name — and
 * "nothing happened" would be the worst possible answer to that.
 */
export function LinkForm({
  origin, slug, enabled, suggestion,
}: {
  origin: string;
  slug: string | null;
  enabled: boolean;
  /** Built from the hotel's name, shown as the placeholder so the field is never a blank guess. */
  suggestion: string;
}) {
  const [state, formAction, pending] = useActionState<LinkResult | null, FormData>(
    saveBookingEngineLink,
    null,
  );

  return (
    <>
      <form action={formAction} className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[18rem] flex-1">
          <label htmlFor="publicSlug" className="block text-[12px] font-semibold text-ink-700">
            Public address
          </label>
          <div className="mt-1.5 flex items-stretch overflow-hidden rounded-md border border-surface-border bg-white focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600">
            <span className="flex items-center gap-1.5 whitespace-nowrap border-r border-surface-border bg-surface-muted px-2.5 text-[12.5px] text-ink-500">
              <Globe className="h-3.5 w-3.5" />
              {origin.replace(/^https?:\/\//, "")}/
            </span>
            <input
              id="publicSlug"
              name="publicSlug"
              defaultValue={slug ?? ""}
              placeholder={suggestion}
              className="min-w-0 flex-1 px-2.5 py-1.5 text-[13px] text-ink-900 outline-none"
            />
          </div>
          <p className="mt-1 text-[11px] text-ink-400">
            Letters, numbers and hyphens. Leave it blank and we will build one from your hotel name.
          </p>
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
          {pending ? "Saving…" : "Save link"}
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
            Saved. Your page is at{" "}
            <span className="font-semibold">
              {origin}/{state.slug}
            </span>
          </span>
        </div>
      )}
    </>
  );
}
