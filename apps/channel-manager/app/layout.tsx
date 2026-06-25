import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { getProperty } from "@/lib/data";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RevioLink — Channel Manager",
  description: "Revio · channel manager · keep every channel in sync",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let propertyName = "Hotel Sofia";
  try {
    propertyName = (await getProperty()).name;
  } catch {
    // DB not seeded yet — fall back to the demo name.
  }

  return (
    <html lang="en" className={hanken.variable}>
      <body>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar propertyName={propertyName} />
            <main className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mx-auto max-w-[1400px]">{children}</div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
