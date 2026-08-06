import Link from "next/link";
import { Boxes, Building2, Layers, Percent } from "lucide-react";
import { getPlans } from "@/lib/data";
import {
  BUNDLE_DISCOUNT_PCT, DIRECT_BOOKING_FEE_PCT, MODULE_LABEL, MODULE_MINOR, PRODUCT_KEYS,
  TYPICAL_OTA_COMMISSION_PCT, priceBreakdown, entitlementsFor,
} from "@/lib/pricing";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const money = (minor: number) =>
  `€${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * The price list, and the portfolio measured against it.
 *
 * This page exists because the pricing was real but invisible: it lived as four constants in
 * `lib/pricing.ts`, was applied correctly to every invoice, and could not be read by the person who
 * has to decide whether it is right. A price nobody can see is a price nobody can argue with — which
 * sounds like an advantage until the first customer asks why the third product costs what it does.
 *
 * Everything here is computed by the same functions that produce the invoices, so the published
 * price and the charged price cannot drift apart.
 */
export default async function PlansPage() {
  const p = await getPlans();
  const example = priceBreakdown("growth", entitlementsFor(["channelManager", "reservation", "pms"]));
  const productMax = Math.max(1, ...PRODUCT_KEYS.map((k) => p.byProduct[k].minor));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Plans & pricing"
        subtitle="What we charge, how the number is built, and what the portfolio actually buys"
        action={<Link href="/billing" className="text-[12.5px] font-semibold text-brand-700 hover:underline">Billing →</Link>}
      />

      {/* The price list applies to everyone; the portfolio half below it is a claim about business. */}
      {p.demo.count > 0 && (
        <p className="-mt-2 text-[12px] text-ink-400">
          The price list applies to every client. The portfolio figures below exclude{" "}
          {p.demo.names.map((n, i) => (
            <span key={n.id}>
              {i > 0 && ", "}
              <Link href={`/clients/${n.id}`} className="font-semibold text-ink-500 hover:text-brand-700 hover:underline">{n.name}</Link>
            </span>
          ))}{" "}
          — demo {p.demo.count === 1 ? "client" : "clients"} of ours. They are still invoiced, deliberately, so the billing
          flow stays testable.
        </p>
      )}

      {/* 1. The model, before any number. Each part is priced on a different thing on purpose. */}
      <div className="grid gap-3 lg:grid-cols-4">
        {[
          {
            icon: Building2, title: "Platform fee", figure: "by room count",
            body: "Cost to serve: the shared database, tenant isolation, backups, the availability engine, support. A 200-room resort costs more to carry than a 12-room guesthouse whatever it has bought.",
          },
          {
            icon: Boxes, title: "Module fee", figure: "per product",
            body: `RevioLink ${money(MODULE_MINOR.channelManager)} · RevioCRS ${money(MODULE_MINOR.reservation)} · RevioPMS ${money(MODULE_MINOR.pms)} a month. Priced on what each product does for them, not on what it costs us.`,
          },
          {
            icon: Layers, title: "Bundle discount", figure: `${BUNDLE_DISCOUNT_PCT[2]}% · ${BUNDLE_DISCOUNT_PCT[3]}%`,
            body: "Off the module fees at two and three products — never off the platform fee. The second and third products cost us almost nothing to deliver: same database, same onboarding, no migration.",
          },
          {
            icon: Percent, title: "Booking fee", figure: `${DIRECT_BOOKING_FEE_PCT}% of RevioDirect`,
            body: `The only part where we earn more when they earn more. An OTA takes about ${TYPICAL_OTA_COMMISSION_PCT}% of the same booking. Charged on what our engine produced — never on their own phone bookings.`,
          },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.title} className="p-4">
              <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-md bg-surface-sunken text-ink-500">
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-[13.5px] font-bold text-ink-900">{c.title}</div>
              <div className="mt-0.5 text-[12px] font-semibold text-brand-700">{c.figure}</div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-500">{c.body}</p>
            </Card>
          );
        })}
      </div>

      {/* 2. The price list. Rows are the seven ways to buy it; columns are the room tiers. */}
      <Card>
        <CardHeader title="The price list — monthly, EUR, per property group" />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5 font-semibold">What they buy</th>
                {p.matrix.map((t) => (
                  <th key={t.plan} className="px-4 py-2.5 text-right font-semibold">
                    {t.plan}
                    <span className="block text-[10px] font-normal normal-case tracking-normal text-ink-300">{t.label}</span>
                  </th>
                ))}
                <th className="px-4 py-2.5 font-semibold">Who it is for</th>
              </tr>
            </thead>
            <tbody>
              {p.adoption.map((combo, row) => {
                const isFull = combo.key === "cm+crs+pms";
                return (
                  <tr key={combo.key} className={`border-b border-surface-border/60 last:border-0 ${isFull ? "bg-success-50/40" : ""}`}>
                    <td className="px-4 py-2.5">
                      <span className={`text-[13px] ${isFull ? "font-bold text-ink-900" : "font-semibold text-ink-800"}`}>{combo.label}</span>
                      <span className="ml-2 text-[11px] text-ink-400">
                        {combo.products.length} product{combo.products.length === 1 ? "" : "s"}
                        {combo.products.length > 1 && ` · −${BUNDLE_DISCOUNT_PCT[combo.products.length]}%`}
                      </span>
                    </td>
                    {p.matrix.map((tier) => {
                      const cell = tier.cells[row]!;
                      return (
                        <td key={tier.plan} className="px-4 py-2.5 text-right">
                          <span className={`tnum ${isFull ? "font-bold text-ink-900" : "font-semibold text-ink-800"}`}>
                            {money(cell.breakdown.totalMinor)}
                          </span>
                          {combo.products.length > 1 && (
                            <span className="tnum block text-[10.5px] text-ink-400">
                              {money(Math.round(cell.breakdown.totalMinor / combo.products.length))}/product
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-[11.5px] text-ink-500">{combo.who}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-surface-border px-4 py-2.5 text-[11.5px] text-ink-400">
          The per-product figure is the argument on a call: the full platform costs less per product than any
          single module bought alone, and three separate vendors cost more than all three of ours.
        </p>
      </Card>

      {/* 3. One bill, shown as arithmetic. A price a customer cannot reconstruct is one they argue with. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="How a bill is built — 40-room hotel, all three products" />
          <dl className="px-4 py-3.5 text-[13px]">
            <div className="flex justify-between border-b border-surface-border/60 py-1.5">
              <dt className="text-ink-600">Platform fee — growth tier</dt>
              <dd className="tnum font-semibold text-ink-900">{money(example.platformMinor)}</dd>
            </div>
            {example.modules.map((m) => (
              <div key={m.key} className="flex justify-between border-b border-surface-border/60 py-1.5">
                <dt className="text-ink-600">{m.label}</dt>
                <dd className="tnum text-ink-700">{money(m.minor)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-b border-surface-border/60 py-1.5">
              <dt className="text-ink-600">Bundle discount — {example.discountPct}% of modules</dt>
              <dd className="tnum font-semibold text-success-600">−{money(example.discountMinor)}</dd>
            </div>
            <div className="flex justify-between pt-2.5">
              <dt className="text-[13.5px] font-bold text-ink-900">Monthly</dt>
              <dd className="tnum text-[15px] font-bold text-ink-900">{money(example.totalMinor)}</dd>
            </div>
          </dl>
        </Card>

        {/* 4. The usage half, on real bookings rather than an assumption. */}
        <Card>
          <CardHeader title={`RevioDirect booking fee — last 30 days`} />
          {p.usage.bookings === 0 ? (
            <p className="px-4 py-5 text-[13px] text-ink-500">
              No bookings through RevioDirect in the last 30 days, so the fee earned nothing. It is charged only on
              what our engine produced — a hotel taking a reservation by phone owes us nothing extra.
            </p>
          ) : (
            <div className="px-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-400">We would charge</div>
                  <div className="tnum mt-0.5 text-[24px] font-bold leading-none text-ink-900">{money(p.usage.feeMinor)}</div>
                  <div className="mt-1 text-[11.5px] text-ink-400">
                    {DIRECT_BOOKING_FEE_PCT}% of {money(p.usage.revenueMinor)} across {p.usage.tenants} client
                    {p.usage.tenants === 1 ? "" : "s"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-400">An OTA would have taken</div>
                  <div className="tnum mt-0.5 text-[24px] font-bold leading-none text-ink-400">{money(p.usage.otaEquivalentMinor)}</div>
                  <div className="mt-1 text-[11.5px] text-ink-400">at {TYPICAL_OTA_COMMISSION_PCT}% on the same bookings</div>
                </div>
              </div>
              <p className="mt-3 rounded-md bg-success-50 px-3 py-2 text-[12px] font-medium text-success-600">
                {money(p.usage.otaEquivalentMinor - p.usage.feeMinor)} stayed with the hotels — the sentence the fee has to
                earn every month.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* 5. What people actually buy. */}
      <Card>
        <CardHeader title={`Who buys what — ${p.activeCount} active client${p.activeCount === 1 ? "" : "s"}`} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Combination", "Clients", "Share of MRR", "MRR", "Who"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.adoption.map((c) => (
                <tr key={c.key} className="border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{c.label}</td>
                  <td className="px-4 py-2.5">
                    {c.count === 0 ? (
                      <span className="text-ink-300">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {c.clients.map((cl) => (
                          <Link key={cl.id} href={`/clients/${cl.id}`} className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11.5px] font-medium text-ink-700 hover:bg-surface-muted hover:text-brand-700">
                            {cl.name}
                          </Link>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken">
                        <span className="block h-full rounded-full bg-brand-700" style={{ width: `${pct(c.mrrMinor, p.mrrMinor)}%` }} />
                      </span>
                      <span className="tnum text-[11.5px] text-ink-500">{pct(c.mrrMinor, p.mrrMinor)}%</span>
                    </span>
                  </td>
                  <td className="tnum px-4 py-2.5 font-semibold text-ink-900">{c.mrrMinor > 0 ? money(c.mrrMinor) : <span className="font-normal text-ink-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-[11.5px] text-ink-500">{c.who}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p.unsold.length > 0 && (
          <p className="border-t border-surface-border px-4 py-2.5 text-[12px] text-warning-600">
            <span className="font-semibold">{p.unsold.length} active client{p.unsold.length === 1 ? " has" : "s have"} no product at all</span>{" "}
            ({p.unsold.map((u) => u.name).join(", ")}) — paying only the platform fee, or nothing.
          </p>
        )}
      </Card>

      {/* 6. What each product earns. A convention, and the page says so. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="What each product earns" action={<span className="tnum text-[12px] font-semibold text-ink-600">{money(p.mrrMinor)} MRR</span>} />
          <div className="space-y-3 px-4 py-4">
            {PRODUCT_KEYS.map((k) => (
              <div key={k}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-ink-900">{MODULE_LABEL[k]}</span>
                  <span className="text-[12px] text-ink-500">
                    <span className="tnum font-semibold text-ink-900">{money(p.byProduct[k].minor)}</span>
                    <span className="ml-2 text-ink-400">{p.byProduct[k].clients} client{p.byProduct[k].clients === 1 ? "" : "s"}</span>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-sunken">
                  <div className="h-full rounded-full bg-brand-800" style={{ width: `${Math.round((p.byProduct[k].minor / productMax) * 100)}%` }} />
                </div>
              </div>
            ))}
            {p.unallocatedMinor > 0 && (
              <div className="text-[12px] text-ink-500">
                <span className="font-semibold text-ink-700">{money(p.unallocatedMinor)}</span> unallocated — platform fee from
                clients holding no product. Real revenue that belongs to no product.
              </div>
            )}
          </div>
          <p className="border-t border-surface-border px-4 py-2.5 text-[11.5px] text-ink-400">
            <span className="font-semibold text-ink-500">This is a convention, not a fact.</span> Once a bundle discount
            exists there is no true answer to which product gave up the discount, and the platform fee is nobody&rsquo;s.
            Each client&rsquo;s price is split across their products in proportion to the list module fee — so the parts
            always sum to MRR exactly.
          </p>
        </Card>

        <Card>
          <CardHeader title="Room tiers — where the portfolio actually sits" />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                  {["Tier", "Platform fee", "Billed here", "Room count says"].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.tierSpread.map((t, i) => (
                  <tr key={t.plan} className="border-b border-surface-border/60 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-ink-900">{t.plan}</span>
                      <span className="ml-2 text-[11px] text-ink-400">{t.label}</span>
                    </td>
                    <td className="tnum px-4 py-2.5 text-ink-700">{money(p.matrix[i]!.platformMinor)}</td>
                    <td className="tnum px-4 py-2.5 text-ink-700">{t.onThisPlan}</td>
                    <td className="tnum px-4 py-2.5">
                      {t.shouldBeHere === t.onThisPlan ? (
                        <span className="text-ink-400">{t.shouldBeHere}</span>
                      ) : (
                        <span className="font-semibold text-warning-600">{t.shouldBeHere}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-surface-border px-4 py-2.5 text-[11.5px] text-ink-400">
            Where the last two columns disagree, someone is on the wrong tier. Each one is named on the client&rsquo;s
            page, over-billing as plainly as under-billing.
          </p>
        </Card>
      </div>

      {/* 7. The consequence. Nothing about a repricing should be discoverable only from an invoice. */}
      <Card>
        <CardHeader title="What this model changes about today's bills" />
        {p.repricing.changed.length === 0 ? (
          <p className="px-4 py-5 text-[13px] text-ink-500">
            Every client&rsquo;s last invoice matches what this model charges. Nothing moves.
            {p.repricing.neverInvoiced > 0 && ` ${p.repricing.neverInvoiced} client(s) have never been invoiced.`}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                    {["Client", "Products", "Last invoiced", "This model", "Change"].map((h) => (
                      <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.repricing.changed.map((c) => (
                    <tr key={c.id} className="border-b border-surface-border/60 last:border-0">
                      <td className="px-4 py-2.5">
                        <Link href={`/clients/${c.id}`} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline">{c.name}</Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill tone="neutral">{c.breakdown.modules.length} of 3</StatusPill>
                      </td>
                      <td className="tnum px-4 py-2.5 text-ink-600">
                        {money(c.lastInvoiced!.amountMinor)}
                        <span className="ml-1.5 text-[11px] text-ink-400">{c.lastInvoiced!.period}</span>
                      </td>
                      <td className="tnum px-4 py-2.5 font-semibold text-ink-900">{money(c.monthlyMinor)}</td>
                      <td className={`tnum px-4 py-2.5 font-semibold ${c.repriceDeltaMinor! > 0 ? "text-success-600" : "text-warning-600"}`}>
                        {c.repriceDeltaMinor! > 0 ? "+" : "−"}{money(Math.abs(c.repriceDeltaMinor!))}/mo
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-surface-border px-4 py-2.5 text-[12px] text-ink-500">
              Nothing is charged until invoices are generated on the{" "}
              <Link href="/billing" className="font-semibold text-brand-700 hover:underline">Billing</Link> screen, so this is a
              decision rather than something already in motion. Net across the portfolio:{" "}
              <span className={`tnum font-bold ${p.repricing.changed.reduce((s, c) => s + c.repriceDeltaMinor!, 0) >= 0 ? "text-success-600" : "text-warning-600"}`}>
                {p.repricing.changed.reduce((s, c) => s + c.repriceDeltaMinor!, 0) >= 0 ? "+" : "−"}
                {money(Math.abs(p.repricing.changed.reduce((s, c) => s + c.repriceDeltaMinor!, 0)))}/mo
              </span>.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
