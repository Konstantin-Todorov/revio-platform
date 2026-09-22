import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Two families, loaded once, switched per hotel by CSS variable.
 *
 * Plus Jakarta Sans does nearly all the work. It is a geometric-humanist sans with genuinely good
 * numerals — which matters more here than anywhere else in the platform, because this page is a
 * column of prices and dates a guest reads by comparing them. Its heavy weights are tight enough to
 * carry a headline, so hierarchy comes from weight and tracking rather than from a second family.
 *
 * Instrument Serif exists only for hotels that chose a serif identity. It is a modern
 * high-contrast display face, not a book serif: it looks current at 48px and is never used for body
 * copy, which is precisely the job a hotel's wordmark needs.
 */
/*
  ⚠️ `next/font/local`, not `next/font/google` — the bytes are in the repository.

  `next/font/google` self-hosts what it ships, so runtime was never the issue. It fetches from
  Google at BUILD time, on every build, and CI has no Next cache. On 2026-09-22 that fetch failed
  and took the whole deploy with it, on a commit with nothing wrong in it. Both families here are
  chosen for specific reasons stated above, and neither choice changes: one variable file now
  covers the weight range that five static weights used to.

  Refresh with `node scripts/fetch-fonts.mjs`; the subsets taken and not taken are explained there.
*/
const jakartaSans = localFont({
  src: [
    { path: "./fonts/plus-jakarta-sans-latin.woff2", style: "normal", weight: "400 800" },
    { path: "./fonts/plus-jakarta-sans-latin-ext.woff2", style: "normal", weight: "400 800" },
  ],
  variable: "--font-ui",
  display: "swap",
});

/*
  ⚠️ Named `instrumentSerif`, not `serif`.

  `next/font/local` derives the CSS family name from this binding, so `const serif` would register
  a face called `serif` — which is a CSS GENERIC FAMILY KEYWORD. Next quotes what it emits, so it
  happens to resolve; anything that ever re-emits the value unquoted would silently get the
  browser's default serif instead of Instrument Serif, and it would look almost right. Under
  `next/font/google` the name came from the font and this could not arise.
*/
const instrumentSerif = localFont({
  src: [
    { path: "./fonts/instrument-serif-latin.woff2", style: "normal", weight: "400" },
    { path: "./fonts/instrument-serif-latin-ext.woff2", style: "normal", weight: "400" },
  ],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  // Overridden per hotel; this only shows on the not-found shell.
  title: "Book direct",
  // The engine is a hotel's own booking page. Search engines should index the HOTEL's marketing
  // site, not our checkout — and a stray index would compete with the client we built it for.
  robots: { index: false, follow: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Never lock zoom on a page someone might need to magnify to read a price.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakartaSans.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
