import { listSupportForTenant } from "@revio/db";
import { RequestsView, type MyRequestRow } from "@revio/ui/my-requests";
import { replyToSupport } from "@/lib/actions-support";
import { getSession } from "@/lib/session";
import { getProperty } from "@/lib/data";

/**
 * "Your requests": the list, and the conversation of the one in the URL. Read through this product's
 * own session, so a hotel only ever sees its own.
 */
export async function Requests({ selectedId }: { selectedId?: string }) {
  const session = await getSession();
  const requests = session ? await listSupportForTenant(session.tenantId, 50) : [];
  return (
    <RequestsView
      requests={requests as unknown as MyRequestRow[]}
      {...(selectedId ? { selectedId } : {})}
      replyAction={replyToSupport}
      locale={"en" as const}
      timeZone={(await getProperty()).timezone}
    />
  );
}
