"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Ruler, Users, X } from "lucide-react";
import { BED_SETUP_BY_KEY, BED_SETUP_ICON_BY_KEY, groupAmenities } from "@revio/core";
import { AmenityIcon } from "@revio/ui/amenity-icon";
import type { PublicRoomOption } from "@revio/booking";
import { useGuestKit } from "@/lib/i18n/use-kit";

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

/**
 * Anything inside the card can open the dialog — the photograph AND the "Room details" link.
 *
 * A guest's first instinct is to tap the picture; every engine they have used opens the gallery
 * when they do. The card used to answer only the small text link beside it, so the tap on the
 * photo — the most natural one — did nothing.
 */
const OpenCtx = createContext<((photo?: number) => void) | null>(null);

export function RoomDetailOpen({
  children, photo, label, className, style,
}: {
  children: React.ReactNode;
  /** Which photo to open on — the one tapped. */
  photo?: number;
  /** Accessible name when the content is only an image. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const open = useContext(OpenCtx);
  return (
    // A real box, never `display: contents` — a button without a box stops being clickable.
    <button type="button" onClick={() => open?.(photo)} aria-label={label} className={className} style={style}>
      {children}
    </button>
  );
}

export function RoomDetail({
  option,
  photos,
  children,
  rates,
  fromLabel,
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
  /** The card itself. Any `RoomDetailOpen` inside it opens the dialog. */
  children: React.ReactNode;
  /**
   * The room's rates for the guest's dates, rendered on the server by the card — the SAME rows the
   * card shows, so the dialog can never quote a different price. Choosing happens here now: the
   * dialog used to end in "Choose a rate", which closed it and left the guest to find the room
   * again in the list.
   */
  rates?: React.ReactNode;
  /** "from €272.97 total" — the cheapest rate, for the footer that stays in view. */
  fromLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const { s: t, room } = useGuestKit();
  const s = t.room;
  const groups = groupAmenities(option.amenities);
  const bed = option.bedSetup ? room.bedSetups[option.bedSetup] ?? BED_SETUP_BY_KEY[option.bedSetup] : null;

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
  const ratesRef = useRef<HTMLDivElement>(null);
  // Swipe on a phone: a horizontal flick of more than 40px changes the photo; the arrows stay for
  // everyone else (a gallery that only swipes is one a mouse or a keyboard cannot use).
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0]?.clientX ?? null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchX.current;
    touchX.current = null;
    const end = e.changedTouches[0]?.clientX;
    if (start == null || end == null || photos.length < 2) return;
    const dx = end - start;
    if (Math.abs(dx) < 40) return;
    setIndex((i) => (dx < 0 ? (i + 1) % photos.length : (i - 1 + photos.length) % photos.length));
  };

  const openAt = (photo?: number) => {
    setIndex(photo != null && photo < photos.length ? photo : 0);
    setOpen(true);
  };

  return (
    <OpenCtx.Provider value={openAt}>
      {children}

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
                    <Users size={13} aria-hidden /> {s.sleeps(option.maxGuests)}
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
                aria-label={s.close}
                className="btn btn-ghost -mr-1 min-h-[36px] px-2"
              >
                <X size={18} />
              </button>
            </header>

            {/* `overscroll-contain` stops the wheel chaining to the results behind once the gallery
                and amenity list bottom out — closing the dialog should return you to where you were
                looking, not to wherever the page drifted while you read. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {photos.length > 0 && current && (
                <div>
                  {/*
                    A FIXED stage, the whole photo shown (`contain`), and the space either side
                    filled with the same photograph, blurred.

                    The guest opened this to look at the room, so nothing may be cropped away — and a
                    fixed shape stops the dialog jumping between portrait and landscape shots. But a
                    letterbox of flat grey either side read as empty, unfinished space. Filling it
                    with the picture's own colours makes every photo look edge-to-edge without
                    cutting a centimetre of it.
                  */}
                  <div
                    className="relative aspect-[4/3] w-full touch-pan-y select-none overflow-hidden sm:aspect-[16/9]"
                    style={{ backgroundColor: "hsl(var(--ink))" }}
                    onTouchStart={onTouchStart}
                    onTouchEnd={onTouchEnd}
                  >
                    <div
                      aria-hidden
                      className="absolute inset-0 scale-125 bg-cover bg-center opacity-70 blur-2xl"
                      style={{ backgroundImage: `url("${current.thumb}")` }}
                    />
                    <img
                      src={current.full}
                      alt={current.alt || s.photoN(option.name, index + 1)}
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                    {photos.length > 1 && (
                      <>
                        <GalleryNav side="left" label={s.prevPhoto} onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)} />
                        <GalleryNav side="right" label={s.nextPhoto} onClick={() => setIndex((i) => (i + 1) % photos.length)} />
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
                          aria-label={s.photo(i + 1)}
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
                        <div className="eyebrow mb-1.5">{room.amenityGroups[g.group] ?? g.label}</div>
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
                              {room.amenities[a.key] ?? a.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {rates && (
                  <div ref={ratesRef} className="scroll-mt-4">
                    <div className="eyebrow mb-2">{s.ratesForDates}</div>
                    <div className="card overflow-hidden">{rates}</div>
                  </div>
                )}

                {/* Honest about an empty room rather than pretending: silence here is a hotel that
                    has not written its content yet, not a room with nothing in it. */}
                {!option.description && groups.length === 0 && photos.length === 0 && (
                  <p className="text-[13.5px]" style={{ color: "hsl(var(--ink-faint))" }}>
                    {s.empty}
                  </p>
                )}
              </div>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t px-5 py-3.5" style={{ borderColor: "hsl(var(--line))" }}>
              {rates ? (
                <>
                  {fromLabel && <span className="price text-[1.05rem]">{fromLabel}</span>}
                  <button
                    type="button"
                    onClick={() => ratesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="btn btn-brand shrink-0"
                  >
                    {s.seeRates}
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setOpen(false)} className="btn btn-primary w-full">
                  {s.chooseRate}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </OpenCtx.Provider>
  );
}

function GalleryNav({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full ${
        side === "left" ? "left-2" : "right-2"
      }`}
      style={{ backgroundColor: "hsl(var(--surface) / 0.92)", boxShadow: "var(--shadow-sm)" }}
    >
      {side === "left" ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  );
}

/** The link on the card: says there is more to see, and how much. */
export function RoomDetailTrigger({ label }: { label: string }) {
  return (
    <RoomDetailOpen className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] text-[13px] font-semibold">
      <span className="inline-flex items-center gap-1.5" style={{ color: "hsl(var(--brand-text))" }}>
        <Maximize2 size={13} aria-hidden />
        {label}
      </span>
    </RoomDetailOpen>
  );
}
