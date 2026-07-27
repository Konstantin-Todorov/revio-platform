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
   * For TEXT set in the brand colour on the paper background — a headline, a small dash.
   *
   * It has to be a separate token: a mid-lightness brand colour (a gold, a sky blue) makes a
   * perfectly good button but an unreadable headline, and one value cannot serve both jobs. This is
   * the same hue, darkened until it actually reads against the page.
   */
  brandText: string;
}

const DEFAULT: BrandTokens = { brand: "202 45% 24%", brandInk: "0 0% 100%", brandText: "202 45% 24%" };

export function brandTokens(hex: string | null | undefined): BrandTokens {
  const rgb = parseHex(hex);
  if (!rgb) return DEFAULT;

  const { h, s, l } = rgbToHsl(rgb);

  // A very light or very desaturated "brand" colour cannot carry a primary button. Rather than
  // render something illegible, deepen it — the hotel still reads as itself, but the page works.
  const usableL = l > 62 ? Math.max(28, l - 26) : l;

  // Text on paper needs to be genuinely dark; 42% is where a saturated hue starts passing WCAG AA
  // against our off-white ground. Saturation is nudged up so the darkened colour keeps its identity
  // instead of drifting toward grey.
  const textL = Math.min(usableL, 42);
  const textS = textL < usableL ? Math.min(100, s + 8) : s;

  return {
    brand: `${Math.round(h)} ${Math.round(s)}% ${Math.round(usableL)}%`,
    brandInk: contrastInk(rgb, usableL),
    brandText: `${Math.round(h)} ${Math.round(textS)}% ${Math.round(textL)}%`,
  };
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
 * Black or white text on this colour, whichever the eye can actually read. Uses relative luminance
 * (WCAG) rather than lightness, because a saturated yellow and a saturated blue can share an L value
 * while differing enormously in perceived brightness.
 */
function contrastInk(rgb: { r: number; g: number; b: number }, adjustedL: number): string {
  // Approximate the lightness adjustment applied above so the ink matches the colour we'll paint.
  const scale = adjustedL / Math.max(1, rgbToHsl(rgb).l);
  const lin = (c: number) => {
    const v = Math.min(255, c * scale) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  // 0.36 sits near the crossover where white stops being the more readable choice.
  return luminance > 0.36 ? "30 8% 12%" : "0 0% 100%";
}

/** The hotel's typeface choice → which loaded family drives headings. */
export function fontVars(font: string): { display: string; body: string } {
  const sans = "var(--font-karla)";
  const serif = "var(--font-fraunces)";
  if (font === "sans") return { display: sans, body: sans };
  return { display: serif, body: sans }; // serif + mixed both get the editorial pairing
}
