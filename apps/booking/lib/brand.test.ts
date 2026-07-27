import { describe, expect, it } from "vitest";
import { brandTokens, fontVars } from "./brand.js";

/**
 * These exist because a real WCAG failure shipped here once.
 *
 * `brandText` was clamped to a fixed 42% lightness, which passes comfortably for a navy and fails
 * at 2.6:1 for a gold — lightness and perceived luminance are not the same thing, and a hotel with a
 * yellow brand colour got an unreadable "Best price" badge. The page wears an arbitrary hotel's
 * colour on every visit, so "it looked fine on the demo hotel" is not evidence of anything.
 */

/** WCAG relative luminance, the same maths the browser's contrast checker uses. */
function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** "H S% L%" → RGB. */
function fromToken(token: string): { r: number; g: number; b: number } {
  const [h, s, l] = token.split(" ").map((p) => Number.parseFloat(p));
  const S = s! / 100;
  const L = l! / 100;
  const k = (n: number) => (n + h! / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: Math.round(255 * f(0)), g: Math.round(255 * f(8)), b: Math.round(255 * f(4)) };
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(fromToken(a)), luminance(fromToken(b))].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Deliberately awkward: pale, saturated, near-white, near-black, and every hue family. */
const HOTEL_COLOURS = [
  ["gold", "#C9A227"],
  ["yellow", "#FFE100"],
  ["navy", "#0E1F3A"],
  ["teal", "#0E7C86"],
  ["forest", "#1B4332"],
  ["burgundy", "#6E1423"],
  ["hot pink", "#FF2D95"],
  ["sky", "#7DD3FC"],
  ["lime", "#A3E635"],
  ["near white", "#FAFAF5"],
  ["near black", "#0A0A0A"],
  ["mid grey", "#808080"],
] as const;

describe("brandTokens — text legibility", () => {
  it.each(HOTEL_COLOURS)("brand text on the brand wash clears 4.5:1 for %s", (_name, hex) => {
    const t = brandTokens(hex);
    expect(contrast(t.brandText, t.brandWash)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(HOTEL_COLOURS)("brand text on a white card clears 4.5:1 for %s", (_name, hex) => {
    const t = brandTokens(hex);
    expect(contrast(t.brandText, "0 0% 100%")).toBeGreaterThanOrEqual(4.5);
  });

  it.each(HOTEL_COLOURS)("button label on the brand fill clears 4.5:1 for %s", (_name, hex) => {
    const t = brandTokens(hex);
    expect(contrast(t.brandInk, t.brand)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("brandTokens — identity", () => {
  it("keeps the hotel's hue rather than falling back to a safe grey", () => {
    // A gold hotel must still look gold once darkened, or we have quietly rebranded them.
    const gold = brandTokens("#C9A227");
    const hue = Number.parseFloat(gold.brandText.split(" ")[0]!);
    expect(hue).toBeGreaterThan(35);
    expect(hue).toBeLessThan(60);
  });

  it("leaves a pale colour pale when dark ink can carry the label", () => {
    // Sky blue does NOT need darkening — near-black text on it reads fine, and darkening it would
    // hand the hotel back a colour they did not choose. Legibility is the constraint, not darkness.
    const pale = brandTokens("#7DD3FC");
    expect(Number.parseFloat(pale.brand.split(" ")[2]!)).toBeGreaterThan(62);
    expect(pale.brandInk).toBe("222 32% 11%");
  });

  it("keeps a near-white fill distinguishable from the card it sits on", () => {
    // Black text on near-white is perfectly readable and the button still vanishes into the page,
    // so the fill has its own separation floor independent of the label.
    const t = brandTokens("#FAFAF5");
    expect(contrast(t.brand, "0 0% 100%")).toBeGreaterThanOrEqual(1.25);
  });

  it("falls back to the default for anything unparseable", () => {
    for (const bad of [null, undefined, "", "not-a-colour", "#12", "#GGGGGG"]) {
      expect(brandTokens(bad).brand).toBe("222 60% 30%");
    }
  });

  it("accepts shorthand hex the way a hotel would paste it", () => {
    expect(brandTokens("#0af")).toEqual(brandTokens("#00aaff"));
  });
});

describe("fontVars", () => {
  it("defaults to the UI sans for headings", () => {
    const v = fontVars("sans");
    expect(v.display).toBe("var(--font-ui)");
    expect(v.displayWeight).toBe("800");
  });

  it("gives a serif hotel the display serif at its own optical weight", () => {
    // 800-weight tracking on a 400-weight display serif is what makes a font swap look broken.
    for (const choice of ["serif", "mixed"]) {
      const v = fontVars(choice);
      expect(v.display).toBe("var(--font-serif)");
      expect(v.displayWeight).toBe("400");
      expect(v.body).toBe("var(--font-ui)");
    }
  });

  it("treats an unknown value as sans rather than rendering nothing", () => {
    expect(fontVars("wingdings").display).toBe("var(--font-ui)");
  });
});
