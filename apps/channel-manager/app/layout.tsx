import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { Lock } from "lucide-react";
import "./globals.css";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { getSession, getSwitchableProperties } from "@/lib/session";

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
  let body: React.ReactNode;

  try {
    const session = await getSession();
    const properties = (await getSwitchableProperties()).map((p) => ({ id: p.id, name: p.name, tenantName: p.tenant.name }));

    if (!session.entitlements.channelManager) {
      // Entitlement gate: this tenant didn't buy RevioLink.
      body = (
        <div className="flex h-screen flex-col items-center justify-center bg-surface-muted px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-warning-50 text-warning-600"><Lock className="h-7 w-7" /></div>
          <h1 className="text-[18px] font-bold text-ink-900">RevioLink isn’t enabled for {session.tenantName}</h1>
          <p className="mt-1.5 max-w-sm text-[13px] text-ink-500">This workspace hasn’t subscribed to the Channel Manager. Enable it from the Operator Console.</p>
        </div>
      );
    } else {
      body = (
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar properties={properties} activeId={session.activePropertyId} activeName={properties.find((p) => p.id === session.activePropertyId)?.name ?? session.tenantName} role={session.role} />
            <main className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mx-auto max-w-[1400px]">{children}</div>
            </main>
          </div>
        </div>
      );
    }
  } catch {
    body = (
      <div className="flex h-screen items-center justify-center bg-surface-muted text-[14px] text-ink-500">
        No data yet — run <code className="mx-1 rounded bg-surface-sunken px-1.5 py-0.5">pnpm --filter @revio/db db:seed</code> to set up the demo.
      </div>
    );
  }

  return (
    <html lang="en" className={hanken.variable}>
      <body>{body}</body>
    </html>
  );
}
