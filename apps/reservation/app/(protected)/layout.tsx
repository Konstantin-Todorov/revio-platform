import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { ShellProvider } from "@/components/shell/ShellContext";
import { getSession, getSwitchableProperties } from "@/lib/session";
import { getNotifications } from "@/lib/data";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/logout");

  if (!session.entitlements.reservation) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-surface-muted px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-warning-50 text-warning-600"><Lock className="h-7 w-7" /></div>
        <h1 className="text-[18px] font-bold text-ink-900">RevioCRS isn’t enabled for {session.tenantName}</h1>
        <p className="mt-1.5 max-w-sm text-[13px] text-ink-500">This hotel hasn’t subscribed to the Reservation System. Contact Revio to enable it.</p>
      </div>
    );
  }

  const properties = (await getSwitchableProperties(session.tenantId)).map((p) => ({ id: p.id, name: p.name, tenantName: p.tenant.name }));
  const canGroup = properties.length > 1;
  const activeName =
    session.scope === "group"
      ? "All properties"
      : properties.find((p) => p.id === session.activePropertyId)?.name ?? session.tenantName;
  const { items: notifItems } = await getNotifications();

  return (
    <ShellProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar footer={session.tenantName} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar properties={properties} activeId={session.activePropertyId} activeName={activeName} scope={session.scope} canGroup={canGroup} role={session.role} userName={session.userName} notifItems={notifItems} />
          <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6">
            {/*
              Keyed by the property in view.

              Switching hotels re-renders the server components, but React keeps every CLIENT
              component mounted at the same position — so their `useState(props)` and uncontrolled
              `defaultValue` still hold the PREVIOUS hotel's values. That is not just a stale label:
              a form pre-filled from hotel A, submitted while hotel B is selected, writes A's values
              onto B. It showed up as the booking address suggesting the wrong hotel's name, and the
              appearance form was one click away from copying one hotel's branding onto another.

              Changing the key remounts the subtree, which is exactly the intent: a different hotel
              is different data, not the same screen with new props.
            */}
            <div key={`${session.scope}:${session.activePropertyId}`} className="mx-auto max-w-[1400px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ShellProvider>
  );
}
