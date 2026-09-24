"use client";

import { useActionState, useRef } from "react";
import { AlertCircle, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { SortableList } from "@revio/ui/sortable";
import {
  deleteRoomPhoto, reorderRoomPhotos, saveRoomPhotoAlt, uploadRoomPhotos, type PhotoResult,
} from "@/lib/actions-photos";

export interface GalleryPhoto {
  id: string;
  thumbUrl: string;
  alt: string;
  width: number;
  height: number;
  byteSize: number;
}

/**
 * The room-type photo gallery.
 *
 * Order IS the meaning: the first photo is the one on the room card, so "choose the cover shot" and
 * "drag it to the front" are one action rather than a drag control plus a competing radio button.
 * The star on the first tile states the consequence instead of leaving it to be discovered.
 *
 * Reordered by dragging the handle on a tile — `SortableList` in its grid layout, the one way an
 * order changes anywhere in the platform. Pointer events, so it works with a finger on the phone a
 * hotelier uploads from; the handle is a button, so ←/→ move a tile from the keyboard.
 */
export function PhotoGallery({
  roomTypeId, roomTypeName, photos,
}: {
  roomTypeId: string;
  roomTypeName: string;
  photos: GalleryPhoto[];
}) {
  const [state, uploadAction, uploading] = useActionState<PhotoResult | null, FormData>(
    uploadRoomPhotos,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  async function reorder(ids: string[]) {
    const fd = new FormData();
    fd.set("roomTypeId", roomTypeId);
    fd.set("order", ids.join(","));
    await reorderRoomPhotos(fd);
  }

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <SortableList
          items={photos}
          layout="grid"
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
          handleLabel={(p) => `Drag to reorder ${p.alt || "this photo"}`}
          onReorder={reorder}
          render={(photo, handle, i) => (
              <div className="relative h-full overflow-hidden rounded-lg border border-surface-border bg-white">
                <div className="relative aspect-[4/3] bg-surface-muted">
                  {/* Not next/image: the src is our own already-resized WebP, so a second
                      optimisation pass would cost CPU to produce the same bytes. */}
                  <img
                    src={photo.thumbUrl}
                    alt={photo.alt || `${roomTypeName} photo ${i + 1}`}
                    className="pointer-events-none h-full w-full select-none object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                  {i === 0 && (
                    <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-brand-800/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      <Star className="h-2.5 w-2.5 fill-current" /> Cover
                    </span>
                  )}
                  <span className="absolute right-1.5 top-1.5 rounded bg-white/90 shadow-sm">{handle}</span>
                </div>

                <div className="space-y-1.5 p-2">
                  <form action={saveRoomPhotoAlt}>
                    <input type="hidden" name="id" value={photo.id} />
                    <input
                      name="alt"
                      defaultValue={photo.alt}
                      onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                      placeholder="Describe this photo"
                      aria-label={`Alt text for photo ${i + 1}`}
                      maxLength={160}
                      className="w-full rounded border border-surface-border px-1.5 py-1 text-[11.5px] text-ink-700 outline-none focus:border-brand-600"
                    />
                  </form>
                  <div className="flex items-center justify-end">
                    <form action={deleteRoomPhoto}>
                      <input type="hidden" name="id" value={photo.id} />
                      <button
                        aria-label={`Delete photo ${i + 1}`}
                        className="cursor-pointer rounded p-1 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
          )}
        />
      )}

      <form ref={formRef} action={uploadAction}>
        <input type="hidden" name="roomTypeId" value={roomTypeId} />
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-surface-border bg-surface-muted/50 px-4 py-5 text-[13px] font-semibold text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-700">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {uploading ? "Uploading…" : photos.length ? "Add more photos" : "Add photos"}
          <input
            type="file"
            name="photos"
            accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
            multiple
            disabled={uploading}
            onChange={() => formRef.current?.requestSubmit()}
            className="sr-only"
          />
        </label>
      </form>

      {state?.error && (
        <p className="flex items-start gap-1.5 text-[12px] text-danger-600">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}

      <p className="text-[11.5px] leading-snug text-ink-400">
        The first photo is what a guest sees on the room card — drag to reorder. Large images are
        resized automatically, so upload straight from your phone. No photos is fine: the room still
        shows with its name, size and what&rsquo;s included.
      </p>
    </div>
  );
}
