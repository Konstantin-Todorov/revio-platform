"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ImageUp, Info, Trash2, Check, AlertCircle } from "lucide-react";
import { HERO_OVERLAY_LEVELS, heroScrim, measureHeroLuminance } from "@revio/core";
import { uploadBookingHero, removeBookingHero, type LookResult } from "@/lib/actions-booking-engine";

/**
 * The hotel's own photograph behind the headline on its booking page.
 *
 * Its own card rather than a field inside the appearance form, for the same reason the logo is: an
 * upload is a separate request with a separate failure mode, and a `<form>` inside a `<form>` makes
 * the browser submit the wrong one — a bug this codebase has shipped once already.
 *
 * The two things a hotel actually gets wrong with a background are handled here rather than left to
 * them to notice: **the crop** (a wide band cuts the roof off a building shot) and **the contrast**
 * (a bright photo swallows white text). The second one is not a preference — the darkening is
 * measured from the picture, and the hotel's control only moves it *further* than readable, never
 * back. See `packages/core/src/booking/hero.ts`.
 */

export interface HeroState {
  /** The stored image, if any. Null means the page uses the preset's own hero. */
  url: string | null;
  focalY: number;
  overlay: string;
  /** 0–1000, measured server-side at upload. Null for an image that predates the measurement. */
  luminance: number | null;
}

