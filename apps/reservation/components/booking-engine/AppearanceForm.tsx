"use client";

import { useActionState, useState } from "react";
import { BOOKING_PRESETS, BOOKING_FONTS, BOOKING_COPY_DEFAULTS } from "@revio/core";
import { AlertCircle, Check, Palette, RotateCcw } from "lucide-react";
import { EnginePreview } from "./EnginePreview";
import type { LookResult } from "@/lib/actions-booking-engine";

/**
 * Appearance: pick a base, then edit.
 *
 * The form is a client component only so the preview can follow the controls live. Every field
 * still posts to a normal server action — no client-side saving, no optimistic state to get out of
 * sync with the row.
 *
 * The empty state of every field is "inherit from your email branding". That is what makes this
 * screen safe to open: a hotel can change one thing without adopting responsibility for all of it,
 * and the placeholder shows what they would be overriding.
 */

export function AppearanceForm({
  action, propertyName, inherited, saved,
}: {
  action: (prev: LookResult | null, fd: FormData) => Promise<LookResult>;
  propertyName: string;
  /** What the email branding would give them, shown as the placeholder for each blank field. */
  inherited: { color: string; font: string; logoUrl: string | null };
  saved: {
    preset: string;
    color: string | null;
    font: string | null;
    logoUrl: string | null;
    headline: string | null;
    subheadline: string | null;
    showTrust: boolean;
  };
}) {
  const [preset, setPreset] = useState(saved.preset);
  const [color, setColor] = useState(saved.color ?? "");
  const [font, setFont] = useState(saved.font ?? "");
  const [logoUrl, setLogoUrl] = useState(saved.logoUrl ?? "");
  const [headline, setHeadline] = useState(saved.headline ?? "");
  const [subheadline, setSubheadline] = useState(saved.subheadline ?? "");
  const [showTrust, setShowTrust] = useState(saved.showTrust);
  const [state, formAction, pending] = useActionState<LookResult | null, FormData>(action, null);

  // What the guest will actually see: the hotel's own value where set, the inherited one otherwise.
  const effective = {
    color: color.trim() || inherited.color,
    font: font.trim() || inherited.font,
    logoUrl: logoUrl.trim() || inherited.logoUrl,
  };

  return (
    <form action={formAction} className="grid gap-5 p-4 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-5">
        <Field label="Base" hint="Sets the neutrals and the shape. Your colour sits on top of whichever you choose.">
          <input type="hidden" name="bookingPreset" value={preset} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {BOOKING_PRESETS.map((p) => (
              <button
                type="button"
                key={p.key}
                onClick={() => setPreset(p.key)}
                aria-pressed={preset === p.key}
                className={`cursor-pointer rounded-lg border p-2.5 text-left transition-colors ${
                  preset === p.key
                    ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                    : "border-surface-border bg-white hover:border-ink-300"
                }`}
              >
                <Swatch tokens={p.tokens} accent={effective.color} />
                <div className="mt-2 text-[12.5px] font-bold text-ink-900">{p.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-ink-500">{p.blurb}</div>
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Colour" hint="Blank inherits your email brand colour.">
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Pick a colour"
                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : effective.color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-11 cursor-pointer rounded-md border border-surface-border bg-white p-0.5"
              />
              <input
                name="bookingBrandColor"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder={`${inherited.color} (inherited)`}
                className={INPUT}
              />
              {color && <Reset onClick={() => setColor("")} />}
            </div>
          </Field>

          <Field label="Headings" hint="Body text is always the same sans — prices need its numerals.">
            <div className="flex items-center gap-2">
              <select name="bookingFont" value={font} onChange={(e) => setFont(e.target.value)} className={INPUT}>
                <option value="">Inherit from email ({inherited.font})</option>
                {BOOKING_FONTS.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>
          </Field>
        </div>

        {/*
          The logo control is NOT here — it is rendered above this form by the page.

          An upload is its own request with its own failure mode, and a <form> inside a <form> makes
          the browser submit the wrong one. The URL field stays, hidden, so a hotel that pasted a
          link keeps it: uploading clears it deliberately, but saving the rest of the appearance
          must not.
        */}
        <input type="hidden" name="bookingLogoUrl" value={logoUrl} />

        <Field label="Headline" hint="The first thing a guest reads. Blank uses the platform wording.">
          <input
            name="bookingHeadline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder={BOOKING_COPY_DEFAULTS.headline}
            maxLength={70}
            className={INPUT}
          />
        </Field>

        <Field label="Supporting line">
          <textarea
            name="bookingSubheadline"
            value={subheadline}
            onChange={(e) => setSubheadline(e.target.value)}
            placeholder={BOOKING_COPY_DEFAULTS.subheadline}
            rows={3}
            maxLength={260}
            className={`${INPUT} resize-y`}
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            name="bookingShowTrust"
            checked={showTrust}
            onChange={(e) => setShowTrust(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-brand-700"
          />
          <span>
            <span className="block text-[13px] font-semibold text-ink-900">
              Show the &ldquo;why book direct&rdquo; row
            </span>
            <span className="block text-[11.5px] leading-snug text-ink-500">
              No booking fees · nothing charged today · live availability. Every claim is one the
              platform actually keeps, so it is safe to leave on.
            </span>
          </span>
        </label>

        {/*
          Saving has to be visible. Every field here is already reflected in the live preview, so a
          successful save changes nothing on screen — which made the button look broken. The button
          reports its own progress and confirms.
        */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {state?.error && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-danger-600">
              <AlertCircle className="h-3.5 w-3.5" /> {state.error}
            </span>
          )}
          {state?.ok && !pending && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-success-600">
              <Check className="h-3.5 w-3.5" /> Saved — your booking page is updated
            </span>
          )}
          <button
            disabled={pending}
            className="cursor-pointer rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            <Palette className="mr-1.5 inline h-3.5 w-3.5" />
            {pending ? "Saving…" : "Save appearance"}
          </button>
        </div>
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="mb-2 text-[11.5px] font-semibold text-ink-500">Live preview</div>
        <EnginePreview
          preset={preset}
          color={effective.color}
          font={effective.font}
          headline={headline}
          subheadline={subheadline}
          showTrust={showTrust}
          propertyName={propertyName}
          logoUrl={effective.logoUrl}
        />
        <p className="mt-2 text-[11px] leading-snug text-ink-400">
          Updates as you type. Nothing is live until you save.
        </p>
      </div>
    </form>
  );
}

const INPUT =
  "w-full rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[13px] text-ink-900 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-ink-700">{label}</label>
      {hint && <p className="mb-1.5 mt-0.5 text-[11px] leading-snug text-ink-400">{hint}</p>}
      {!hint && <div className="h-1.5" />}
      {children}
    </div>
  );
}

function Reset({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Back to inherited"
      aria-label="Back to inherited"
      className="shrink-0 cursor-pointer rounded-md border border-surface-border bg-white p-1.5 text-ink-500 transition-colors hover:text-ink-900"
    >
      <RotateCcw className="h-3.5 w-3.5" />
    </button>
  );
}

/** A three-band chip of the preset's actual tokens — quicker to read than any wording. */
function Swatch({ tokens, accent }: { tokens: { ground: string; surface: string; line: string; radius: number }; accent: string }) {
  return (
    <div
      className="flex h-9 items-center gap-1 overflow-hidden px-1.5"
      style={{ backgroundColor: `hsl(${tokens.ground})`, borderRadius: tokens.radius / 2, border: `1px solid hsl(${tokens.line})` }}
    >
      <span className="h-5 flex-1 rounded-sm" style={{ backgroundColor: `hsl(${tokens.surface})`, border: `1px solid hsl(${tokens.line})` }} />
      <span className="h-5 w-5 rounded-sm" style={{ backgroundColor: accent }} />
    </div>
  );
}
