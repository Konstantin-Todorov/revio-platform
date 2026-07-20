import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { MobileMenuButton } from "./MobileMenuButton";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { TopbarSearch } from "./TopbarSearch";

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
      {/* Global search — rooms, rates, channels, reservations (hidden on the Calendar, spec §2.4). */}
      <TopbarSearch />

      <div className="ml-auto">
        <WorkspaceSwitcher properties={properties} activeId={activeId} activeName={activeName} />
      </div>

      <NotificationBell items={notifItems} />
      <UserMenu userName={userName} roleLabel={ROLE_LABEL[role] ?? role} />
    </header>
  );
}
