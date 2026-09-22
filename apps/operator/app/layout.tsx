import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { DatePickerAffordance } from "@revio/ui/date-picker-affordance";

/*
  ⚠️ `next/font/local`, not `next/font/google` — the bytes are in the repository.

  `next/font/google` self-hosts what it ships, so runtime was never the issue. It fetches from
  Google at BUILD time, on every build, and CI has no Next cache. On 2026-09-22 that fetch failed
  and took the whole deploy with it: `TypeError: Cannot read properties of null (reading '1')`
  inside Next's font loader, on a commit with nothing wrong in it.

  One variable file covers 400–800, which is why five static weights became two files. Refresh them
  with `node scripts/fetch-fonts.mjs`; the subsets taken and not taken are explained there.
*/
const hanken = localFont({
  src: [
    { path: "./fonts/hanken-grotesk-latin.woff2", style: "normal", weight: "400 800" },
    { path: "./fonts/hanken-grotesk-latin-ext.woff2", style: "normal", weight: "400 800" },
  ],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Revio Operator",
  description: "Revio · operator console · all hotels",
};


/**
 * Stated rather than inherited.
 *
 * Next.js supplies `width=device-width, initial-scale=1` by default, which is correct — but a
 * default is not a decision, and the one thing that must never appear here is a `maximumScale: 1`
 * added by somebody trying to stop a phone zooming on focus. Writing it out makes the intent
 * reviewable and lets `zoom:lint` check it.
 *
 * `maximumScale: 5` keeps magnification available: WCAG 1.4.4, and a housekeeper reading a room
 * number on a cracked phone screen.
 */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={hanken.variable}>
      <body>
        {children}
        {/* One listener: every native date field opens its picker from anywhere on it. */}
        <DatePickerAffordance />
      </body>
    </html>
  );
}
