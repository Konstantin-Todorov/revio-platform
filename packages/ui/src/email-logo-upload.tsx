"use client";

import { useActionState, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { fill, translate } from "./i18n";
import { useLocale } from "./i18n-context";
import { guestEmailsStrings } from "./guest-emails-strings";

/** What an upload action returns. `code` is said in the reader's language; `error` is the fallback. */
export type UploadResult = { ok: boolean; error?: string; code?: "none" | "tooBig" | "notImage"; kb?: number };

/**
 * Logo upload with a local preview before the file leaves the browser.
 *
 * The hotel sees the crop and proportions immediately; the server still re-checks the type by file
 * signature and the size on arrival, because nothing the browser says about a file is trustworthy.
 */
export function EmailLogoUpload({ currentUrl, uploadAction, removeAction }: {
  currentUrl: string | null;
  uploadAction: (prev: UploadResult | null, fd: FormData) => Promise<UploadResult>;
  removeAction: () => Promise<void>;
}) {
  const s = translate(guestEmailsStrings, useLocale()).logo;
  const [state, formAction, pending] = useActionState<UploadResult | null, FormData>(uploadAction, null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const shown = localPreview ?? currentUrl;

  function onPick(file: File | undefined) {
    setLocalError(null);
    if (!file) { setLocalPreview(null); return; }
    if (file.size > 300 * 1024) {
      setLocalError(fill(s.tooBig, { kb: Math.round(file.size / 1024) }));
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
            <img src={shown} alt={s.alt} className="max-h-[60px] max-w-[140px] object-contain" />
          ) : (
            <span className="px-2 text-center text-[11px] text-ink-400">{s.none}</span>
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
              <ImageUp className="h-3.5 w-3.5" /> {pending ? s.uploading : s.upload}
            </button>
            {currentUrl && (
              <button
                type="button"
                onClick={() => removeAction()}
                className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted"
              >
                <Trash2 className="h-3.5 w-3.5" /> {s.remove}
              </button>
            )}
          </div>
        </div>
      </div>

      {(localError || state?.error) && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-[12px] font-medium text-danger-600">{localError ?? (state?.code === "tooBig" ? fill(s.tooBig, { kb: state.kb ?? 0 }) : state?.code === "notImage" ? s.notImage : state?.code === "none" ? s.pick : state?.error)}</p>
      )}
      <p className="text-[11.5px] text-ink-400">
        {s.hint}
      </p>
    </form>
  );
}
