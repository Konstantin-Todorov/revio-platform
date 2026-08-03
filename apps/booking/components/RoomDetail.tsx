"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Ruler, Users, X } from "lucide-react";
import { BED_SETUP_BY_KEY, BED_SETUP_ICON_BY_KEY, groupAmenities } from "@revio/core";
import { AmenityIcon } from "@revio/ui/amenity-icon";
import type { PublicRoomOption } from "@revio/booking";

/**
 * Everything a guest wants to know before choosing this room, in one place.
 *
 * A dialog over the results rather than its own page: the guest is comparing, and a navigation
 * loses their scroll position, their dates and their place in the list. Every engine a guest has
 * already used behaves this way for exactly that reason.
 *
 * The whole thing degrades. A room with no photos, no description and no amenities still opens and
 * still shows what it costs and how many it sleeps — because a hotel goes live before its
 * copywriting, and a half-filled room must not look broken.
 */
export interface DetailPhoto {
  full: string;
  thumb: string;
  alt: string;
}

export function RoomDetail({
  option,
  photos,
  children,
}: {
  option: PublicRoomOption;
  /**
   * URLs, already built — NOT a `mediaUrl(key)` helper.
   *
   * The card that renders this is a server component and this one runs in the browser, and a
   * function cannot cross that boundary: passing the helper typechecks fine and then throws at
   * runtime. Resolving the keys on the server is also simply where that belongs.
   */
  photos: DetailPhoto[];
  /** The trigger — rendered by the caller so the card owns its own layout. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const groups = groupAmenities(option.amenities);
  const bed = option.bedSetup ? BED_SETUP_BY_KEY[option.bedSetup] : null;

  // Escape closes, and the page behind must not scroll under an open dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % Math.max(photos.length, 1));
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + photos.length) % Math.max(photos.length, 1));
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, photos.length]);

  const current = photos[index];

  return (
    <>
      {/*
        A real inline-flex box, NOT `display: contents`.

        `display: contents` removes the button's own box, and a form control without a box stops
        being interactive — the trigger rendered perfectly and simply never fired. Worth remembering:
        it typechecks, it looks right, and only a click proves it.
      */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--r-sm)] text-left"
      >
        {children}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={option.name}
          className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center"
        >
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "hsl(var(--ink) / 0.55)" }}
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <div className="pop relative z-10 flex max-h-[92vh] w-full max-w-[52rem] flex-col overflow-hidden rounded-t-[var(--r-lg)] sm:rounded-[var(--r-lg)]">
            <header className="flex items-start gap-3 border-b px-5 py-4" style={{ borderColor: "hsl(var(--line))" }}>
              <div className="min-w-0 flex-1">
                <h2 className="display text-[1.35rem] leading-tight">{option.name}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]" style={{ color: "hsl(var(--ink-soft))" }}>
                  <span className="inline-flex items-center gap-1.5">
                    <Users size={13} aria-hidden /> Sleeps {option.maxGuests}
                  </span>
                  {option.sizeSqm && (
                    <span className="inline-flex items-center gap-1.5">
                      <Ruler size={13} aria-hidden /> {option.sizeSqm} m²
                    </span>
                  )}
                  {bed && (
                    <span className="inline-flex items-center gap-1.5">
                      <AmenityIcon name={BED_SETUP_ICON_BY_KEY[option.bedSetup!]} size={13} />
                      {bed}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="btn btn-ghost -mr-1 min-h-[36px] px-2"
              >
                <X size={18} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {photos.length > 0 && current && (
                <div>
                  {/*
                    A FIXED 16:9 stage with `object-contain`, not `cover`.

                    This is the one place the whole photo matters — the guest opened it to look at
                    the room. `cover` crops to fill, which is right on a card and wrong here; and
                    letting the image set its own height made the dialog jump between portrait and
                    landscape shots, which is the distortion that was visible before.
                  */}
                  <div className="relative aspect-[16/9] w-full" style={{ backgroundColor: "hsl(var(--ink) / 0.06)" }}>
                    <img
                      src={current.full}
                      alt={current.alt || `${option.name} — photo ${index + 1}`}
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                    {photos.length > 1 && (
                      <>
                        <GalleryNav side="left" onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)} />
                        <GalleryNav side="right" onClick={() => setIndex((i) => (i + 1) % photos.length)} />
                        <span
                          className="absolute bottom-2 right-2 rounded-full px-2 py-1 text-[11px] font-semibold"
                          style={{ backgroundColor: "hsl(var(--ink) / 0.62)", color: "#fff" }}
                        >
                          {index + 1} / {photos.length}
                        </span>
                      </>
                    )}
                  </div>

                  {photos.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto px-5 py-3">
                      {photos.map((p, i) => (
                        <button
                          key={p.thumb}
                          type="button"
                          onClick={() => setIndex(i)}
                          aria-label={`Photo ${i + 1}`}
                          aria-current={i === index}
                          className="relative h-14 w-20 shrink-0 overflow-hidden rounded-[var(--r-sm)]"
                          style={{ outline: i === index ? "2px solid hsl(var(--brand))" : "none", outlineOffset: "1px" }}
                        >
                          <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-5 px-5 py-5">
                {option.description && (
                  <p className="whitespace-pre-line text-[14.5px] leading-relaxed">{option.description}</p>
                )}

                {groups.length > 0 && (
                  <div className="space-y-3.5">
                    {groups.map((g) => (
                      <div key={g.group}>
                        <div className="eyebrow mb-1.5">{g.label}</div>
                        {/*
                          An icon per row, not a bullet.

                          A guest deciding between two rooms is scanning, not reading — and a
                          picture of a balcony is found in one pass where the word "Balcony" in a
                          column of thirty words is not. The label stays: an icon alone is a riddle,
                          and a hairdryer and a fan are the same drawing at 15px.
                        */}
                        <ul className="grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
                          {g.items.map((a) => (
                            <li key={a.key} className="flex items-center gap-2 text-[13.5px]">
                              <AmenityIcon
                                name={a.icon}
                                size={15}
                                className="shrink-0"
                                style={{ color: "hsl(var(--brand-text))" }}
                              />
                              {a.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {/* Honest about an empty room rather than pretending: silence here is a hotel that
                    has not written its content yet, not a room with nothing in it. */}
                {!option.description && groups.length === 0 && photos.length === 0 && (
                  <p className="text-[13.5px]" style={{ color: "hsl(var(--ink-faint))" }}>
                    The hotel hasn&apos;t added photos or a description for this room yet. Call them and
                    they will tell you everything about it.
                  </p>
                )}
              </div>
            </div>

            <footer className="border-t px-5 py-3.5" style={{ borderColor: "hsl(var(--line))" }}>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-primary w-full">
                Choose a rate for this room
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function GalleryNav({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={`absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full ${
        side === "left" ? "left-2" : "right-2"
      }`}
      style={{ backgroundColor: "hsl(var(--surface) / 0.92)", boxShadow: "var(--shadow-sm)" }}
    >
      {side === "left" ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  );
}

/** The affordance on the card: says there is more to see, and how much. */
export function RoomDetailTrigger({ photoCount }: { photoCount: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "hsl(var(--brand-text))" }}>
      <Maximize2 size={13} aria-hidden />
      {photoCount > 1 ? `Room details & ${photoCount} photos` : "Room details"}
    </span>
  );
}
