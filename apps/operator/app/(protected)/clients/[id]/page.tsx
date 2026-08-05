import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientDetail } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { EntitlementToggle } from "@/components/clients/EntitlementToggle";

export const dynamic = "force-dynamic";

const money = (minor: number, currency = "EUR") =>
  (minor / 100).toLocaleString(undefined, { style: "currency", currency });

const ago = (d: Date | null) => {
  if (!d) return "never";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

/**
 * One customer, one page.
 *
 * The order is the order of a renewal call: what is wrong, what they are worth, what to sell them,
 * then the detail to back all three up. A page that opens with a table of room types is a database
 * viewer; this one has to survive being read thirty seconds before dialling.
 */
export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getClientDetail(id);
  if (!c) notFound();

  const { tenant, economics } = c;

  return (
    <div className="space-y-5">
      <PageHeader
        title={tenant.name}
        subtitle={`/${tenant.slug} · client since ${tenant.createdAt.toISOString().slice(0, 10)} · ${c.counts.units} rooms across ${tenant.properties.length} propert${tenant.properties.length === 1 ? "y" : "ies"}`}
        action={<Link href="/clients" className="text-[12.5px] font-semibold text-brand-700 hover:underline">← All clients</Link>}
      />

      {/* 1. What is wrong. Nothing else on this page matters while something here is red. */}
      {c.attention.length > 0 && (
        <Card>
          <CardHeader title={`Needs attention (${c.attention.length})`} />
          <ul className="divide-y divide-surface-border">
            {c.attention.map((f) => (
              <li key={f.title} className="flex items-start gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    f.severity === "act" ? "bg-danger-600" : f.severity === "soon" ? "bg-warning-500" : "bg-ink-300"
                  }`}
                />
                <span>
                  <span className={`text-[13px] font-semibold ${f.severity === "act" ? "text-danger-600" : "text-ink-900"}`}>{f.title}</span>
                  <span className="mt-0.5 block text-[12.5px] text-ink-500">{f.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 2. What they are worth today. */}
        <Card>
          <CardHeader title="Billing" />
          <div className="px-4 py-4">
            <div className="tnum text-[1.6rem] font-bold leading-none text-ink-900">{money(c.billing.monthlyMinor)}</div>
            <div className="mt-1 text-[12px] text-ink-500">per month · {c.billing.products || "no products"}</div>
            <div className="mt-3 flex items-center gap-2">
              <StatusPill tone={tenant.plan === "scale" || tenant.plan === "enterprise" ? "success" : tenant.plan === "growth" ? "info" : "neutral"}>
                {tenant.plan}
              </StatusPill>
              {/* Tier drift is expansion revenue that already happened, or a credit they are owed. */}
              {c.drift && (
                <span className={`text-[12px] font-semibold ${c.drift.monthlyDeltaMinor > 0 ? "text-warning-600" : "text-ink-500"}`}>
                  {c.drift.monthlyDeltaMinor > 0
                    ? `→ ${c.drift.correctPlan} (+${money(c.drift.monthlyDeltaMinor)}/mo unbilled)`
                    : `→ ${c.drift.correctPlan} (over-billed ${money(-c.drift.monthlyDeltaMinor)}/mo)`}
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* 3. What their business is doing — the thing a normal SaaS admin cannot see. */}
        <Card>
          <CardHeader title="Their last 30 days" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 text-[13px]">
            <div><dt className="text-[11px] uppercase tracking-wide text-ink-400">Bookings</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{c.counts.reservationsLast30d}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-ink-400">Booked direct</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{economics.directSharePct.toFixed(1)}%</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-ink-400">Commission paid</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{money(economics.commissionPaidMinor)}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-ink-400">Last booking</dt><dd className="mt-0.5 font-semibold text-ink-900">{ago(c.lastReservationAt)}</dd></div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Connectivity" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 text-[13px]">
            <div><dt className="text-[11px] uppercase tracking-wide text-ink-400">Channels</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{c.counts.channelsConnected} / {c.counts.channels}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-ink-400">Last sync</dt><dd className="mt-0.5 font-semibold text-ink-900">{ago(c.lastSyncAt)}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-ink-400">Open errors</dt><dd className={`tnum mt-0.5 font-semibold ${c.counts.openErrors > 0 ? "text-danger-600" : "text-ink-900"}`}>{c.counts.openErrors}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-ink-400">Room types</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{c.counts.roomTypes}</dd></div>
          </dl>
        </Card>
      </div>

      {/* 4. What to sell them, priced from their own data. */}
      <Card>
        <CardHeader
          title={
            c.pipelineMinor > 0
              ? `Opportunities (${c.opportunities.length}) · ${money(c.pipelineMinor)}/mo if every one converted`
              : `Opportunities (${c.opportunities.length}) · retention and value delivery, no new MRR`
          }
        />
        {c.opportunities.length === 0 ? (
          <p className="px-4 py-5 text-[13px] text-ink-500">
            Nothing to sell. They have every product, the plan matches their room count, and the booking engine is live.
          </p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {c.opportunities.map((o) => (
              <li key={o.kind} className="px-4 py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-ink-900">{o.title}</span>
                  <span className="flex items-baseline gap-3 text-[12.5px]">
                    {/* THEIR number first. A pitch that leads with our uplift is a quota conversation;
                        one that leads with their saving is a business conversation. */}
                    {o.clientValueMinor != null && (
                      <span className="font-bold text-success-600">{money(o.clientValueMinor)}/mo to them</span>
                    )}
                    {o.monthlyUpliftMinor > 0 && (
                      <span className="tnum font-semibold text-ink-600">+{money(o.monthlyUpliftMinor)}/mo to us</span>
                    )}
                    <StatusPill tone={o.confidence === "strong" ? "success" : "warning"}>{o.confidence}</StatusPill>
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-ink-600">{o.rationale}</p>
                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {o.evidence.map((e) => (
                    <li key={e} className="text-[11.5px] text-ink-400">· {e}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Products — click to grant or revoke" />
          <div className="flex flex-wrap gap-2 px-4 py-4">
            {(["channelManager", "reservation", "pms"] as const).map((k) => (
              <EntitlementToggle key={k} tenantId={tenant.id} product={k} enabled={c.entitlements[k]} />
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title={`Properties (${tenant.properties.length})`} />
          {tenant.properties.length === 0 ? (
            <p className="px-4 py-5 text-[13px] text-ink-500">No property yet — nothing can be sold.</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {tenant.properties.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
                  <span>
                    <span className="font-semibold text-ink-900">{p.name}</span>
                    <span className="ml-2 text-[11.5px] text-ink-400">{p.timezone} · {p.baseCurrency}</span>
                  </span>
                  {p.bookingEngineEnabled && p.publicSlug ? (
                    <StatusPill tone="success">RevioDirect /{p.publicSlug}</StatusPill>
                  ) : (
                    <StatusPill tone="neutral">no booking page</StatusPill>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Staff (${tenant.users.length}) — one shared identity across every product`} />
          <ul className="divide-y divide-surface-border">
            {tenant.users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
                <span>
                  <span className="font-semibold text-ink-900">{u.name}</span>
                  <span className="ml-2 text-[11.5px] text-ink-400">{u.email}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[11.5px] text-ink-500">{u.role}</span>
                  {!u.active && <StatusPill tone="neutral">deactivated</StatusPill>}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Invoices — payments are mocked, no money moved" />
          {c.billing.invoices.length === 0 ? (
            <p className="px-4 py-5 text-[13px] text-ink-500">No invoices generated yet.</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {c.billing.invoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
                  <span className="font-semibold text-ink-900">{i.period}</span>
                  <span className="flex items-center gap-3">
                    <span className="tnum text-ink-700">{money(i.amountMinor, i.currency)}</span>
                    <StatusPill tone={i.status === "paid" ? "success" : i.status === "sent" ? "warning" : "neutral"}>{i.status}</StatusPill>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
