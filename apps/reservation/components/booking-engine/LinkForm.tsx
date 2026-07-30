"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Copy, Globe, Lock, Pause, Play } from "lucide-react";
import { saveBookingEngineLink, type LinkResult } from "@/lib/actions-booking-engine";

/**
 * The public address and the on/off switch.
 *
 * Two states, because the address behaves differently before and after it exists.
 *
 * **Before** — one pre-filled field and one button. The address is DERIVED from the hotel's name, so
 * the ordinary path is "press the button"; the field is editable only because a generated string is
 * sometimes wrong in ways we cannot detect. A hotel called "Хотел Панорама Резиденс & СПА" does not
 * want `hotel-panorama-rezidens-spa` on a printed card, and two hotels genuinely called "Central"
 * need to differ by city rather than by our `-2` suffix. That is one moment of choice, well spent.
 *
 * **After** — read-only, with the whole link and a copy button, plus an explicit on/off. The address
 * escapes the product the moment it is shared: printed on a QR card, pasted into a bio, given to a
 * print shop. Editing it later breaks material already in the world, and the breakage lands on a
 * guest trying to book, where the hotel never sees it.
 *
 * The address is NOT created with the property. A global namespace where every hotel silently
 * reserves a name — including the ones that never switch the engine on — makes the good names
 * unavailable to the hotels that would actually use them. It is issued when someone asks for it.
 */
export function LinkForm({
  origin, slug, enabled, suggestion,
}: {
  /** The real address guests will use, or null when the booking service isn't published yet. */
  origin: string | null;
  slug: string | null;
  enabled: boolean;
  /** Derived from the hotel's name. Pre-filled, not a placeholder — the default IS the answer. */
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

  /* ---------- Before the address exists: choose it once, and go live in the same click ---------- */
  if (!issued) {
    return (
      <>
        <form action={formAction} className="p-4">
          <label htmlFor="publicSlug" className="block text-[12px] font-semibold text-ink-700">
            Your address
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <div className="flex min-w-[18rem] flex-1 items-stretch overflow-hidden rounded-md border border-surface-border bg-white focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600">
              <span className="flex items-center gap-1.5 whitespace-nowrap border-r border-surface-border bg-surface-muted px-2.5 text-[12.5px] text-ink-500">
                <Globe className="h-3.5 w-3.5" />
                {prefix}
              </span>
              <input
                id="publicSlug"
                name="publicSlug"
                defaultValue={suggestion}
                className="min-w-0 flex-1 px-2.5 py-1.5 text-[13px] text-ink-900 outline-none"
              />
            </div>
            {/* Creating a link nobody can book at is a state with no purpose, so one click does both. */}
            <input type="hidden" name="bookingEngineEnabled" value="on" />
            <button
              disabled={pending}
              className="cursor-pointer whitespace-nowrap rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create link & start taking bookings"}
            </button>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-500">
            We built this from your hotel&apos;s name — most hotels keep it. Change it now if you want
            something shorter or more recognisable, because{" "}
            <span className="font-semibold text-ink-700">it is set once and then locked</span>: guests, QR
            codes and printed material depend on it. You can pause bookings at any time without losing the
            address.
          </p>
        </form>

        {state?.error && (
          <div className="flex items-start gap-2 border-t border-surface-border/60 bg-danger-50 px-4 py-2.5 text-[12.5px] text-danger-600">
            <AlertCircle className="mt-px h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
      </>
    );
  }

  /* ---------- After: the link is fixed; only "are we selling right now" stays changeable ---------- */
  return (
    <>
      <div className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[18rem] flex-1">
          <span className="block text-[12px] font-semibold text-ink-700">Your address</span>
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
            Permanent. If you truly need it changed, contact us — we redirect the old address rather than
            break it.
          </p>
        </div>

        {/*
          One switch, one sentence about what it does to a guest.

          The hidden field carries the state we want AFTER the click, not the one we are in. Sending
          the current state made the button a no-op: pressing "Pause bookings" re-submitted "on".
        */}
        <form action={formAction} className="pb-5">
          {!enabled && <input type="hidden" name="bookingEngineEnabled" value="on" />}
          <button
            disabled={pending}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-2 text-[12.5px] font-semibold transition-colors disabled:opacity-50 ${
              enabled
                ? "border border-surface-border bg-white text-ink-700 hover:bg-surface-muted"
                : "bg-brand-800 text-white hover:bg-brand-700"
            }`}
          >
            {enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {pending ? "Saving…" : enabled ? "Pause bookings" : "Start taking bookings"}
          </button>
        </form>
      </div>

      <div className="border-t border-surface-border/60 px-4 py-2.5 text-[12px] text-ink-500">
        {enabled
          ? "Guests can book right now."
          : "Paused — anyone opening your link sees that online booking is closed. The address stays yours."}
      </div>

      {state?.error && (
        <div className="flex items-start gap-2 border-t border-surface-border/60 bg-danger-50 px-4 py-2.5 text-[12.5px] text-danger-600">
          <AlertCircle className="mt-px h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.ok && (
        <div className="flex items-center gap-2 border-t border-surface-border/60 bg-success-50 px-4 py-2.5 text-[12.5px] text-success-600">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Saved.</span>
        </div>
      )}
    </>
  );
}
