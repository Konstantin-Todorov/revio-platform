import { Globe, Bell, LogOut } from "lucide-react";
import { MobileMenuButton } from "./MobileMenuButton";
import { logout } from "@/lib/actions-auth";

const ROLE_LABEL: Record<string, string> = { super_admin: "Super-admin", support: "Support" };

export function Topbar({ name, role }: { name: string; role: string }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "RO";
  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-surface-border bg-white/95 px-4 backdrop-blur lg:gap-4 lg:px-6">
      <MobileMenuButton />
      <div className="flex items-center gap-2 rounded-md bg-surface-muted px-3 py-1.5 text-[12.5px] font-semibold text-ink-700">
        <Globe className="h-4 w-4 text-brand-600" /> All hotels
      </div>

      <button type="button" aria-label="Notifications" className="ml-auto relative flex h-9 w-9 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-surface-muted">
        <Bell className="h-[18px] w-[18px]" />
      </button>

      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-900 text-[12px] font-bold text-white">{initials}</div>
        <div className="hidden leading-tight sm:block">
          <div className="text-[12.5px] font-semibold text-ink-900">{name}</div>
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
