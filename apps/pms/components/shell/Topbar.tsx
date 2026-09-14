import type { NotificationFeed } from "@revio/core";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { MobileMenuButton } from "./MobileMenuButton";
import { TopbarSearch } from "./TopbarSearch";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import type { ProductLink, ProductUpsell } from "@revio/ui/product-links";

type Property = { id: string; name: string; tenantName: string };

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", admin: "Admin", revenue_manager: "Revenue Mgr",
  distribution_manager: "Distribution", read_only: "Read-only",
};

export function Topbar({
  properties, activeId, activeName, role, userName, feed, timeZone, products, upsells,
}: {
  properties: Property[];
  activeId: string;
  activeName: string;
  role: string;
  userName: string;
  products: ProductLink[];
  upsells: ProductUpsell[];
  feed: NotificationFeed;
  timeZone: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-surface-border bg-white/95 px-4 backdrop-blur lg:gap-4 lg:px-6">
      <MobileMenuButton />
      <TopbarSearch />

      <div className="ml-auto">
        <WorkspaceSwitcher properties={properties} activeId={activeId} activeName={activeName} />
      </div>

      <NotificationBell initial={feed} timeZone={timeZone} />
      <UserMenu products={products} upsells={upsells} userName={userName} roleLabel={ROLE_LABEL[role] ?? role} />
    </header>
  );
}
