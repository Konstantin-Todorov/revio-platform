/**
 * The booking engine's visual presets — the "base" a hotel picks before editing anything.
 *
 * These live in core rather than in the booking app because TWO surfaces have to agree on them: the
 * public page renders them, and the CRS settings screen previews them. A preset defined in one and
 * approximated in the other is a settings screen that lies, which is worse than no preview at all.
 *
 * A preset only ever sets NEUTRALS and shape. It never sets the accent — that is the hotel's own
 * colour, and the whole point of the canvas staying quiet is that any accent looks deliberate on it.
 * So "pick a base, then edit" composes cleanly: the two choices cannot fight each other.
 *
 * Values are the space-separated HSL triplet form, so CSS can do `hsl(var(--ground) / 0.4)`.
 */

export interface BookingPresetTokens {
  ground: string;
  surface: string;
  surfaceSunk: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  line: string;
  lineStrong: string;
  /** Corner radius for cards, in px. Shape carries as much of a "look" as colour does. */
  radius: number;
  /**
   * How the hero reads.
   *  - `wash`  a soft radial tint of the hotel's colour fading into the page
   *  - `solid` a full-bleed band in the hotel's colour, headline reversed out of it
   *  - `plain` no hero treatment at all; the search bar carries the page
   */
  hero: "wash" | "solid" | "plain";
}

export interface BookingPreset {
  key: string;
  label: string;
  blurb: string;
  tokens: BookingPresetTokens;
}

export const BOOKING_PRESETS: readonly BookingPreset[] = [
  {
    key: "clean",
    label: "Clean",
    blurb: "Cool neutrals, white cards, a soft wash of your colour. Reads as modern and precise.",
    tokens: {
      ground: "220 24% 97%",
      surface: "0 0% 100%",
      surfaceSunk: "220 20% 96%",
      ink: "222 32% 11%",
      inkSoft: "222 12% 38%",
      inkFaint: "222 11% 46%",
      line: "220 16% 90%",
      lineStrong: "220 14% 80%",
      radius: 14,
      hero: "wash",
    },
  },
  {
    key: "warm",
    label: "Warm",
    blurb: "Sand ground, cream cards, softer corners. Reads as hospitable rather than technical.",
    tokens: {
      ground: "38 30% 96%",
      surface: "40 40% 99%",
      surfaceSunk: "38 26% 94%",
      ink: "28 18% 13%",
      inkSoft: "30 10% 36%",
      inkFaint: "30 9% 45%",
      line: "34 20% 88%",
      lineStrong: "32 18% 78%",
      radius: 18,
      hero: "wash",
    },
  },
  {
    key: "bold",
    label: "Bold",
    blurb: "Your colour as a full banner with the headline reversed out of it. Confident, high contrast.",
    tokens: {
      ground: "220 18% 96%",
      surface: "0 0% 100%",
      surfaceSunk: "220 16% 94%",
      ink: "222 40% 9%",
      inkSoft: "222 14% 34%",
      inkFaint: "222 12% 44%",
      line: "220 14% 88%",
      lineStrong: "220 12% 76%",
      radius: 10,
      hero: "solid",
    },
  },
] as const;

export const BOOKING_PRESET_BY_KEY: Record<string, BookingPreset> = Object.fromEntries(
  BOOKING_PRESETS.map((p) => [p.key, p]),
);

/** The preset for a stored key, falling back to Clean rather than rendering an unstyled page. */
export function bookingPreset(key: string | null | undefined): BookingPreset {
  return BOOKING_PRESET_BY_KEY[key ?? ""] ?? BOOKING_PRESETS[0]!;
}

/**
 * The words on the hero when a hotel has not written their own.
 *
 * Kept here rather than hardcoded in the page so the settings screen can show them as the
 * placeholder — a hotel should be able to see what they are overriding before they override it.
 */
export const BOOKING_COPY_DEFAULTS = {
  headline: "Book direct. Pay less.",
  subheadline:
    "No commission goes to a travel site, so the rate you see is the one the hotel actually wants to give you — with taxes and fees already in the number.",
} as const;

/** The typeface choices the engine offers. Narrower than the email engine's: there is no "mixed",
 *  because a booking page has almost no running prose for a body serif to differentiate. */
export const BOOKING_FONTS = [
  { key: "sans", label: "Sans", blurb: "Plus Jakarta Sans throughout. Modern, excellent for prices." },
  { key: "serif", label: "Serif headings", blurb: "Instrument Serif headings over the same body sans." },
] as const;
