import { Bell, LogOut } from "lucide-react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { MobileMenuButton } from "./MobileMenuButton";
import { logout } from "@/lib/actions-auth";

type Property = { id: string; name: string; tenantName: string };

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", admin: "Admin", revenue_manager: "Revenue Mgr",
  distribution_manager: "Distribution", read_only: "Read-only",
};

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "U";
}

export function Topbar({
  properties, activeId, activeName, role, userName,
}: {
  properties: Property[];
  activeId: string;
  activeName: string;
  role: string;
  userName: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-surface-border bg-white/95 px-4 backdrop-blur lg:gap-4 lg:px-6">
      <MobileMenuButton />
      <div className="hidden text-[13px] font-semibold text-ink-400 md:block">
        Operations · <span className="text-ink-700">{activeName}</span>
      </div>

      <div className="ml-auto">
        <WorkspaceSwitcher properties={properties} activeId={activeId} activeName={activeName} />
      </div>

      <button type="button" aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-surface-muted">
        <Bell className="h-[18px] w-[18px]" />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger-500 ring-2 ring-white" />
      </button>

      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-600 text-[12px] font-bold text-white">{initials(userName)}</div>
        <div className="hidden leading-tight sm:block">
          <div className="text-[12.5px] font-semibold text-ink-900">{userName}</div>
          <div className="text-[11px] text-ink-400">{ROLE_LABEL[role] ?? role}</div>
        </div>
        <form action={logout}>
          <button type="submit" aria-label="Log out" className="flex h-9 w-9 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-danger-600">
            <LogOut className="h-[17px] w-[17px]" />
          </button>
        </form>
      </div>
    </header>
  );
}
