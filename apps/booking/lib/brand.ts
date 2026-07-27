/**
 * Turning a hotel's brand colour into a usable design system.
 *
 * The hotel gives us one hex value. From it we derive the CSS variables the page runs on — including
 * the colour of the TEXT that sits on it, which has to be computed rather than assumed: a hotel with
 * a pale gold brand colour would get invisible white button labels if we hardcoded white.
 */

/** "H S% L%" — the space-separated triplet form, so CSS can do `hsl(var(--brand) / 0.16)`. */
export interface BrandTokens {
  /** For FILLS — buttons, rules, dots. Paired with brandInk for anything written on top of it. */
  brand: string;
  /** Text colour that is readable ON the brand fill. */
  brandInk: string;
  /**
   * For TEXT set in the brand colour on the page background — a headline, a total, a link.
   *
   * It has to be a separate token: a mid-lightness brand colour (a gold, a sky blue) makes a
   * perfectly good button but an unreadable headline, and one value cannot serve both jobs. This is
   * the same hue, darkened until it actually reads against the page.
   */
  brandText: string;
  /** Barely-there tint — selected segments, badges, the hero wash. Must stay lighter than a card. */
  brandWash: string;
  /** The mid tint — nights inside a selected date range, hover states on brand surfaces. */
  brandSoft: string;
}

const DEFAULT: BrandTokens = {
  brand: "222 60% 30%",
  brandInk: "0 0% 100%",
  brandText: "222 60% 30%",
  brandWash: "222 60% 96%",
  brandSoft: "222 45% 90%",
};

export function brandTokens(hex: string | null | undefined): BrandTokens {
  const rgb = parseHex(hex);
  if (!rgb) return DEFAULT;

  const { h, s, l } = rgbToHsl(rgb);

  const fill = readableFill(h, s, l);

  // Tints are built from the hue, not from the fill — a dark navy and a pale gold should both
  // produce a wash you can read dark text on, which means fixing lightness rather than lightening
  // the brand colour by a percentage.
  const tintS = Math.min(70, Math.max(18, s));

  // Saturation is nudged up so the darkened text colour keeps its identity instead of drifting grey.
  const textS = Math.min(100, s + 8);

  return {
    brand: `${Math.round(h)} ${Math.round(s)}% ${fill.lightness}%`,
    brandInk: fill.ink,
    brandText: `${Math.round(h)} ${Math.round(textS)}% ${readableTextL(h, textS, l, tintS)}%`,
    brandWash: `${Math.round(h)} ${Math.round(tintS)}% 96%`,
    brandSoft: `${Math.round(h)} ${Math.round(tintS)}% 89%`,
  };
}

/** The near-black used for text throughout the page (--ink). */
const DARK_INK = "222 32% 11%";
const WHITE_INK = "0 0% 100%";

/**
 * A button fill the label can actually be read on.
 *
 * The obvious approach — pick white or black by a luminance threshold — has a dead zone. A sky
 * blue, a hot pink and a mid grey all sit at a lightness where NEITHER white nor near-black reaches
 * 4.5:1, so whichever you pick is unreadable. The previous version made this worse by force-
 * darkening any pale colour by a fixed amount, which pushed bright colours *into* that dead zone.
 *
 * So instead of guessing, we walk the colour down one percent at a time and stop at the first
 * lightness where a real ink measures 4.5:1. Dark ink is preferred when it works, because it lets a
 * yellow stay yellow and a sky blue stay sky blue rather than being darkened into something the
 * hotel would not recognise.
 *
 * The second condition keeps the button visible as an object: a near-white brand colour can carry
 * black text perfectly well and still vanish into a white card, so the fill must also stay
 * distinguishable from the surface it sits on.
 */
function readableFill(h: number, s: number, l: number): { lightness: number; ink: string } {
  const darkInkLum = relativeLuminance(hslToRgb(222, 32, 11));

  for (let L = Math.round(l); L >= 12; L--) {
    const lum = relativeLuminance(hslToRgb(h, s, L));

    // Against a white card: below this the button reads as a shape, not as blank paper.
    if ((1 + 0.05) / (lum + 0.05) < 1.25) continue;

    if ((lum + 0.05) / (darkInkLum + 0.05) >= 4.5) return { lightness: L, ink: DARK_INK };
    if ((1 + 0.05) / (lum + 0.05) >= 4.5) return { lightness: L, ink: WHITE_INK };
  }
  return { lightness: 12, ink: WHITE_INK };
}

/**
 * How dark the brand colour must go before it is readable as TEXT.
 *
 * Measured, not assumed. A fixed lightness cap cannot work here: at 42% lightness a saturated blue
 * clears WCAG AA comfortably and a saturated gold sits at 2.6:1, because lightness and perceived
 * luminance are not the same thing. So we walk the colour down one percent at a time and stop at
 * the first value that actually measures 4.5:1.
 *
 * The target background is --brand-wash, not white: brand text appears on the "Best price" badge
 * and other tinted chips, and that tint is the darkest ground it ever sits on. Passing there means
 * passing everywhere else on the page.
 */
function readableTextL(h: number, s: number, startL: number, tintS: number): number {
  const bg = relativeLuminance(hslToRgb(h, tintS, 96));

  for (let L = Math.min(startL, 50); L >= 8; L--) {
    const ratio = (bg + 0.05) / (relativeLuminance(hslToRgb(h, s, L)) + 0.05);
    if (ratio >= 4.5) return L;
  }
  return 8;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: Math.round(255 * f(0)), g: Math.round(255 * f(8)), b: Math.round(255 * f(4)) };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function parseHex(hex: string | null | undefined): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const clean = hex.trim().replace(/^#/, "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * The hotel's typeface choice → the heading family AND the optical settings that go with it.
 *
 * Weight and tracking ship alongside the family because they are not independent of it. Plus Jakarta
 * Sans needs 800 and tight negative tracking to read as a headline; Instrument Serif at 400 is
 * already a display face and the same tracking would crush it. Returning one without the other is
 * how a font swap ends up looking broken.
 */
export interface FontVars {
  display: string;
  body: string;
  displayWeight: string;
  displayTracking: string;
}

export function fontVars(font: string): FontVars {
  const ui = "var(--font-ui)";
  if (font === "serif" || font === "mixed") {
    return { display: "var(--font-serif)", body: ui, displayWeight: "400", displayTracking: "-0.015em" };
  }
  return { display: ui, body: ui, displayWeight: "800", displayTracking: "-0.035em" };
}
