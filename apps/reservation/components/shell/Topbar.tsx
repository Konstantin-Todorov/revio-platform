import type { NotificationFeed } from "@revio/core";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { MobileMenuButton } from "./MobileMenuButton";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import type { ProductLink, ProductUpsell } from "@revio/ui/product-links";
import { TopbarSearch } from "./TopbarSearch";

type Property = { id: string; name: string; tenantName: string };

export function Topbar({
  properties, activeId, activeName, scope, canGroup, roleLabel, userName, feed, timeZone, products, upsells, canSwitchLanguage,
}: {
  properties: Property[];
  activeId: string;
  activeName: string;
  scope: "property" | "group";
  canGroup: boolean;
  /** Worded on the server in the reader's language. */
  roleLabel: string;
  userName: string;
  canSwitchLanguage: boolean;
  products: ProductLink[];
  upsells: ProductUpsell[];
  feed: NotificationFeed;
  timeZone: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-surface-border bg-white/95 px-4 backdrop-blur lg:gap-4 lg:px-6">
      <MobileMenuButton />
      {/* Global Search — reservations by ID, guest, phone, etc. (hidden on the Inventory Calendar, §5.5). */}
      <TopbarSearch activePropertyId={activeId} />

      <div className="ml-auto">
        <WorkspaceSwitcher properties={properties} activeId={activeId} activeName={activeName} scope={scope} canGroup={canGroup} />
      </div>

      <NotificationBell initial={feed} timeZone={timeZone} />
      <UserMenu products={products} upsells={upsells} userName={userName} roleLabel={roleLabel} canSwitchLanguage={canSwitchLanguage} />
    </header>
  );
}
