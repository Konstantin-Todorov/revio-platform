import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { getOperatorSession } from "@/lib/session";

const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", weight: ["400", "500", "600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "Revio Operator",
  description: "Revio · operator console · all hotels",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getOperatorSession();
  return (
    <html lang="en" className={hanken.variable}>
      <body>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar name={session.name} />
            <main className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mx-auto max-w-[1400px]">{children}</div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