export function HeroPicker({
  saved,
  headline,
  propertyName,
  saveSettings,
}: {
  saved: HeroState;
  /** The hotel's real headline, so the contrast is judged on the words that will actually be there. */
  headline: string;
  propertyName: string;
  saveSettings: (prev: LookResult | null, fd: FormData) => Promise<LookResult>;
}) {
  const [upload, uploadAction, uploading] = useActionState<LookResult | null, FormData>(uploadBookingHero, null);
  const [settings, settingsAction, savingSettings] = useActionState<LookResult | null, FormData>(saveSettings, null);

  const [focalY, setFocalY] = useState(saved.focalY);
  const [overlay, setOverlay] = useState(saved.overlay);
  const [picked, setPicked] = useState<{ url: string; luminance: number | null } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The picked file wins while it is on screen: the hotel is looking at what they are about to
  // commit to, not at what is already live.
  const shownUrl = picked?.url ?? saved.url;
  const shownLuminance = picked ? picked.luminance : saved.luminance;
  const scrim = heroScrim(shownLuminance, overlay);

  // A picked file survives only until the upload lands; after that the saved image IS the preview,
  // and holding on to the blob would show the pre-upload version of an image that has been re-encoded.
  useEffect(() => {
    if (upload?.ok) {
      setPicked(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [upload?.ok]);

  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked.url); }, [picked]);

  async function onPick(file: File | undefined) {
    setLocalError(null);
    if (picked) URL.revokeObjectURL(picked.url);
    if (!file) return setPicked(null);

    if (file.size > 25 * 1024 * 1024) {
      setLocalError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 25 MB.`);
      setPicked(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    const measured = await inspect(url);
    if (!measured) {
      setLocalError("We couldn’t read that image. Please try a JPEG, PNG or WebP.");
      URL.revokeObjectURL(url);
      setPicked(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // Said now rather than after a 6 MB upload and a server round-trip. The server checks the same
    // two things again — this is so the hotel hears about it immediately, not instead of the real check.
    const problem =
      measured.width < 1200
        ? `That image is ${measured.width}px wide. A background needs at least 1200px — it spans the whole page.`
        : measured.width < measured.height
          ? "That photo is taller than it is wide, so most of it would be cropped away. Please use a landscape one."
          : null;
    if (problem) {
      setLocalError(problem);
      URL.revokeObjectURL(url);
      setPicked(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setPicked({ url, luminance: measured.luminance });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          <form action={uploadAction} className="space-y-2">
            <input
              ref={inputRef}
              type="file"
              name="hero"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void onPick(e.target.files?.[0])}
              className="block w-full max-w-[360px] text-[12px] text-ink-600 file:mr-2 file:rounded-md file:border file:border-surface-border file:bg-white file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold file:text-ink-700 hover:file:bg-surface-muted"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={uploading || !picked}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-default disabled:opacity-50"
              >
                <ImageUp className="h-3.5 w-3.5" />
                {uploading ? "Uploading…" : saved.url ? "Replace background" : "Use this background"}
              </button>
              {upload?.ok && !uploading && (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-success-600">
                  <Check className="h-3.5 w-3.5" /> Saved — it’s on your page now
                </span>
              )}
            </div>
          </form>

          <p className="max-w-[46ch] text-[11.5px] leading-snug text-ink-500">
            A wide photograph of your hotel — the terrace, the pool, the view. JPEG, PNG or WebP, at
            least 1200px wide. We resize it, so a large photo straight from a camera is fine.
          </p>

          {(localError || upload?.error) && (
            <p className="flex max-w-[52ch] items-start gap-1.5 rounded-md bg-danger-50 px-3 py-2 text-[12px] font-medium text-danger-600">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{localError ?? upload?.error}</span>
            </p>
          )}

          {shownUrl && (
            <form action={settingsAction} className="space-y-4 border-t border-surface-border/60 pt-4">
              {/*
                Both controls post inside THIS form rather than the appearance form below. They are
                settings about the image and belong next to it — and the preview that makes them
                judgeable is right here.
              */}
              <div>
                <label htmlFor="hero-focal" className="block text-[12px] font-semibold text-ink-700">
                  What to keep in frame
                </label>
                <p className="mb-2 mt-0.5 max-w-[46ch] text-[11px] leading-snug text-ink-400">
                  A background is a wide band, so something is always cropped. Slide until the part
                  that matters — the roofline, the horizon — is showing.
                </p>
                <div className="flex max-w-[360px] items-center gap-2.5">
                  <span className="text-[10.5px] font-semibold text-ink-400">Top</span>
                  <input
                    id="hero-focal"
                    type="range"
                    name="bookingHeroFocalY"
                    min={0}
                    max={100}
                    step={1}
                    value={focalY}
                    onChange={(e) => setFocalY(Number(e.target.value))}
                    className="h-1.5 flex-1 cursor-pointer accent-brand-700"
                  />
                  <span className="text-[10.5px] font-semibold text-ink-400">Bottom</span>
                </div>
              </div>

              <fieldset>
                <legend className="text-[12px] font-semibold text-ink-700">How dark to shade it</legend>
                <p className="mb-2 mt-0.5 max-w-[52ch] text-[11px] leading-snug text-ink-400">
                  Your words sit on top of this photo, so it needs some shading to stay readable. We
                  measure your picture and apply the least that works — these choices go darker than
                  that, never lighter.
                </p>
                <div className="grid grid-cols-1 max-w-[520px] gap-1.5 sm:grid-cols-3">
                  {HERO_OVERLAY_LEVELS.map((level) => (
                    <label
                      key={level.key}
                      className={`cursor-pointer rounded-lg border p-2.5 transition-colors ${
                        overlay === level.key
                          ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                          : "border-surface-border bg-white hover:border-ink-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="bookingHeroOverlay"
                        value={level.key}
                        checked={overlay === level.key}
                        onChange={() => setOverlay(level.key)}
                        className="sr-only"
                      />
                      <span className="block text-[12.5px] font-bold text-ink-900">{level.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-ink-500">{level.blurb}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/*
                The one honest thing to say about a control that is doing nothing. On a dark
                photograph the minimum IS zero, so "Show the photo" changes nothing — and a control
                that appears dead needs to explain itself rather than look broken.
              */}
              <p className="flex max-w-[52ch] items-start gap-1.5 text-[11px] leading-snug text-ink-400">
                <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>
                  {scrim.floor === 0
                    ? "Your photo is dark enough to carry white text on its own, so the minimum adds nothing."
                    : `Your photo needs at least ${Math.round(scrim.floor * 100)}% shading for the text to stay readable${
                        scrim.atFloor ? " — that is what you have selected." : `; you have selected ${Math.round(scrim.alpha * 100)}%.`
                      }`}
                </span>
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  disabled={savingSettings}
                  className="cursor-pointer rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                >
                  {savingSettings ? "Saving…" : "Save background settings"}
                </button>
                {settings?.ok && !savingSettings && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-success-600">
                    <Check className="h-3.5 w-3.5" /> Saved
                  </span>
                )}
                {settings?.error && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-danger-600">
                    <AlertCircle className="h-3.5 w-3.5" /> {settings.error}
                  </span>
                )}
              </div>
            </form>
          )}
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 text-[11.5px] font-semibold text-ink-500">
            {picked ? "About to be saved" : "On your page"}
          </div>
          <HeroPreview
            url={shownUrl}
            focalY={focalY}
            alpha={scrim.alpha}
            headline={headline}
            propertyName={propertyName}
          />
          {shownUrl && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {saved.url && !picked && (
                /* Its own form: removing is not part of uploading, and one button per request keeps
                   the two failure modes separable. */
                <form action={removeBookingHero}>
                  <button
                    type="submit"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted hover:text-ink-900"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove background
                  </button>
                </form>
              )}
              {picked && (
                <button
                  type="button"
                  onClick={() => void onPick(undefined)}
                  className="cursor-pointer rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted"
                >
                  Keep what I had
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The hero band as a guest will see it: the crop, the shading, and real words on top of both. */
function HeroPreview({
  url, focalY, alpha, headline, propertyName,
}: {
  url: string | null;
  focalY: number;
  alpha: number;
  headline: string;
  propertyName: string;
}) {
  if (!url) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed border-surface-border bg-surface-muted px-4 text-center text-[11.5px] leading-snug text-ink-400">
        No background yet. Your page uses the colour and shape from the base you picked below.
      </div>
    );
  }

  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-surface-border">
      {/* eslint-disable-next-line @next/next/no-img-element -- a hotel-uploaded photo of unknown origin */}
      <img
        src={url}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: `50% ${focalY}%` }}
      />
      <div className="absolute inset-0 bg-black" style={{ opacity: alpha }} aria-hidden />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
        <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/75">
          Official booking · {propertyName}
        </span>
        <span className="mt-1.5 text-[17px] font-extrabold leading-tight tracking-[-0.03em] text-white">
          {headline}
        </span>
        <span className="mt-3 h-6 w-[78%] rounded-md bg-white/95 shadow-sm" />
      </div>
    </div>
  );
}

/**
 * Read a picked file's shape and brightness in the browser, before it is uploaded.
 *
 * The brightness uses **the same `measureHeroLuminance` the server calls** — not a lookalike — so
 * the shading in the preview is the shading the page will get, give or take the difference between
 * the browser's downscaler and sharp's. The server re-measures on upload and its answer is the one
 * that is stored; this exists so the hotel can judge a photo before committing to a 6 MB upload.
 */
async function inspect(url: string): Promise<{ width: number; height: number; luminance: number | null } | null> {
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = url;
  });
  if (!img || !img.naturalWidth) return null;

  const size = 32;
  let luminance: number | null = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      // Flattened onto white first, exactly as the server does — a transparent PNG is painted over
      // whatever is behind it, and on this page that is light.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      luminance = measureHeroLuminance(ctx.getImageData(0, 0, size, size).data, 4);
    }
  } catch {
    // A tainted canvas or a browser without getImageData. The shading preview degrades to the
    // worst-case assumption rather than the feature refusing to work.
    luminance = null;
  }

  return { width: img.naturalWidth, height: img.naturalHeight, luminance };
}
