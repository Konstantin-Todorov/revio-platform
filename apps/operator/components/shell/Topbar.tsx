import type { NotificationFeed } from "@revio/core";
import { MobileMenuButton } from "./MobileMenuButton";
import { TopbarSearch } from "./TopbarSearch";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

const ROLE_LABEL: Record<string, string> = { super_admin: "Super-admin", support: "Support" };

export function Topbar({ name, role, feed, timeZone }: { name: string; role: string; feed: NotificationFeed; timeZone: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-surface-border bg-white/95 px-4 backdrop-blur lg:gap-4 lg:px-6">
      <MobileMenuButton />
      <TopbarSearch />

      <div className="ml-auto">
        <NotificationBell initial={feed} timeZone={timeZone} />
      </div>
      <UserMenu userName={name} roleLabel={ROLE_LABEL[role] ?? role} />
    </header>
  );
}
