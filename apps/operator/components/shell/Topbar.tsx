import { Search } from "lucide-react";
import { MobileMenuButton } from "./MobileMenuButton";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

type NotifItem = { text: string; href: string; tone: "danger" | "warning" | "info" | "success" };
const ROLE_LABEL: Record<string, string> = { super_admin: "Super-admin", support: "Support" };

export function Topbar({ name, role, notifItems }: { name: string; role: string; notifItems: NotifItem[] }) {
  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-surface-border bg-white/95 px-4 backdrop-blur lg:gap-4 lg:px-6">
      <MobileMenuButton />
      {/* Global search — clients, properties, owners. */}
      <form action="/search" method="GET" className="relative hidden flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          type="text"
          name="q"
          placeholder="Search clients, properties, owners…"
          aria-label="Search"
          className="h-9 w-full max-w-md rounded-md border border-surface-border bg-surface-muted pl-9 pr-3 text-[13px] text-ink-700 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600 focus:bg-white"
        />
      </form>

      <div className="ml-auto">
        <NotificationBell items={notifItems} />
      </div>
      <UserMenu userName={name} roleLabel={ROLE_LABEL[role] ?? role} />
    </header>
  );
}
