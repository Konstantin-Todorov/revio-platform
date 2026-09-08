import Link from "next/link";
import { getUsageReport } from "@/lib/usage";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/**
 * Which parts of the platform anybody actually opens.
 *
 * ## Why this is not a page-views chart
 *
 * A total goes up when a hotel is struggling and up when it is happy, so it decides nothing. Three
 * questions do decide things, and this screen is those three in order:
 *
 *   1. **Is anyone there?** — active people this week beside last week.
 *   2. **Which hotels have gone quiet?** — the earliest signal of a customer about to leave, and
 *      the one a renewal call has to know before it starts.
 *   3. **Which screens earn their keep?** — a screen two people opened in a month is maintenance we
 *      may not owe anybody.
 *
 * ## What it deliberately cannot tell you
 *
 * Who did what, when, or for how long. Usage is counted into a daily bucket per screen, identifiers
 * are stripped from every path before storage, and nothing after `?` is kept — so this can answer
 * "is the housekeeping board used" and can never become a record of one hotel's staff or guests. See
 * `normaliseRoute` in `@revio/core`.
 */
export default async function AnalyticsPage() {
  const u = await getUsageReport();
  const delta = u.activeUsers7d - u.activeUsersPrev7d;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Product analytics"
        subtitle="Which screens are used, by whom, and who has gone quiet"
      />

      {!u.recording && (
        <Card className="p-4">
          <p className="text-[13px] font-semibold text-ink-900">Nothing recorded yet.</p>
          <p className="mt-1 text-[12.5px] text-ink-500">
            Usage is counted from the moment somebody opens a screen in RevioLink, RevioCRS or
            RevioPMS. An empty page here means nobody has been in since this was switched on — not
            that the measurement is broken.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-400">Active people · 7 days</div>
          <div className="tnum mt-1 text-[24px] font-bold leading-none text-ink-900">{u.activeUsers7d}</div>
          <div className="mt-1.5 text-[11.5px] text-ink-500">
            {u.activeUsersPrev7d === 0 && u.activeUsers7d === 0
              ? "nobody last week either"
              : delta === 0
                ? `the same as the week before (${u.activeUsersPrev7d})`
                : `${delta > 0 ? "+" : ""}${delta} on the week before (${u.activeUsersPrev7d})`}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-400">Screens opened · 30 days</div>
          <div className="tnum mt-1 text-[24px] font-bold leading-none text-ink-900">{u.screens.length}</div>
          <div className="mt-1.5 text-[11.5px] text-ink-500">distinct screens across all products</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-400">Barely opened</div>
          <div className="tnum mt-1 text-[24px] font-bold leading-none text-ink-900">{u.quietScreens.length}</div>
          <div className="mt-1.5 text-[11.5px] text-ink-500">two views or fewer in 30 days</div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="By hotel"
          subtitle="Ordered by how many of their people were here this week"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Hotel", "People this week", "Views · 30d", "Last seen", "Bought but never opened"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {u.tenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[13px] text-ink-400">
                    No clients yet.
                  </td>
                </tr>
              )}
              {u.tenants.map((t) => (
                <tr key={t.tenantId} className="border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2.5">
                    <Link href={`/clients/${t.tenantId}`} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline">
                      {t.name}
                    </Link>
                    {t.isDemo && <span className="ml-1.5 text-[10.5px] font-semibold uppercase text-ink-400">demo</span>}
                  </td>
                  <td className="tnum px-4 py-2.5 font-semibold text-ink-900">{t.activeUsers7d}</td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{t.views30d}</td>
                  <td className="px-4 py-2.5">
                    {t.lastSeen ? (
                      t.lastSeen.toISOString().slice(0, 10)
                    ) : (
                      <span className="text-ink-400">never</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {/*
                      The one number on this screen that is worth a phone call: a product they are
                      being invoiced for and have not opened in a month.
                    */}
                    {t.unopenedProducts.length === 0 ? (
                      <span className="text-ink-300">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {t.unopenedProducts.map((p) => (
                          <StatusPill key={p} tone="warning">{p}</StatusPill>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Most used screens · 30 days" subtitle="What the product is actually for" />
          <ul className="divide-y divide-surface-border">
            {u.screens.slice(0, 15).map((s) => (
              <li key={`${s.product}${s.route}`} className="flex items-center gap-3 px-4 py-2">
                <span className="font-mono text-[12px] text-ink-800">{s.route}</span>
                <span className="text-[11px] text-ink-400">{s.productName}</span>
                <span className="ml-auto shrink-0 text-[11.5px] text-ink-500">
                  <span className="tnum font-semibold text-ink-900">{s.views}</span> · {s.tenants} hotel
                  {s.tenants === 1 ? "" : "s"}
                </span>
              </li>
            ))}
            {u.screens.length === 0 && (
              <li className="px-4 py-5 text-[13px] text-ink-400">Nothing opened yet.</li>
            )}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Barely opened · 30 days"
            subtitle="Two views or fewer — worth asking whether it should exist"
          />
          <ul className="divide-y divide-surface-border">
            {u.quietScreens.slice(0, 15).map((s) => (
              <li key={`${s.product}${s.route}`} className="flex items-center gap-3 px-4 py-2">
                <span className="font-mono text-[12px] text-ink-800">{s.route}</span>
                <span className="text-[11px] text-ink-400">{s.productName}</span>
                <span className="tnum ml-auto shrink-0 text-[11.5px] font-semibold text-ink-900">{s.views}</span>
              </li>
            ))}
            {u.quietScreens.length === 0 && (
              <li className="px-4 py-5 text-[13px] text-ink-400">
                Nothing is being ignored — every screen anybody opened was opened more than twice.
              </li>
            )}
          </ul>
          <p className="border-t border-surface-border px-4 py-2.5 text-[11.5px] text-ink-400">
            A screen nobody has <em>ever</em> opened cannot appear here — it has no row at all. This
            list is what is used rarely, not what is unused entirely.
          </p>
        </Card>
      </div>

      <p className="text-[11.5px] text-ink-400">
        Counted into one row per hotel · product · screen · day. Identifiers are stripped from every
        address before it is stored and nothing after <code>?</code> is kept, so this says which
        screens are used and can never say which guest was being looked at.
      </p>
    </div>
  );
}
