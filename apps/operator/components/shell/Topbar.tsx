import type { NotificationFeed } from "@revio/core";
import { MobileMenuButton } from "./MobileMenuButton";
import { TopbarSearch } from "./TopbarSearch";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { AppBack, CreateButton, ScreenTitle, type ChromeCreate, type ChromeStrings } from "@revio/ui/app-chrome";
import { OPERATOR_TITLES } from "@/lib/chrome";

const ROLE_LABEL: Record<string, string> = { super_admin: "Super-admin", support: "Support" };

export function Topbar({ name, role, feed, timeZone, chrome }: {
  name: string; role: string; feed: NotificationFeed; timeZone: string;
  /** "+ New", the phone's screen title and "← Back" — the shared frame in `@revio/ui/app-chrome`. */
  chrome: { create: ChromeCreate[]; strings: ChromeStrings; roots: string[] };
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-surface-border bg-white/95 px-4 backdrop-blur lg:gap-4 lg:px-6">
      <MobileMenuButton />
      <AppBack label={chrome.strings.back} roots={chrome.roots} />
      <ScreenTitle nav={OPERATOR_TITLES} fallback="Operator" />
      <TopbarSearch />
      <CreateButton items={chrome.create} t={chrome.strings} />

      <div className="ml-auto">
        <NotificationBell initial={feed} timeZone={timeZone} />
      </div>
      <UserMenu userName={name} roleLabel={ROLE_LABEL[role] ?? role} />
    </header>
  );
}
