import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Instrument_Serif } from "next/font/google";
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
const ui = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
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
    <html lang="en" className={`${ui.variable} ${serif.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
