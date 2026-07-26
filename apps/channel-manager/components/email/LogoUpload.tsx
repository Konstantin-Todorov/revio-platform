"use client";

import { useActionState, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { uploadEmailLogo, removeEmailLogo, type UploadResult } from "@/lib/actions-email";

/**
 * Logo upload with a local preview before the file leaves the browser.
 *
 * The hotel sees the crop and proportions immediately; the server still re-checks the type by file
 * signature and the size on arrival, because nothing the browser says about a file is trustworthy.
 */
export function LogoUpload({ currentUrl }: { currentUrl: string | null }) {
  const [state, formAction, pending] = useActionState<UploadResult | null, FormData>(uploadEmailLogo, null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const shown = localPreview ?? currentUrl;

  function onPick(file: File | undefined) {
    setLocalError(null);
    if (!file) { setLocalPreview(null); return; }
    if (file.size > 300 * 1024) {
      setLocalError(`That image is ${Math.round(file.size / 1024)} KB — please use one under 300 KB.`);
      setLocalPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setLocalPreview(URL.createObjectURL(file));
  }

  return (
    <form action={formAction} className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-[68px] w-[150px] items-center justify-center overflow-hidden rounded-md border border-dashed border-surface-border bg-surface-muted">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- a hotel-uploaded logo of unknown origin
            <img src={shown} alt="Your logo" className="max-h-[60px] max-w-[140px] object-contain" />
          ) : (
            <span className="px-2 text-center text-[11px] text-ink-400">No logo yet</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/gif"
            onChange={(e) => onPick(e.target.files?.[0])}
            className="block w-full max-w-[280px] text-[12px] text-ink-600 file:mr-2 file:rounded-md file:border file:border-surface-border file:bg-white file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold file:text-ink-700 hover:file:bg-surface-muted"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending || !localPreview}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              <ImageUp className="h-3.5 w-3.5" /> {pending ? "Uploading…" : "Upload logo"}
            </button>
            {currentUrl && (
              <button
                type="button"
                onClick={() => removeEmailLogo()}
                className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {(localError || state?.error) && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-[12px] font-medium text-danger-600">{localError ?? state?.error}</p>
      )}
      <p className="text-[11.5px] text-ink-400">
        PNG, JPEG or GIF, up to 300 KB. A wide logo on a transparent background works best — it sits at the top of
        every guest email. We host it for you, so it still loads years after the email was sent.
      </p>
    </form>
  );
}
