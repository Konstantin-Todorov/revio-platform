import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientDetail } from "@/lib/data";
import { SetupProgressCard } from "@/components/clients/SetupProgressCard";
import { setDemo } from "@/lib/actions";
import { endTrial, startTrial } from "@/lib/actions-trials";
import {
  PRODUCT_BY_KEY,
  PRODUCTS,
  TRIAL_DAYS,
  daysRemaining,
  trialOutcomeLabel,
} from "@revio/core";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { EntitlementToggle } from "@/components/clients/EntitlementToggle";
import { AccountPanel } from "@/components/clients/AccountPanel";
import { ContactsPanel } from "@/components/clients/ContactsPanel";
import { RelationshipLog } from "@/components/clients/RelationshipLog";
import { ClientBillingForm } from "@/components/billing/ClientBillingForm";
import { getClientBilling } from "@/lib/invoice-doc";
import { getOperatorSession } from "@/lib/session";

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
  const [billing, session] = await Promise.all([getClientBilling(id), getOperatorSession()]);
  if (!c) notFound();

  const now = new Date();
  const running = c.trials.filter((t) => !t.endedAt);
  const past = c.trials.filter((t) => t.endedAt);
  /*
   * Only products they do NOT have. A trial of something they already own would take it away when it
   * ended, which is why `startTrial` refuses it — offering the button would be offering a mistake.
   */
  const owned = new Set(
    [
      c.entitlements.channelManager ? "cm" : null,
      c.entitlements.reservation ? "crs" : null,
      c.entitlements.pms ? "pms" : null,
    ].filter(Boolean) as string[],
  );
  const trialable = PRODUCTS.filter((p) => !owned.has(p.key));

  const { tenant, economics, direct } = c;

  return (
    <div className="space-y-5">
      <PageHeader
        title={tenant.name}
        subtitle={`/${tenant.slug} · client since ${tenant.createdAt.toISOString().slice(0, 10)} · ${c.counts.units} rooms across ${tenant.properties.length} propert${tenant.properties.length === 1 ? "y" : "ies"}`}
        action={<Link href="/clients" className="text-[12.5px] font-semibold text-brand-700 hover:underline">← All clients</Link>}
      />

      {/* Stated before anything else on the page, because every figure below it means something
          different for a hotel that is ours. */}
      {tenant.isDemo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-sunken px-4 py-2.5">
          <span className="text-[12.5px] text-ink-600">
            <span className="mr-2 rounded bg-ink-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-ink-500">demo</span>
            Ours, for testing. Behaves exactly like a real client in all five apps — and is left out of MRR, billed
            revenue, renewals and the attention feed.
          </span>
          <form action={setDemo}>
            <input type="hidden" name="tenantId" value={tenant.id} />
            <input type="hidden" name="isDemo" value="false" />
            <button className="rounded-md border border-surface-border bg-white px-2.5 py-1 text-[11.5px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">
              Promote to real client
            </button>
          </form>
        </div>
      )}

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

      {/* 1b. How far they have actually got. Sits directly under what is wrong, because "stalled on
          step 2 after three weeks" IS what is wrong for a young client — and because the answer to
          most early attention flags is the same phone call. */}
      <SetupProgressCard setup={c.setup} ageDays={c.ageDays} stalled={c.setupStalled} />

      {/* 1c. What WE still owe them. Deliberately its own card and NOT merged into the progress bar
          above: that one is work the hotel does and we ring them about, this one is work we do and
          they cannot see. The alarm banner exists because "sold, switched on, nothing behind it" is
          not a step remaining — it is a wrong state the customer can already walk into. */}
      {(c.provisioningAlarm || c.provisioning.steps.length > 0) && (
        <Card>
          <h2 className="text-[13px] font-semibold text-ink-900">On our side</h2>
          {c.provisioningAlarm && (
            <p className="mt-2 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-[12.5px] text-danger-700">
              {c.provisioningAlarm}
            </p>
          )}
          <ul className="mt-3 space-y-2.5">
            {c.provisioning.steps.map((s) => (
              <li key={s.key} className="flex gap-2.5">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    s.severity === "blocking" ? "bg-danger-500" : s.severity === "soon" ? "bg-warn-500" : "bg-ink-300"
                  }`}
                />
                <span>
                  <span className="text-[13px] font-semibold text-ink-900">{s.title}</span>
                  <span className="mt-0.5 block text-[12.5px] text-ink-500">{s.why}</span>
                  {s.how && (
                    <code className="mt-1 block font-mono text-[11.5px] text-ink-400">{s.how}</code>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 2. Who they are and when this renews. The relationship comes before the arithmetic, because
          the arithmetic is useless if nobody knows who to phone about it. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AccountPanel
          tenantId={tenant.id}
          account={{
            stage: c.stage,
            ownerOperatorId: c.account?.ownerOperatorId ?? null,
            ownerOperatorName: c.account?.ownerOperator?.name ?? null,
            renewalDate: c.account?.renewalDate ? c.account.renewalDate.toISOString().slice(0, 10) : null,
            contractTermMonths: c.account?.contractTermMonths ?? null,
            summary: c.account?.summary ?? null,
          }}
          observed={c.observedStage}
          operators={c.operators}
          lastContactAt={c.lastContactAt ? c.lastContactAt.toISOString() : null}
        />
        <ContactsPanel tenantId={tenant.id} contacts={c.contacts} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 3. What they are worth today. */}
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

        {/* …and what their business is doing — the thing a normal SaaS admin cannot see. */}
        <Card>
          <CardHeader title="Their last 30 days" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 text-[13px]">
            <div><dt className="text-[11px] uppercase tracking-wide text-ink-400">Bookings</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{c.counts.reservationsLast30d}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-ink-400">Booked direct</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{economics.directSharePct.toFixed(1)}%</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-ink-400">Commission paid</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{money(economics.commissionPaidMinor)}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-ink-400">Last booking</dt><dd className="mt-0.5 font-semibold text-ink-900">{ago(c.lastReservationAt)}</dd></div>
          </dl>

          {/*
            Recovered by the waitlist — value we DELIVERED, which is the half of a renewal call that
            usually has to be asserted. Shown only when there is demand to report: a hotel with an
            empty waitlist gets no row, rather than a confident €0 that reads as a product failing.

            The figures come from `waitlistMetrics` in @revio/core, the same function behind the
            hotel's own Waitlist screen, so this is checkable rather than claimed.
          */}
          {/*
            RevioDirect, which the console could not see at all.
            `CLAUDE.md` recorded operator visibility into the booking engine as deliberately not
            built — correct while the engine was local-only. It is live, taking real bookings and
            billed on, and the client page showed a link and nothing else: not whether anyone books
            through it, what it earned, or what it saved them.

            Shown only when a property has it switched on. A €0 block on a hotel that never bought
            it reads as a product failing rather than one absent.
          */}
          {direct.enabledProperties > 0 && (
            <div className="border-t border-surface-border px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wide text-ink-400">
                  Booked on their own page (RevioDirect)
                </span>
                {direct.slug && (
                  <a
                    href={`https://booking.reviosoft.app/${direct.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11.5px] font-semibold text-brand-700 hover:underline"
                  >
                    open their page ↗
                  </a>
                )}
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-400">Bookings</dt>
                  <dd className="tnum mt-0.5 font-semibold text-ink-900">{direct.bookings}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-400">Revenue</dt>
                  <dd className="tnum mt-0.5 font-semibold text-ink-900">{money(direct.revenueMinor)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-400">Our 2% on it</dt>
                  <dd className="tnum mt-0.5 font-semibold text-ink-900">{money(direct.feeMinor)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-400">Commission avoided</dt>
                  <dd className="tnum mt-0.5 font-semibold text-success-600">
                    {/* An estimate, and null when there is no OTA rate to reason from. The
                        assumption travels with the number rather than being left implied. */}
                    {direct.commissionAvoidedMinor === null
                      ? "—"
                      : money(direct.commissionAvoidedMinor)}
                  </dd>
                </div>
              </dl>
              <p className="mt-1.5 text-[11px] text-ink-400">
                {direct.commissionAvoidedMinor === null
                  ? "No OTA revenue in the period, so there is no rate to estimate what these bookings would have cost them."
                  : `Estimated at their own blended OTA rate of ${direct.blendedOtaRatePct?.toFixed(1)}% — the same figure they see on Cost of distribution.`}
              </p>
            </div>
          )}

          {c.waitlist.entries > 0 && (
            <div className="border-t border-surface-border px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wide text-ink-400">
                  Recovered by the waitlist
                </span>
                <span className="tnum text-[15px] font-bold text-success-600">
                  {money(c.waitlist.recoveredMinor)}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] text-ink-500">
                {c.waitlist.converted} of {c.waitlist.entries} sold-out{" "}
                {c.waitlist.entries === 1 ? "enquiry" : "enquiries"} turned into a stay
                {c.waitlist.offerConversionRate != null && (
                  <> · {Math.round(c.waitlist.offerConversionRate * 100)}% of offers taken</>
                )}
                {c.waitlist.stillWaiting > 0 && <> · {c.waitlist.stillWaiting} still waiting</>}
              </p>
            </div>
          )}
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
      {/* (the log follows the pitch, because it is what you scan while the phone is ringing) */}
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

      {/* Who to invoice. Deliberately apart from the CRM above: that records what we BELIEVE about a
          relationship, this records what gets printed on a tax document. Its absence blocks issuing,
          so the card says so rather than letting it be discovered when an invoice is due. */}
      <Card className="mb-4">
        <CardHeader
          title="Billing details"
          action={!billing ? <StatusPill tone="warning">Not set</StatusPill> : undefined}
        />
        <div className="px-4 py-4">
          {!billing && (
            <p className="mb-3 rounded-md bg-warning-50 px-3 py-2 text-[12px] font-medium text-warning-600">
              This client cannot be invoiced until their legal name, country and address are recorded.
            </p>
          )}
          <ClientBillingForm
            tenantId={tenant.id}
            tradingName={tenant.name}
            canEdit={session?.role === "super_admin"}
            values={{
              legalName: billing?.legalName ?? "",
              vatId: billing?.vatId ?? "",
              companyId: billing?.companyId ?? "",
              addressLine: billing?.addressLine ?? "",
              city: billing?.city ?? "",
              postCode: billing?.postCode ?? "",
              country: billing?.country ?? "",
              billingEmail: billing?.billingEmail ?? "",
              attention: billing?.attention ?? "",
              notes: billing?.notes ?? "",
            }}
          />
        </div>
      </Card>

      {/* 5. What was said last time — ours, plus the moments the platform already knew about. */}
      <RelationshipLog
        tenantId={tenant.id}
        items={c.timeline.map((i) => ({
          id: i.id,
          at: i.at.toISOString(),
          kind: i.kind,
          title: i.title,
          detail: i.detail,
          author: i.author,
          pinned: i.pinned,
        }))}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Products — click to grant or revoke" />
          <div className="flex flex-wrap gap-2 px-4 py-4">
            {(["channelManager", "reservation", "pms"] as const).map((k) => (
              <EntitlementToggle key={k} tenantId={tenant.id} product={k} enabled={c.entitlements[k]} />
            ))}
          </div>
          {/*
            Trials sit with the products because they are the same decision seen from a different
            angle: what this hotel can open, and until when.
          */}
          <div className="border-t border-surface-border px-4 py-3">
            {running.length > 0 ? (
              <ul className="space-y-2">
                {running.map((t) => {
                  const info = PRODUCT_BY_KEY[t.product as "cm" | "crs" | "pms"];
                  const left = daysRemaining(
                    { product: t.product as "cm" | "crs" | "pms", endsAt: t.endsAt, endedAt: t.endedAt, remindedDays: [] },
                    now,
                  );
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={left <= 1 ? "danger" : left <= 7 ? "warning" : "info"}>
                        {info?.name ?? t.product} trial · {left} day{left === 1 ? "" : "s"} left
                      </StatusPill>
                      <span className="text-[11.5px] text-ink-400">
                        ends {t.endsAt.toISOString().slice(0, 10)}
                      </span>
                      {/* Keeping it is the ONLY path from trial to paid, and it is this button. No
                          clock and no email can do it. */}
                      <form action={endTrial} className="ml-auto flex gap-2">
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          name="outcome"
                          value="converted"
                          className="rounded-md bg-brand-800 px-2.5 py-1 text-[11.5px] font-semibold text-white transition-colors hover:bg-brand-700"
                        >
                          They kept it
                        </button>
                        <button
                          name="outcome"
                          value="cancelled"
                          className="rounded-md border border-surface-border px-2.5 py-1 text-[11.5px] font-semibold text-ink-500 transition-colors hover:bg-surface-muted"
                        >
                          Stop it
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {trialable.length > 0 && (
              <form action={startTrial} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="tenantId" value={tenant.id} />
                <span className="text-[11.5px] text-ink-500">Start a {TRIAL_DAYS}-day trial:</span>
                {trialable.map((p) => (
                  <button
                    key={p.key}
                    name="product"
                    value={p.key}
                    className="rounded-md border border-surface-border px-2.5 py-1 text-[11.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
                  >
                    {p.name}
                  </button>
                ))}
              </form>
            )}

            {past.length > 0 && (
              <p className="mt-2 text-[11px] text-ink-400">
                Before: {past.map((t) => `${PRODUCT_BY_KEY[t.product as "cm" | "crs" | "pms"]?.name ?? t.product} — ${trialOutcomeLabel(t.outcome)}`).join(" · ")}
              </p>
            )}
          </div>

          {!tenant.isDemo && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-border px-4 py-2.5">
              <span className="text-[11.5px] text-ink-400">
                Borrow this client for testing — it keeps working exactly as it does now, but stops counting as business.
              </span>
              <form action={setDemo}>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <input type="hidden" name="isDemo" value="true" />
                <button className="rounded-md border border-surface-border px-2.5 py-1 text-[11.5px] font-semibold text-ink-500 transition-colors hover:bg-surface-muted">
                  Mark as demo
                </button>
              </form>
            </div>
          )}
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
          {/* The fact is load-bearing and stays: no money moves anywhere in this console. Only the
              word changed — "mocked" is our vocabulary, and it reads as "pretend" to anyone else. */}
          <CardHeader title="Invoices — issued and tracked here, but no payment is ever taken" />
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
