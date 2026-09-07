import { listSupportForTenant } from "@revio/db";
import { HelpCentre } from "@revio/ui/help-centre";
import { MyRequests, type MyRequestRow } from "@revio/ui/my-requests";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Help, and everything you have asked us.
 *
 * One page rather than two: somebody who cannot find an answer is about to ask, and somebody
 * checking on a question they asked yesterday looks in the same place. Splitting them would put the
 * thing they want behind a guess about which door to use.
 */
export default async function HelpPage() {
  const session = await getSession();
  const requests = session ? await listSupportForTenant(session.tenantId, 25) : [];

  return (
    <div className="space-y-6">
      <HelpCentre product="cm" productName="RevioLink" />
      <MyRequests requests={requests as unknown as MyRequestRow[]} />
    </div>
  );
}
