import { Search } from "lucide-react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { MobileMenuButton } from "./MobileMenuButton";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

type Property = { id: string; name: string; tenantName: string };
type NotifItem = { text: string; href: string; tone: "danger" | "warning" | "info" | "success" };

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", admin: "Admin", revenue_manager: "Revenue Mgr",
  distribution_manager: "Distribution", read_only: "Read-only",
};

export function Topbar({
  properties, activeId, activeName, role, userName, notifItems,
}: {
  properties: Property[];
  activeId: string;
  activeName: string;
  role: string;
  userName: string;
  notifItems: NotifItem[];
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-surface-border bg-white/95 px-4 backdrop-blur lg:gap-4 lg:px-6">
      <MobileMenuButton />
      {/* Global Search — reservations by ID, guest, phone, email, company, channel, room, status. */}
      <form action="/search" method="GET" className="relative hidden flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          type="text"
          name="q"
          placeholder="Search reservations — guest, phone, email, room, status…"
          aria-label="Global search"
          className="h-9 w-full max-w-md rounded-md border border-surface-border bg-surface-muted pl-9 pr-3 text-[13px] text-ink-700 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600 focus:bg-white"
        />
      </form>

      <div className="ml-auto">
        <WorkspaceSwitcher properties={properties} activeId={activeId} activeName={activeName} />
      </div>

      <NotificationBell items={notifItems} />
      <UserMenu userName={userName} roleLabel={ROLE_LABEL[role] ?? role} />
    </header>
  );
}
