import { listSupportForTenant } from "@revio/db";
import { HelpCentre } from "@revio/ui/help-centre";
import { MyRequests, type MyRequestRow } from "@revio/ui/my-requests";
import { replyToSupport } from "@/lib/actions-support";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Help, and everything you have asked us.
 *
 * One page rather than two: somebody who cannot find an answer is about to ask, and somebody
 * checking on a question they asked yesterday looks in the same place. Splitting them would put the
 * thing they want behind a guess about which door to use.
 *
 * ## What comes first depends on whether we owe them an answer
 *
 * The articles led unconditionally, so a hotel waiting on us scrolled past sixteen of them to find
 * out whether we had replied — reported as "the cases are hard to find", and they were. Ordering
 * fixes it without splitting the page: **an open request is the first thing on the screen**, and the
 * articles lead only when nothing is outstanding, which is when a hotel is browsing rather than
 * waiting.
 */
export default async function HelpPage() {
  const session = await getSession();
  const requests = session ? await listSupportForTenant(session.tenantId, 25) : [];
  // `handledAt` is null while it is our turn — the same definition the operator's queue uses, so
  // the two sides can never disagree about who is waiting for whom.
  const awaitingUs = requests.some((r) => r.handledAt === null);

  const help = <HelpCentre product="pms" productName="RevioPMS" />;
  const mine = (
    <MyRequests requests={requests as unknown as MyRequestRow[]} replyAction={replyToSupport} />
  );

  return (
    <div className="space-y-6">
      {awaitingUs ? (
        <>
          {mine}
          {help}
        </>
      ) : (
        <>
          {help}
          {mine}
        </>
      )}
    </div>
  );
}
