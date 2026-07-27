"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircle, GripVertical, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
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
 * Drag-and-drop is HTML5 native — no library for one list. Every tile also carries plain up/down
 * buttons, because dragging is unusable with a keyboard and awkward on a touchscreen, which is
 * exactly where a hotelier uploading from their phone will be.
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
  const [order, setOrder] = useState(photos.map((p) => p.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const reorderRef = useRef<HTMLFormElement>(null);

  // The server is the source of truth; local order only exists to make dragging feel immediate.
  const byId = new Map(photos.map((p) => [p.id, p]));
  const ordered = order.map((id) => byId.get(id)).filter((p): p is GalleryPhoto => !!p);
  for (const p of photos) if (!order.includes(p.id)) ordered.push(p);

  function commit(next: string[]) {
    setOrder(next);
    // Submitted from an effect-free handler so the optimistic order paints first.
    queueMicrotask(() => reorderRef.current?.requestSubmit());
  }

  function move(id: string, delta: number) {
    const ids = ordered.map((p) => p.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    commit(ids);
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = ordered.map((p) => p.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    setDragId(null);
    commit(ids);
  }

  return (
    <div className="space-y-3">
      <form ref={reorderRef} action={reorderRoomPhotos} className="hidden">
        <input type="hidden" name="roomTypeId" value={roomTypeId} />
        <input type="hidden" name="order" value={ordered.map((p) => p.id).join(",")} />
      </form>

      {ordered.length > 0 && (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {ordered.map((photo, i) => (
            <li
              key={photo.id}
              draggable
              onDragStart={() => setDragId(photo.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(photo.id)}
              onDragEnd={() => setDragId(null)}
              className={`group relative overflow-hidden rounded-lg border bg-white transition-opacity ${
                dragId === photo.id ? "opacity-40" : "opacity-100"
              } border-surface-border`}
            >
              <div className="relative aspect-[4/3] bg-surface-muted">
                {/* Not next/image: the src is our own already-resized WebP, so a second
                    optimisation pass would cost CPU to produce the same bytes. */}
                <img
                  src={photo.thumbUrl}
                  alt={photo.alt || `${roomTypeName} photo ${i + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-brand-800/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    <Star className="h-2.5 w-2.5 fill-current" /> Cover
                  </span>
                )}
                <span
                  className="absolute right-1.5 top-1.5 cursor-grab rounded bg-white/85 p-1 text-ink-500 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </span>
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
                <div className="flex items-center justify-between">
                  <div className="flex gap-0.5">
                    <MoveButton label="Move earlier" disabled={i === 0} onClick={() => move(photo.id, -1)}>←</MoveButton>
                    <MoveButton label="Move later" disabled={i === ordered.length - 1} onClick={() => move(photo.id, 1)}>→</MoveButton>
                  </div>
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
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={uploadAction}>
        <input type="hidden" name="roomTypeId" value={roomTypeId} />
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-surface-border bg-surface-muted/50 px-4 py-5 text-[13px] font-semibold text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-700">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {uploading ? "Uploading…" : ordered.length ? "Add more photos" : "Add photos"}
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

function MoveButton({
  label, disabled, onClick, children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="cursor-pointer rounded px-1.5 py-1 text-[12px] font-bold text-ink-500 transition-colors hover:bg-surface-muted hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
