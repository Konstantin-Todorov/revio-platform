import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { ShellProvider } from "@/components/shell/ShellContext";
import { getOperatorSession } from "@/lib/session";
import { getNotifications } from "@/lib/data";
import { FieldGuard } from "@revio/ui/field-guard";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getOperatorSession();
  if (!session) redirect("/logout");
  const { items: notifItems } = await getNotifications();

  return (
    <ShellProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Topbar name={session.name} role={session.role} notifItems={notifItems} />
          {/* `relative` on <main> is load-bearing: it makes <main> the containing block for its
              absolutely-positioned `sr-only` descendants (amenity chips, hero shading radios). Without
              it they escape to <html>, sit at their deep static-flow position, and inflate
              documentElement.scrollHeight past the viewport — the window then scrolls into that empty
              region and drags the fixed-height shell up ("dead space / the page looks broken"). */}
          <main className="relative flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6">
            {/* Y1: instant, in-place feedback on a numeric field typed into wrongly. A number
                input HIDES invalid text (its value reads as ""), so without this a bad field looks
                merely empty — nothing objects, and the form saves a value nobody chose. */}
            <FieldGuard />
            <div className="mx-auto max-w-[1400px]">{children}</div>
          </main>
        </div>
      </div>
    </ShellProvider>
  );
}
