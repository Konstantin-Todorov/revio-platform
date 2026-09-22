import Link from "next/link";
import { getSiteInsights, PERIODS, type Period } from "@/lib/google-insights";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { DailyBars } from "@/components/ui/DailyBars";

export const dynamic = "force-dynamic";

/**
 * How the marketing site is doing, without logging into Google.
 *
 * ## What this screen is NOT
 *
 * It is not a replacement for Analytics. It deliberately answers the normal periods — seven,
 * twenty-eight, ninety days — because that is what gets asked weekly, and anything deeper is a
 * question to take to Analytics itself. Nothing is stored: no table, no nightly job to notice has
 * stopped, and no second copy of Google's numbers to disagree with Google.
 *
 * ## ⚠️ Two honesty notes are ON the screen, not in this comment
 *
 * Search Console lags two to three days, and GA4 only counts visitors who accepted cookies. Both
 * make every number here a floor rather than a total, and a screen that quietly presents a floor as
 * a total is how somebody concludes the site is failing. They are printed where the numbers are.
 */

function Delta({ pct, previous }: { pct: number | null; previous: number }) {
  if (pct === null) {
    return <span className="text-[11.5px] text-ink-500">nothing in the period before, so no comparison</span>;
  }
  const tone = pct > 0 ? "text-emerald-700" : pct < 0 ? "text-rose-700" : "text-ink-500";
  return (
    <span className={`text-[11.5px] ${tone}`}>
      {pct > 0 ? "+" : ""}{pct}% on the period before ({previous})
    </span>
  );
}

