import { Bell, Search } from "lucide-react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

type Property = { id: string; name: string; tenantName: string };

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", admin: "Admin", revenue_manager: "Revenue Mgr",
  distribution_manager: "Distribution", read_only: "Read-only",
};

export function Topbar({
  properties, activeId, activeName, role,
}: {
  properties: Property[];
  activeId: string;
  activeName: string;
  role: string;
}) {
  const initials = ROLE_LABEL[role] === "Owner" ? "OW" : "AD";
  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-4 border-b border-surface-border bg-white/95 px-6 backdrop-blur">
      <div className="relative hidden flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          type="text"
          placeholder="Search rooms, rates, channels, reservations…"
          aria-label="Search"
          className="h-9 w-full max-w-md rounded-md border border-surface-border bg-surface-muted pl-9 pr-3 text-[13px] text-ink-700 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600 focus:bg-white"
        />
      </div>

      <div className="ml-auto">
        <WorkspaceSwitcher properties={properties} activeId={activeId} activeName={activeName} />
      </div>

      <button
        type="button"
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-surface-muted"
      >
        <Bell className="h-[18px] w-[18px]" />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger-500 ring-2 ring-white" />
      </button>

      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-800 text-[12px] font-bold text-white">
          {initials}
        </div>
        <div className="hidden leading-tight sm:block">
          <div className="text-[12.5px] font-semibold text-ink-900">Admin</div>
          <div className="text-[11px] text-ink-400">{ROLE_LABEL[role] ?? role}</div>
        </div>
      </div>
    </header>
  );
}
