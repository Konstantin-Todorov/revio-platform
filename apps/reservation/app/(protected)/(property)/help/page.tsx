import Link from "next/link";
import { listSupportForTenant } from "@revio/db";
import { HelpCentre } from "@revio/ui/help-centre";
import { MyRequests, type MyRequestRow } from "@revio/ui/my-requests";
import { replyToSupport } from "@/lib/actions-support";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Help, and everything you have asked us — two tabs on one screen.
 *
 * ## Why tabs, and why the requests tab can lead
 *
 * These were stacked, articles first, so a hotel waiting on an answer scrolled past sixteen of them
 * to find out whether we had replied: *"the cases are hard to find"*, and they were. Reordering the
 * two blocks fixed the scrolling and introduced a worse problem — a page whose furniture moves
 * depending on state is a page nobody can build a habit on.
 *
 * Tabs keep the structure still and put the answer in the label instead: **the count is visible
 * without scrolling and without opening anything**. When we owe them a reply that tab opens first,
 * because somebody with an open case almost always came here for it — but the other tab is in the
 * same place it always is, one click away.
 *
 * Still one screen and not two pages: somebody who cannot find an answer is about to ask, and
 * somebody checking on yesterday's question looks in the same place.
 */
export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  const requests = session ? await listSupportForTenant(session.tenantId, 25) : [];

  // `handledAt` is null while it is our turn — the same definition the operator's queue uses, so the
  // two sides can never disagree about who is waiting for whom.
  const open = requests.filter((r) => r.handledAt === null).length;
  const requested = (await searchParams).tab;
  const tab = requested === "requests" || (requested !== "help" && open > 0) ? "requests" : "help";

  const tabs = [
    { key: "help", label: "Help", href: "/help?tab=help" },
    {
      key: "requests",
      label: requests.length === 0 ? "Your requests" : `Your requests (${requests.length})`,
      href: "/help?tab=requests",
    },
  ];

  return (
    <div className="space-y-5">
      <nav aria-label="Help sections" className="flex gap-1 border-b border-surface-border">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors ${
                active
                  ? "border-brand-700 text-brand-800"
                  : "border-transparent text-ink-500 hover:text-ink-900"
              }`}
            >
              {t.label}
              {/* Said in words as well as colour: how many are still with us. */}
              {t.key === "requests" && open > 0 && (
                <span className="ml-1.5 rounded-full bg-warning-50 px-1.5 py-0.5 text-[10.5px] font-bold text-warning-600">
                  {open} open
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {tab === "requests" ? (
        <MyRequests requests={requests as unknown as MyRequestRow[]} replyAction={replyToSupport} />
      ) : (
        <HelpCentre product="crs" productName="RevioCRS" />
      )}
    </div>
  );
}