export default async function WebsitePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const raw = Number((await searchParams).days);
  const period = (PERIODS as readonly number[]).includes(raw) ? (raw as Period) : 28;
  const d = await getSiteInsights(period);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Website"
        subtitle="Analytics and Search Console for reviosoft.app, without opening Google"
      />

      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`/website?days=${p}`}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${
              p === period ? "bg-ink-900 text-white" : "border border-ink-200 text-ink-600 hover:bg-ink-100"
            }`}
          >
            {p} days
          </Link>
        ))}
        <span className="ml-1 text-[11.5px] text-ink-500">
          {d.window.startDate} → {d.window.endDate} · ends yesterday, because a day in progress always reads as a fall
        </span>
      </div>

      {d.problem && (
        <Card className="p-4">
          <p className="text-[13px] font-semibold text-amber-700">
            {d.problem.kind === "key-looks-like-an-id"
              ? "That is the key ID, not the key."
              : d.problem.kind === "key-not-a-pem"
                ? "That does not look like a private key."
                : "Some settings are missing."}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
            {d.problem.kind === "key-looks-like-an-id" ? (
              <>
                <code className="text-[11.5px]">GOOGLE_INSIGHTS_PRIVATE_KEY</code> holds 40 hex
                characters, which is a service-account <strong>key ID</strong>. The console shows it in
                large type right after a key is created, so it is easy to copy instead of the key. Open
                the downloaded JSON and use the <code className="text-[11.5px]">private_key</code> value
                — or simply paste the <strong>whole file</strong> into{" "}
                <code className="text-[11.5px]">GOOGLE_INSIGHTS_CREDENTIALS</code> and the email and key
                are read out of it.
              </>
            ) : d.problem.kind === "key-not-a-pem" ? (
              <>
                It should begin <code className="text-[11.5px]">-----BEGIN PRIVATE KEY-----</code>.
                Easiest: paste the whole downloaded JSON into{" "}
                <code className="text-[11.5px]">GOOGLE_INSIGHTS_CREDENTIALS</code> — one variable, and
                no <code className="text-[11.5px]">\n</code> escaping to get wrong.
              </>
            ) : (
              <>Still needed: {d.problem.fields.join(", ")}.</>
            )}
          </p>
        </Card>
      )}

      {!d.configured && !d.problem && (
        <Card className="p-4">
          <p className="text-[13px] font-semibold text-ink-900">Not connected to Google yet.</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
            This screen reads Analytics and Search Console with a service account, so nobody has to
            sign in. It needs four variables on this service —{" "}
            <code className="text-[11.5px]">GOOGLE_INSIGHTS_CLIENT_EMAIL</code>,{" "}
            <code className="text-[11.5px]">GOOGLE_INSIGHTS_PRIVATE_KEY</code>,{" "}
            <code className="text-[11.5px]">GA4_PROPERTY_ID</code> and{" "}
            <code className="text-[11.5px]">GSC_SITE_URL</code> — and the service account added as a
            Viewer on the GA4 property and as a user in Search Console. Until then this page is inert
            rather than broken. See <code className="text-[11.5px]">docs/ACTION-REQUIRED.md</code>.
          </p>
        </Card>
      )}

      {d.error && (
        <Card className="p-4">
          <p className="text-[13px] font-semibold text-rose-700">Google did not answer.</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
            {d.error}. The rest of the console is unaffected — this panel fails on its own, which is
            why a revoked key cannot take down billing and client health with it.
          </p>
        </Card>
      )}

      {d.configured && !d.error && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Card className="p-4">
              <div className="text-[11px] uppercase tracking-wide text-ink-400">People</div>
              <div className="tnum mt-1 text-[24px] font-bold leading-none text-ink-900">{d.people.current}</div>
              <div className="mt-1.5"><Delta pct={d.people.deltaPct} previous={d.people.previous} /></div>
            </Card>
            <Card className="p-4">
              <div className="text-[11px] uppercase tracking-wide text-ink-400">Page views</div>
              <div className="tnum mt-1 text-[24px] font-bold leading-none text-ink-900">{d.views.current}</div>
              <div className="mt-1.5"><Delta pct={d.views.deltaPct} previous={d.views.previous} /></div>
            </Card>
            <Card className="p-4">
              <div className="text-[11px] uppercase tracking-wide text-ink-400">Clicks from search</div>
              <div className="tnum mt-1 text-[24px] font-bold leading-none text-ink-900">{d.search.clicks}</div>
              <div className="mt-1.5 text-[11.5px] text-ink-500">{d.search.impressions} impressions · {d.search.ctr}% CTR</div>
            </Card>
            <Card className="p-4">
              <div className="text-[11px] uppercase tracking-wide text-ink-400">Bulgarian share</div>
              <div className="tnum mt-1 text-[24px] font-bold leading-none text-ink-900">
                {d.byLocale.bg.clicks + d.byLocale.en.clicks === 0
                  ? "—"
                  : `${Math.round((d.byLocale.bg.clicks / (d.byLocale.bg.clicks + d.byLocale.en.clicks)) * 100)}%`}
              </div>
              <div className="mt-1.5 text-[11.5px] text-ink-500">
                {d.byLocale.bg.clicks} of {d.byLocale.bg.clicks + d.byLocale.en.clicks} clicks land on /bg/
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Was anybody there?" subtitle="People on the site, each day of the period" />
            <div className="px-4 pb-4 pt-1">
              <DailyBars series={d.traffic} />
              {/*
                Said out loud, because a number that is quietly a floor gets read as a total — and
                the conclusion drawn from that is "the site is failing".
              */}
              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-500">
                Analytics counts only visitors who accepted cookies, so this is a floor, not a total.
                The consent banner is doing what it promises; the cost is that this chart under-counts
                by however many people declined.
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="What people searched for"
                subtitle="The queries Google showed us for, most clicked first"
              />
              <div className="px-4 pb-4">
                {d.queries.length === 0 ? (
                  <p className="py-3 text-[12.5px] text-ink-500">
                    Nothing yet. Search Console lags two to three days, and a newly published page
                    takes longer than that to earn its first impression.
                  </p>
                ) : (
                  <table className="w-full text-left text-[12.5px]">
                    <thead className="text-[11px] uppercase tracking-wide text-ink-400">
                      <tr><th className="py-2">Query</th><th className="py-2 text-right">Clicks</th><th className="py-2 text-right">Impressions</th><th className="py-2 text-right">Position</th></tr>
                    </thead>
                    <tbody>
                      {d.queries.slice(0, 15).map((q) => (
                        <tr key={q.query} className="border-t border-ink-100">
                          <td className="py-2 pr-3 text-ink-800">{q.query}</td>
                          <td className="tnum py-2 text-right text-ink-900">{q.clicks}</td>
                          <td className="tnum py-2 text-right text-ink-500">{q.impressions}</td>
                          <td className="tnum py-2 text-right text-ink-500">{q.position}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Which pages earn the clicks"
                subtitle="Bulgarian and English side by side — the point of translating it"
              />
              <div className="px-4 pb-4">
                {d.pages.length === 0 ? (
                  <p className="py-3 text-[12.5px] text-ink-500">No pages have earned a search click in this period yet.</p>
                ) : (
                  <table className="w-full text-left text-[12.5px]">
                    <thead className="text-[11px] uppercase tracking-wide text-ink-400">
                      <tr><th className="py-2">Page</th><th className="py-2">Lang</th><th className="py-2 text-right">Clicks</th><th className="py-2 text-right">Impressions</th></tr>
                    </thead>
                    <tbody>
                      {d.pages.slice(0, 15).map((p) => (
                        <tr key={p.page} className="border-t border-ink-100">
                          <td className="py-2 pr-3 text-ink-800">{p.page}</td>
                          <td className="py-2 pr-3 text-ink-500">{p.page === "/bg" || p.page.startsWith("/bg/") ? "BG" : "EN"}</td>
                          <td className="tnum py-2 text-right text-ink-900">{p.clicks}</td>
                          <td className="tnum py-2 text-right text-ink-500">{p.impressions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </div>

          <p className="text-[11.5px] leading-relaxed text-ink-500">
            Search Console reports two to three days behind, so the most recent days of any period
            are still filling in. For anything longer than sixteen months, or a question this screen
            does not ask, open Analytics directly — this is deliberately the normal-periods view.
          </p>
        </>
      )}
    </div>
  );
}
