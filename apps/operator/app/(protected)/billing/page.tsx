import { CreditCard, TrendingUp, FileText, Send, CheckCircle2, FilePlus2 } from "lucide-react";
import { getBilling } from "@/lib/data";
import { setPlan } from "@/lib/actions";
import { generateInvoices, setInvoiceStatus } from "@/lib/actions-billing";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

function money(minor: number, currency = "EUR"): string {
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency + " ";
  return `${sym}${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: minor % 100 ? 2 : 0 })}`;
}
const STATUS_TONE: Record<string, Tone> = { draft: "neutral", sent: "warning", paid: "success" };
const inputCls = "h-8 rounded-md border border-surface-border bg-white px-2 text-[12.5px] text-ink-900 outline-none focus:border-brand-600";

export default async function BillingPage() {
  const { period, clients, mrr, unpaidCount, recent } = await getBilling();

  const cards = [
    { icon: TrendingUp, tone: "success", value: money(mrr), label: "MRR", sub: "active clients" },
    { icon: CreditCard, tone: "info", value: clients.filter((c) => c.status === "active").length, label: "Active clients", sub: "billed monthly" },
    { icon: FileText, tone: unpaidCount ? "warning" : "neutral", value: unpaidCount, label: "Unpaid invoices", sub: "draft or sent" },
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
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{c.name}{c.status !== "active" && <span className="ml-1.5 text-[10.5px] font-semibold uppercase text-warning-600">{c.status}</span>}</td>
                  <td className="px-4 py-2.5">
                    <form action={setPlan} className="flex items-center gap-1">
                      <input type="hidden" name="tenantId" value={c.id} />
                      <select name="plan" defaultValue={c.plan} className={inputCls}>
                        <option value="starter">Starter</option>
                        <option value="growth">Growth</option>
                        <option value="scale">Scale</option>
                      </select>
                      <button type="submit" className="rounded border border-surface-border px-1.5 py-0.5 text-[11px] font-semibold text-ink-500 hover:bg-surface-muted">Save</button>
                    </form>
                  </td>
                  <td className="px-4 py-2.5 text-[11.5px] text-ink-500">{c.products}</td>
                  <td className="px-4 py-2.5 tnum font-semibold text-ink-900">{money(c.priceMinor)}</td>
                  <td className="px-4 py-2.5">
                    {!c.currentInvoice ? (
                      <span className="text-[11.5px] text-ink-400">not generated</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <StatusPill tone={STATUS_TONE[c.currentInvoice.status]}>{c.currentInvoice.status}</StatusPill>
                        {c.currentInvoice.status === "draft" && (
                          <form action={setInvoiceStatus}><input type="hidden" name="id" value={c.currentInvoice.id} /><input type="hidden" name="status" value="sent" />
                            <button type="submit" className="inline-flex items-center gap-1 rounded border border-surface-border px-1.5 py-0.5 text-[11px] font-semibold text-ink-600 hover:bg-surface-muted"><Send className="h-3 w-3" />Send</button></form>
                        )}
                        {c.currentInvoice.status === "sent" && (
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
                  <span className="tnum font-semibold text-ink-900">{money(i.amountMinor, i.currency)}</span>
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
