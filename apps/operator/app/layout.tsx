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
