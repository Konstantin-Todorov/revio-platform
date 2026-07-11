"use client";

import { useRef, useState } from "react";
import { Camera, X, ImageIcon } from "lucide-react";
import { setTaskPhoto } from "@/lib/actions-maintenance";

/**
 * Fault photo on a maintenance task (spec §3.8). The image is downscaled in the browser to a small
 * JPEG data URL before it's posted, so the demo stores evidence without object storage (swapped for
 * real blob storage in production). Serves the technician, HK exception reports and deposit evidence.
 */
export function TaskPhoto({ id, photoUrl }: { id: string; photoUrl: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await downscale(file, 900, 0.7);
      if (valueRef.current) valueRef.current.value = dataUrl;
      formRef.current?.requestSubmit();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form ref={formRef} action={setTaskPhoto} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <input ref={valueRef} type="hidden" name="photoUrl" defaultValue={photoUrl ?? ""} />
      {photoUrl ? (
        <>
          <button type="button" onClick={() => setPreview(true)} title="View photo" className="relative h-8 w-8 overflow-hidden rounded-md border border-surface-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Fault" className="h-full w-full object-cover" />
          </button>
          <button
            type="button"
            title="Remove photo"
            onClick={() => { if (valueRef.current) valueRef.current.value = ""; formRef.current?.requestSubmit(); }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-300 hover:bg-danger-50 hover:text-danger-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {preview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setPreview(false)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="Fault" className="max-h-[85vh] max-w-[90vw] rounded-lg" />
            </div>
          )}
        </>
      ) : (
        <label title="Attach a photo of the fault" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-surface-border text-ink-400 transition-colors hover:bg-surface-muted hover:text-ink-600">
          {busy ? <ImageIcon className="h-3.5 w-3.5 animate-pulse" /> : <Camera className="h-3.5 w-3.5" />}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      )}
    </form>
  );
}

/** Draw the image onto a canvas capped at maxDim and export a JPEG data URL. */
function downscale(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}
