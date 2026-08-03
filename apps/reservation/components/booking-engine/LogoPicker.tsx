"use client";

import { useActionState, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { uploadBookingLogo, removeBookingLogo, type LookResult } from "@/lib/actions-booking-engine";

/**
 * The booking page's logo — inherited, or the hotel's own.
 *
 * This screen used to offer only a URL box, which was a strange thing to ask of somebody who had
 * uploaded a file two screens earlier under Guest Emails. Worse, it read the wrong column: an
 * *uploaded* email logo clears `emailLogoUrl` by design, so a hotel with a perfectly good logo in
 * the database was shown an empty field and a page with no logo on it.
 *
 * So: the same upload button as the email settings, and the inherited logo shown as a real preview
 * rather than as placeholder text claiming it exists.
 *
 * It lives OUTSIDE the appearance form deliberately. A file upload and a settings save are two
 * different requests with two different failure modes, and nesting a form inside a form makes the
 * browser submit the wrong one — a bug this codebase has already shipped once.
 */
export function LogoPicker({
  current,
  inherited,
}: {
  /** The booking engine's OWN logo, if it has one. */
  current: string | null;
  /** The email logo it falls back to. Null when the hotel has not set one anywhere. */
  inherited: string | null;
}) {
  const [state, formAction, pending] = useActionState<LookResult | null, FormData>(uploadBookingLogo, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const shown = preview ?? current ?? inherited;
  const showingInherited = !preview && !current && !!inherited;

  function onPick(file: File | undefined) {
    setLocalError(null);
    if (!file) return setPreview(null);
    // Checked again on the server by file signature — this is only so the hotel hears about it
    // before waiting for an upload, not instead of the real check.
    if (file.size > 300 * 1024) {
      setLocalError(`That image is ${Math.round(file.size / 1024)} KB — please use one under 300 KB.`);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="space-y-2.5">
      <div className="mb-1 text-[12px] font-semibold text-ink-700">Logo</div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-[68px] w-[150px] items-center justify-center overflow-hidden rounded-md border border-dashed border-surface-border bg-surface-muted">
          {shown ? (
            /* eslint-disable-next-line @next/next/no-img-element -- a hotel-uploaded logo of unknown origin */
            <img src={shown} alt="Your logo" className="max-h-[60px] max-w-[140px] object-contain" />
          ) : (
            <span className="px-2 text-center text-[11px] text-ink-400">No logo yet</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <form action={formAction} className="flex flex-col gap-1.5">
            <input
              ref={inputRef}
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(e) => onPick(e.target.files?.[0])}
              className="block w-full max-w-[280px] text-[12px] text-ink-600 file:mr-2 file:rounded-md file:border file:border-surface-border file:bg-white file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold file:text-ink-700 hover:file:bg-surface-muted"
            />
            <button
              type="submit"
              disabled={pending || !preview}
              className="inline-flex w-fit items-center gap-1.5 rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              <ImageUp className="h-3.5 w-3.5" /> {pending ? "Uploading…" : "Upload logo"}
            </button>
          </form>

          {/* Its own form: removing is not part of uploading, and one button per request keeps the
              two failure modes separable. */}
          {current && (
            <form action={removeBookingLogo}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted"
              >
                <Trash2 className="h-3.5 w-3.5" /> Use the email logo instead
              </button>
            </form>
          )}
        </div>
      </div>

      <p className="text-[11.5px] text-ink-500">
        {showingInherited
          ? "This is your email branding logo. Upload one here to give the booking page its own."
          : current
            ? "The booking page uses this. Remove it to go back to your email branding logo."
            : "PNG, JPEG, GIF or WebP, under 300 KB. Leave it empty and the page shows your hotel’s name."}
      </p>

      {(localError || state?.error) && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-[12px] font-medium text-danger-600">
          {localError ?? state?.error}
        </p>
      )}
    </div>
  );
}
