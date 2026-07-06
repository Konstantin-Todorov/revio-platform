import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { ShellProvider } from "@/components/shell/ShellContext";
import { getOperatorSession } from "@/lib/session";
import { getNotifications } from "@/lib/data";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getOperatorSession();
  if (!session) redirect("/logout");
  const { items: notifItems } = await getNotifications();

  return (
    <ShellProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar name={session.name} role={session.role} notifItems={notifItems} />
          <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6">
            <div className="mx-auto max-w-[1400px]">{children}</div>
          </main>
        </div>
      </div>
    </ShellProvider>
  );
}
