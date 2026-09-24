import type { ReactNode } from "react";
import { listSupportForTenant } from "@revio/db";
import { HelpFrame, helpCounts } from "@revio/ui/help-frame";
import { getSession } from "@/lib/session";
import { i18n } from "@/lib/i18n/server";

/** Help and Your requests, side by side like Settings — see `HelpFrame`. */
export default async function HelpLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const rows = session ? await listSupportForTenant(session.tenantId, 50) : [];
  return (
    <HelpFrame productName="RevioPMS" counts={helpCounts(rows)} locale={(await i18n()).locale}>
      {children}
    </HelpFrame>
  );
}
