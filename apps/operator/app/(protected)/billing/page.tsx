import { CreditCard, TrendingUp, FileText, CheckCircle2, FilePlus2 } from "lucide-react";
import { getBilling } from "@/lib/data";
import { generateInvoices, setInvoiceStatus } from "@/lib/actions-billing";
import { overridePlan, clearPlanOverride } from "@/lib/actions";
import { describeOverride } from "@/lib/pricing";
import Link from "next/link";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { IssueInvoiceButton } from "@/components/billing/IssueInvoiceButton";
import { getCompany } from "@/lib/invoice-doc";
import { allowedTransitions, amountBasis } from "@revio/core";

export const dynamic = "force-dynamic";

function money(minor: number, currency = "EUR"): string {
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency + " ";
  return `${sym}${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: minor % 100 ? 2 : 0 })}`;
}
const STATUS_TONE: Record<string, Tone> = { draft: "neutral", sent: "warning", paid: "success", void: "neutral" };
const inputCls = "h-8 rounded-md border border-surface-border bg-white px-2 text-[12.5px] text-ink-900 outline-none focus:border-brand-600";

export default async function BillingPage() {
  const { period, clients, mrr, unpaidCount, recent, demoCount } = await getBilling();
  const company = await getCompany();

  const cards = [
    { icon: TrendingUp, tone: "success", value: money(mrr), label: "MRR", sub: "active clients" },
    // Real, active clients — this sits beside MRR and reads as a business count, so it has to be
    // filtered the same way MRR is. A "2 active clients" next to a "€0 MRR" would be nonsense.
    { icon: CreditCard, tone: "info", value: clients.filter((c) => c.status === "active" && !c.isDemo).length, label: "Active clients", sub: "billed monthly" },
    // An unsent draft is NOT an unpaid invoice — nobody has been asked for the money yet. Counting
    // the two together makes the number useless for the only question it is asked: who owes us.
    { icon: FileText, tone: unpaidCount ? "warning" : "neutral", value: unpaidCount, label: "Awaiting payment", sub: "issued and sent, not yet paid" },
  ];
  const TONE_BG: Record<string, string> = { success: "bg-success-50 text-success-600", info: "bg-accent-50 text-accent-600", warning: "bg-warning-50 text-warning-600", neutral: "bg-surface-sunken text-ink-500" };

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle={`Plans, monthly price and invoices per client · period ${period}`}
        action={
          <form action={generateInvoices}>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700">
              <FilePlus2 className="h-4 w-4" /> Generate {period} invoices
            </button>
          </form>
        }
      />

      {!company && (
        <div className="mb-3 rounded-md bg-warning-50 px-3 py-2.5 text-[12.5px] font-medium text-warning-600">
          No company details set, so no invoice can be issued. Add your legal name, address, VAT number
          and bank details in <Link href="/settings" className="underline">Settings</Link>.
        </div>
      )}

      {/*
        * The mirror of the company-details warning above: that one says WE cannot issue, this one
        * says we cannot issue TO these clients. Both were only discoverable at the moment of issuing.
        */}
      {(() => {
        const blocked = clients.filter((c) => !c.isDemo && c.billingGaps.length > 0);
        return blocked.length === 0 ? null : (
          <div className="mb-3 rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-[12.5px] text-danger-700">
            <strong className="font-semibold">
              {blocked.length} real client{blocked.length === 1 ? "" : "s"} cannot be invoiced.
            </strong>{" "}
            Issuing needs a legal name, country and address — the country also decides the VAT treatment.{" "}
            {blocked.map((c, i) => (
              <span key={c.id}>
                {i > 0 && " · "}
                <Link href={`/clients/${c.id}`} className="font-semibold underline">{c.name}</Link>
                <span className="opacity-80"> (needs {c.billingGaps.join(", ")})</span>
              </span>
            ))}
          </div>
        );
      })()}

      <div className="grid grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="p-4">
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-md ${TONE_BG[c.tone]}`}><Icon className="h-[18px] w-[18px]" /></div>
              <div className="tnum text-[24px] font-bold leading-none tracking-tight text-ink-900">{c.value}</div>
              <div className="mt-1.5 text-[12.5px] font-semibold text-ink-700">{c.label}</div>
              <div className="text-[11.5px] text-ink-400">{c.sub}</div>
            </Card>
          );
        })}
      </div>

      {demoCount > 0 && (
        <p className="mt-2.5 text-[12px] text-ink-400">
          MRR and the unpaid count exclude {demoCount} demo client{demoCount === 1 ? "" : "s"}. Their invoices are still
          generated — that is deliberate, so this whole flow stays testable end to end — they just never reach a total.
        </p>
      )}

      <Card className="mt-4">
        <CardHeader title="Clients — plan & this month" />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Client", "Plan", "Products", "Monthly", `${period} invoice`].map((x) => <th key={x} className="px-4 py-2.5 font-semibold">{x}</th>)}
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-surface-border last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">
                    {c.name}
                    {c.isDemo && <span className="ml-1.5 rounded bg-ink-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-ink-500">demo</span>}
                    {c.status !== "active" && <span className="ml-1.5 text-[10.5px] font-semibold uppercase text-warning-600">{c.status}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {/*
                      * DERIVED from the room count, with the override as a visible exception.
                      *
                      * This was a free dropdown with a Save button while another panel measured the
                      * disagreement it produced as "unbilled tier drift" — the console manufacturing
                      * the problem it then reported. An override now needs a reason, so drift and
                      * decision stop looking identical.
                      */}
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1.5">
                        <span className="font-semibold text-ink-900">{c.effective.plan}</span>
                        {c.effective.basis === "overridden" ? (
                          <span
                            title={describeOverride(c.effective.override!)}
                            className="rounded bg-warning-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-warning-700"
                          >
                            override
                          </span>
                        ) : (
                          <span className="text-[10.5px] text-ink-400">from {c.effective.rooms} rooms</span>
                        )}
                      </span>
                      {c.effective.basis === "overridden" && (
                        <span className="text-[10.5px] text-ink-400">
                          rooms say {c.effective.derivedPlan} · {c.effective.override!.reason}
                          <form action={clearPlanOverride} className="inline">
                            <input type="hidden" name="tenantId" value={c.id} />
                            <button type="submit" className="ml-1.5 underline hover:text-ink-700">use rooms</button>
                          </form>
                        </span>
                      )}
                      <details className="text-[10.5px] text-ink-400">
                        <summary className="cursor-pointer hover:text-ink-700">override…</summary>
                        <form action={overridePlan} className="mt-1 flex flex-wrap items-center gap-1">
                          <input type="hidden" name="tenantId" value={c.id} />
                          <select name="plan" defaultValue={c.effective.plan} className={inputCls}>
                            <option value="starter">Starter</option>
                            <option value="growth">Growth</option>
                            <option value="scale">Scale</option>
                          </select>
                          <input name="reason" placeholder="why?" required className={inputCls} />
                          <button type="submit" className="rounded border border-surface-border px-1.5 py-0.5 text-[11px] font-semibold text-ink-500 hover:bg-surface-muted">Save</button>
                        </form>
                      </details>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[11.5px] text-ink-500">{c.products}</td>
                  <td className="px-4 py-2.5 tnum font-semibold text-ink-900">{money(c.priceMinor)}</td>
                  <td className="px-4 py-2.5">
                    {!c.billingStartsAt ? (
                      /* Not a gap — the promise being kept. "Free until your first booking syncs" is
                         on every product page, and an operator seeing a blank cell should read it as
                         working, not as a job that failed to run. */
                      <span className="text-[11.5px] font-medium text-success-600" title="Free until their first booking syncs">
                        free — no booking synced yet
                      </span>
                    ) : !c.currentInvoice ? (
                      <span className="text-[11.5px] text-ink-400">not generated</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <StatusPill tone={STATUS_TONE[c.currentInvoice.status]}>{c.currentInvoice.status}</StatusPill>
                        {/* Issuing, not "sending", is the real transition: it allocates the number
                            and freezes the document. Flipping a status used to do neither. */}
                        {c.currentInvoice.number ? (
                          <Link href={`/invoice/${c.currentInvoice.id}`} className="tnum text-[11px] font-semibold text-brand-700 hover:underline">
                            {c.currentInvoice.number}
                          </Link>
                        ) : (
                          <>
                            {/* A draft is openable too. It was not, and that made the document
                                unreachable until it had been issued — so the only way to see what an
                                invoice would say was to commit to sending it. */}
                            <Link href={`/invoice/${c.currentInvoice.id}`} className="text-[11px] font-semibold text-ink-500 hover:text-ink-900 hover:underline">
                              Preview
                            </Link>
                            <IssueInvoiceButton invoiceId={c.currentInvoice.id} />
                          </>
                        )}
                        {allowedTransitions(c.currentInvoice).includes("paid") && (
                          <form action={setInvoiceStatus}><input type="hidden" name="id" value={c.currentInvoice.id} /><input type="hidden" name="status" value="paid" />
                            <button type="submit" className="inline-flex items-center gap-1 rounded border border-success-500 px-1.5 py-0.5 text-[11px] font-semibold text-success-600 hover:bg-success-50"><CheckCircle2 className="h-3 w-3" />Mark paid</button></form>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {recent.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Recent invoices" />
          <ul className="divide-y divide-surface-border">
            {recent.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]">
                <span className="font-medium text-ink-800">{i.tenant}</span>
                <span className="flex items-center gap-3">
                  <span className="text-ink-400">{i.period}</span>
                  <Link
                    href={`/invoice/${i.id}`}
                    className={i.number
                      ? "tnum text-[11.5px] font-semibold text-brand-700 hover:underline"
                      : "text-[11px] uppercase tracking-wide text-ink-400 hover:text-ink-700 hover:underline"}
                  >
                    {i.number ?? "draft"}
                  </Link>
                  {/*
                    * NET or GROSS, said out loud. A draft carries the net price and VAT is computed
                    * at issue, so this column was showing net for some rows and gross for others
                    * with nothing marking which — read from outside, that looks like three different
                    * pricing conventions across four invoices. It was two facts in one column.
                    */}
                  <span className="tnum font-semibold text-ink-900">{money(i.grossMinor ?? i.amountMinor, i.currency)}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                    {amountBasis(i) === "gross" ? "incl. VAT" : "ex. VAT"}
                  </span>
                  <StatusPill tone={STATUS_TONE[i.status]}>{i.status}</StatusPill>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-4 text-[11.5px] text-ink-400">
        Payments are recorded manually (mock) — “Mark paid” settles an invoice without a gateway. A real
        payment integration (Stripe) is a later phase; no card or money is handled here.
      </p>
    </div>
  );
}
