import Link from "next/link";
import { Building2, Boxes, Radio, CalendarCheck, AlertCircle, Hotel } from "lucide-react";
import { getOverviewStats, getOperatorDashboard } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { TrendChart } from "@/components/overview/TrendChart";
import { StatCard } from "@revio/ui/stat-card";

export const dynamic = "force-dynamic";

const PLAN_TONE = { starter: "neutral", growth: "info", scale: "success", enterprise: "success" } as const;

const money = (minor: number) =>
  (minor / 100).toLocaleString(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const moneyExact = (minor: number) =>
  (minor / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });

/**
 * The operator's morning screen.
 *
 * Ordered by the questions actually asked at 9am, in order: what am I earning, what is coming, who
 * needs me today, and who is worth the most of my time. The seven raw counters the page used to open
 * with are still here — they are useful — but they are the footer now, because "37 properties" has
 * never once told anyone what to do next.
 */
export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const includeDemo = (await searchParams).demo === "1";
  const [stats, d] = await Promise.all([getOverviewStats(), getOperatorDashboard({ includeDemo })]);

  const forwardTotal = d.forward.reduce((s, f) => s + f.revenueMinor, 0);
  const forwardNights = d.forward.reduce((s, f) => s + f.roomNights, 0);
  const acts = d.feed.filter((f) => f.severity === "act").length;
  const soons = d.feed.filter((f) => f.severity === "soon").length;
  // MRR standing on a renewal date inside the next 90 days — the part of the top-line number that is
  // not guaranteed to still be there next quarter.
  const renewalMrr = d.renewals.filter((r) => r.days <= 90).reduce((s, r) => s + r.monthlyMinor, 0);

  const counters = [
    { icon: Building2, tone: "info", value: stats.clients, label: "Clients" },
    { icon: Hotel, tone: "info", value: stats.properties, label: "Properties" },
    { icon: Boxes, tone: "success", value: stats.products, label: "Products live" },
    { icon: Radio, tone: "success", value: stats.connectedChannels, label: "Channels connected" },
    { icon: CalendarCheck, tone: "info", value: stats.reservations, label: "Reservations" },
    { icon: AlertCircle, tone: stats.openErrors ? "danger" : "neutral", value: stats.openErrors, label: "Open errors" },
  ];
  const TONE_BG: Record<string, string> = {
    success: "bg-success-50 text-success-600", info: "bg-accent-50 text-accent-600",
    warning: "bg-warning-50 text-warning-600", danger: "bg-danger-50 text-danger-600", neutral: "bg-surface-sunken text-ink-500",
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overview"
        subtitle={d.demo.included ? "Including demo clients — these are not real figures" : "What happened, what is coming, and who needs you today"}
      />

      {/* Stated, not silent. A figure quietly missing from a dashboard is the one you never notice
          is missing — and "why is MRR €283 when I have no customers" is a worse morning than this line. */}
      {d.demo.count > 0 && (
        d.demo.included ? (
          <div className="-mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning-500/40 bg-warning-50 px-4 py-2.5">
            <span className="text-[12.5px] font-medium text-warning-600">
              Demo clients are counted in every figure below. Nothing on this screen is real revenue.
            </span>
            <Link href="/overview" className="rounded-md border border-warning-500/50 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-warning-600 hover:bg-warning-50">
              Back to real figures
            </Link>
          </div>
        ) : (
          <p className="-mt-2 text-[12px] text-ink-400">
            Excludes{" "}
            {d.demo.names.map((n, i) => (
              <span key={n.id}>
                {i > 0 && ", "}
                <Link href={`/clients/${n.id}`} className="font-semibold text-ink-500 hover:text-brand-700 hover:underline">{n.name}</Link>
              </span>
            ))}{" "}
            — demo {d.demo.count === 1 ? "client" : "clients"} of ours, worth {money(d.demo.mrrMinor)}/mo if they were real.
            Everything below is the actual business.{" "}
            <Link href="/overview?demo=1" className="font-semibold text-brand-600 hover:underline">Show them anyway</Link>{" "}
            to see the screen with data in it.
          </p>
        )
      )}

      {/*
        1. The money, in the order it matters: what we earn, what we have earned and not billed.

        On the shared StatCard, with one deliberate departure from its rule that tone says what a
        metric IS rather than how it is doing. Two of these four are **alerts, not metrics**: unbilled
        drift and needs-attention exist to be quiet when there is nothing wrong. An alert is defined
        by whether it is firing; a metric is not — so those two go neutral at zero and take their
        tone when they fire, while MRR and the forward book keep a fixed tone whatever they read.
      */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          tone="brand"
          label="Monthly recurring"
          value={money(d.money.mrrMinor)}
          sub={`${d.money.active} active client${d.money.active === 1 ? "" : "s"}`}
        />
        <StatCard
          tone={d.money.unbilledDriftMinor > 0 ? "warning" : "neutral"}
          label="Unbilled tier drift"
          value={money(d.money.unbilledDriftMinor)}
          sub={d.money.unbilledDriftMinor > 0 ? "per month, already earned" : "every plan matches its room count"}
        />
        <StatCard
          tone="success"
          label="Clients&rsquo; next 6 months"
          value={money(forwardTotal)}
          sub={`${forwardNights.toLocaleString()} room-nights on the books`}
        />
        <StatCard
          tone={acts > 0 ? "danger" : "neutral"}
          label="Needs attention"
          value={String(acts)}
          sub={acts === 0 && soons === 0 ? "nothing outstanding" : `now · ${soons} drifting`}
        />
      </div>

      {/* 2. Last 12 months and next 6, side by side, because the pair is the story. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Billed — last 12 months" action={<Link href="/billing" className="text-[12px] font-semibold text-brand-600 hover:underline">Billing</Link>} />
          <TrendChart
            data={d.back.map((b) => ({ label: b.label, value: b.billedMinor, secondary: b.paidMinor }))}
            format="money"
            primaryLabel="billed"
            secondaryLabel="paid"
          />
        </Card>

        <Card>
          <CardHeader title="Clients' bookings on the books — next 6 months" />
          {/* Their forward revenue, not ours. A portfolio whose next quarter is filling is a portfolio
              that renews, and we can see it months before any churn model would. */}
          <TrendChart
            data={d.forward.map((f) => ({ label: f.label, value: f.revenueMinor }))}
            format="money"
            primaryLabel="on the books"
            accent="#14b8a6"
          />
        </Card>
      </div>

      <Card>
        <CardHeader title="Bookings processed — last 12 months" />
        <TrendChart
          data={d.back.map((b) => ({ label: b.label, value: b.bookings }))}
          format="count"
          primaryLabel="reservations"
          accent="#7c6cf5"
        />
      </Card>

      {/* 3. Who needs you today — every client's flags in one feed, most urgent first — beside our
          own forward book, which is the only thing on this page with a deadline attached. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={d.feed.length === 0 ? "Needs attention — all clear" : `Needs attention (${d.feed.length})`}
            action={<Link href="/clients" className="text-[12px] font-semibold text-brand-600 hover:underline">All clients</Link>}
          />
          {d.feed.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-ink-500">
              Nothing outstanding across the portfolio — no stalled onboarding, no unpaid invoices, no sync failures.
            </p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {d.feed.slice(0, 12).map((f, i) => (
                <li key={`${f.clientId}-${f.title}-${i}`} className="flex items-start gap-3 px-4 py-2.5">
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      f.severity === "act" ? "bg-danger-600" : f.severity === "soon" ? "bg-warning-500" : "bg-ink-300"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <Link href={`/clients/${f.clientId}`} className="text-[13px] font-semibold text-ink-900 hover:text-brand-700 hover:underline">
                        {f.clientName}
                      </Link>
                      <span className={`text-[13px] ${f.severity === "act" ? "font-semibold text-danger-600" : "text-ink-700"}`}>{f.title}</span>
                    </span>
                    <span className="mt-0.5 block text-[12px] text-ink-500">{f.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Every other number here is revenue already being earned. This is the revenue that has to
            be re-won, with a date on it — the one deadline that arrives whether or not anyone
            prepared for it. */}
        <Card>
          <CardHeader
            title="Renewals ahead"
            action={renewalMrr > 0 ? <span className="tnum text-[12px] font-semibold text-ink-600">{money(renewalMrr)}/mo</span> : undefined}
          />
          {d.renewals.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-ink-500">
              No renewal dates inside four months. Ones with no date set are not counted — record them on the
              client&rsquo;s account.
            </p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {d.renewals.slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-baseline justify-between gap-2 px-4 py-2.5">
                  <span className="min-w-0">
                    <Link href={`/clients/${r.id}`} className="block truncate text-[13px] font-semibold text-ink-900 hover:text-brand-700 hover:underline">
                      {r.name}
                    </Link>
                    <span className="text-[11.5px] text-ink-400">
                      {r.at.toISOString().slice(0, 10)}
                      {r.accountManager ? ` · ${r.accountManager}` : " · unassigned"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block text-[12px] font-semibold ${r.days < 0 ? "text-danger-600" : r.days <= 30 ? "text-danger-600" : r.days <= 60 ? "text-warning-600" : "text-ink-500"}`}>
                      {r.days < 0 ? `${-r.days}d overdue` : r.days === 0 ? "today" : `in ${r.days}d`}
                    </span>
                    <span className="tnum block text-[11.5px] text-ink-400">{money(r.monthlyMinor)}/mo</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* 4. Who is worth the most of your time — ranked by what they pay, with what is wrong beside it. */}
      <Card>
        <CardHeader title="Clients by value" action={<Link href="/clients" className="text-[12px] font-semibold text-brand-600 hover:underline">Manage</Link>} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Client", "Plan", "Monthly", "Unbilled", "Reservations", "Errors", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.id} className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {r.worst && (
                        <span
                          aria-hidden
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            r.worst === "act" ? "bg-danger-600" : r.worst === "soon" ? "bg-warning-500" : "bg-ink-300"
                          }`}
                        />
                      )}
                      <Link href={`/clients/${r.id}`} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline">{r.name}</Link>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><StatusPill tone={PLAN_TONE[r.plan as keyof typeof PLAN_TONE] ?? "neutral"}>{r.plan}</StatusPill></td>
                  <td className="tnum px-4 py-2.5 font-semibold text-ink-900">{moneyExact(r.monthlyMinor)}</td>
                  <td className="tnum px-4 py-2.5">
                    {r.driftMinor > 0 ? <span className="font-semibold text-warning-600">+{moneyExact(r.driftMinor)}</span> : <span className="text-ink-300">—</span>}
                  </td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{r.reservations}</td>
                  <td className="tnum px-4 py-2.5">{r.openErrors > 0 ? <span className="font-bold text-danger-500">{r.openErrors}</span> : <span className="text-ink-300">0</span>}</td>
                  <td className="px-4 py-2.5">{r.status === "active" ? <StatusPill tone="success">active</StatusPill> : <StatusPill tone="warning">suspended</StatusPill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 5. The raw counters. Still useful, no longer the headline. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {counters.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="p-3.5">
              <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-md ${TONE_BG[c.tone]}`}><Icon className="h-4 w-4" /></div>
              <div className="tnum text-[20px] font-bold leading-none tracking-tight text-ink-900">{c.value}</div>
              <div className="mt-1 text-[11.5px] text-ink-500">{c.label}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
