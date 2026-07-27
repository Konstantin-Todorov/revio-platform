"use client";

import { BOOKING_PRESETS, BOOKING_COPY_DEFAULTS } from "@revio/core";

/**
 * A miniature of the guest's page that redraws as you change the controls.
 *
 * It reads the same `BOOKING_PRESETS` tokens the real page renders from, so the two cannot drift
 * into disagreement — a preview that approximates the result is worse than no preview, because it
 * teaches the hotel to expect something they will not get.
 *
 * Client-side and driven by the live form values rather than the saved row: the point is to see the
 * change BEFORE committing to it. The email settings screen only previews what is already saved,
 * which is exactly why its typeface control felt broken.
 */

export function EnginePreview({
  preset, color, font, headline, subheadline, showTrust, propertyName, logoUrl,
}: {
  preset: string;
  color: string;
  font: string;
  headline: string;
  subheadline: string;
  showTrust: boolean;
  propertyName: string;
  logoUrl: string | null;
}) {
  const p = (BOOKING_PRESETS.find((x) => x.key === preset) ?? BOOKING_PRESETS[0]!).tokens;
  const brand = color.trim() || "#1E3A8A";
  const ink = readableInk(brand);
  const solid = p.hero === "solid";
  const display = font === "serif" ? "Georgia, 'Times New Roman', serif" : "inherit";

  return (
    <div
      className="overflow-hidden rounded-xl border border-surface-border"
      style={{ backgroundColor: hsl(p.ground) }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ backgroundColor: hsl(p.surface), borderColor: hsl(p.line) }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-4 w-auto max-w-[90px] object-contain object-left" />
        ) : (
          <span className="truncate text-[11px] font-bold" style={{ color: hsl(p.ink), fontFamily: display }}>
            {propertyName}
          </span>
        )}
        <span className="text-[8px] font-semibold" style={{ color: hsl(p.inkFaint) }}>Official site</span>
      </div>

      {/* Hero */}
      <div
        className="px-4 py-5 text-center"
        style={
          solid
            ? { backgroundColor: brand }
            : p.hero === "wash"
              ? { background: `linear-gradient(${brand}1F, ${hsl(p.ground)} 70%)` }
              : {}
        }
      >
        <div
          className="text-[7px] font-bold uppercase tracking-[0.14em]"
          style={{ color: solid ? `${ink}B3` : hsl(p.inkFaint) }}
        >
          Official booking
        </div>
        <div
          className="mt-1.5 text-[15px] font-extrabold leading-tight"
          style={{ color: solid ? ink : hsl(p.ink), fontFamily: display, letterSpacing: font === "serif" ? "-0.01em" : "-0.035em", fontWeight: font === "serif" ? 400 : 800 }}
        >
          {headline.trim() || BOOKING_COPY_DEFAULTS.headline}
        </div>
        <div
          className="mx-auto mt-1.5 max-w-[26ch] text-[7.5px] leading-relaxed"
          style={{ color: solid ? `${ink}D9` : hsl(p.inkSoft) }}
        >
          {(subheadline.trim() || BOOKING_COPY_DEFAULTS.subheadline).slice(0, 110)}…
        </div>

        {/* Search bar */}
        <div
          className="mx-auto mt-3 flex max-w-[240px] items-stretch gap-1 p-1 shadow-sm"
          style={{ backgroundColor: hsl(p.surface), borderRadius: p.radius, border: `1px solid ${hsl(p.line)}` }}
        >
          {["Check in", "Check out", "Guests"].map((l) => (
            <div key={l} className="flex-1 px-1.5 py-1 text-left">
              <div className="text-[5.5px] font-bold uppercase tracking-wider" style={{ color: hsl(p.inkFaint) }}>{l}</div>
              <div className="mt-0.5 h-1 w-3/4 rounded-full" style={{ backgroundColor: hsl(p.lineStrong) }} />
            </div>
          ))}
          <div
            className="flex items-center px-2.5 text-[7px] font-bold"
            style={{ backgroundColor: brand, color: ink, borderRadius: Math.max(4, p.radius - 4) }}
          >
            Search
          </div>
        </div>
      </div>

      {/* Trust row */}
      {showTrust && (
        <div className="grid grid-cols-3 gap-1.5 px-4 pb-4 pt-3">
          {["No booking fees", "Nothing charged today", "Live availability"].map((t) => (
            <div
              key={t}
              className="p-1.5"
              style={{ backgroundColor: hsl(p.surface), border: `1px solid ${hsl(p.line)}`, borderRadius: Math.max(6, p.radius - 4) }}
            >
              <div className="h-2 w-2 rounded" style={{ backgroundColor: `${brand}33` }} />
              <div className="mt-1 text-[6.5px] font-bold leading-tight" style={{ color: hsl(p.ink) }}>{t}</div>
            </div>
          ))}
        </div>
      )}

      {/* One room result, so the hotel sees a price on the preset too. */}
      <div className="px-4 pb-4">
        <div
          className="flex items-center justify-between px-2.5 py-2"
          style={{ backgroundColor: hsl(p.surface), border: `1px solid ${hsl(p.line)}`, borderRadius: p.radius }}
        >
          <div>
            <div className="text-[8px] font-bold" style={{ color: hsl(p.ink), fontFamily: display }}>Deluxe Double</div>
            <div className="mt-0.5 text-[6.5px]" style={{ color: hsl(p.inkFaint) }}>Sleeps 2 · Breakfast</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[10px] font-extrabold" style={{ color: hsl(p.ink) }}>€282.98</div>
              <div className="text-[6px]" style={{ color: hsl(p.inkFaint) }}>total</div>
            </div>
            <div
              className="px-2 py-1 text-[7px] font-bold"
              style={{ backgroundColor: brand, color: ink, borderRadius: Math.max(4, p.radius - 4) }}
            >
              Select
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const hsl = (triplet: string) => `hsl(${triplet})`;

/**
 * Black or white on the brand colour, by relative luminance.
 *
 * Mirrors the rule the live page applies, so the preview never promises a legible button the real
 * page will not deliver. Kept simple here on purpose — the page itself does the full walk-down
 * search; this only has to agree on which end of the scale the label sits.
 */
function readableInk(hex: string): string {
  const clean = hex.replace(/^#/, "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return "#ffffff";
  const lin = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  const lum = 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
  return lum > 0.36 ? "#131825" : "#ffffff";
}
