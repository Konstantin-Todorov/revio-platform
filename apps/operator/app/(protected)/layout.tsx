import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { getOperatorSession } from "@/lib/session";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getOperatorSession();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={session.name} role={session.role} />
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
