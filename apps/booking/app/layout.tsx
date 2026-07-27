import type { Metadata } from "next";
import { Fraunces, Karla } from "next/font/google";
import "./globals.css";

/**
 * Two families, loaded once, switched per hotel by CSS variable.
 *
 * Fraunces is a variable serif with real character (its optical size and "softness" axes make it
 * look like type rather than like a default). Karla is a grotesque with enough warmth to sit beside
 * it. Between them they cover the serif / sans / mixed choice a hotel already made for its emails,
 * so the booking page inherits that decision instead of asking again.
 */
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  // Variable weight so the SOFT axis is available — Next only allows `axes` on a variable font.
  weight: "variable",
  axes: ["SOFT", "opsz"],
  display: "swap",
});

const body = Karla({
  subsets: ["latin"],
  variable: "--font-karla",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  // Overridden per hotel; this only shows on the not-found shell.
  title: "Book direct",
  // The engine is a hotel's own booking page. Search engines should index the HOTEL's marketing
  // site, not our checkout — and a stray index would compete with the client we built it for.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
