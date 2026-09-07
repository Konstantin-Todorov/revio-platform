import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { DatePickerAffordance } from "@revio/ui/date-picker-affordance";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  weight: ["400", "500", "600", "700", "800"],
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
