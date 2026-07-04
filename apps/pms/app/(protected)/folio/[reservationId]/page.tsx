import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, CreditCard, LogOut, Ban, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { getFolioView } from "@/lib/folio";
import { postCharge, postPayment, voidFolioLine } from "@/lib/actions-folio";
import { checkOut } from "@/lib/actions-frontdesk";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  charge: "Enter a description and a positive amount.",
  payment: "Choose a method and a positive amount.",
  closed: "This folio is closed — no more postings.",
  voidaccom: "Accommodation lines can’t be voided (they come from the reservation).",
  balance: "Settle the balance first, or check out with an override below.",
};

const KIND_LABEL: Record<string, string> = { accommodation: "Room", minibar: "Minibar", extra: "Extra", fee: "Fee", tax: "Tax", payment: "Payment" };
const KIND_TONE: Record<string, Tone> = { accommodation: "neutral", minibar: "info", extra: "neutral", fee: "warning", tax: "warning", payment: "success" };
const inputCls = "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600";

export default async function FolioPage({ params, searchParams }: { params: Promise<{ reservationId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { reservationId } = await params;
  const { error } = await searchParams;
  const data = await getFolioView(reservationId);
  if (!data) redirect("/folios");
  const { reservation: r, folio, totals } = data!;

  const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
  const rooms = folio ? r.assignments.map((a) => a.unit.label).join(", ") : "";
  const open = folio.status === "open";
  const settled = totals.balance === 0;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/folios" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Folios
      </Link>
      <PageHeader
        title={`Folio — ${guestName}`}
        subtitle={`${rooms ? `Room ${rooms} · ` : ""}${folio.currency}${!open ? " · closed" : ""}`}
        action={open ? undefined : <StatusPill tone="neutral">Closed</StatusPill>}
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {ERRORS[error] ?? "Something went wrong — try again."}
        </div>
      )}

      {/* Bill */}
      <Card className="mb-4">
        <CardHeader title="Bill" />
        <ul className="divide-y divide-surface-border">
          {folio.lines.map((l) => {
            const isPayment = l.kind === "payment";
            return (
              <li key={l.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${l.voided ? "opacity-50" : ""}`}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <StatusPill tone={KIND_TONE[l.kind] ?? "neutral"}>{KIND_LABEL[l.kind] ?? l.kind}</StatusPill>
                  <span className={`truncate text-[13px] ${l.voided ? "text-ink-400 line-through" : "text-ink-800"}`}>{l.description}</span>
                  {l.voided && <span className="text-[10.5px] font-semibold uppercase tracking-wide text-danger-500">void</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`tnum text-[13px] font-semibold ${isPayment ? "text-success-600" : "text-ink-900"} ${l.voided ? "line-through" : ""}`}>
                    {isPayment ? "−" : ""}{money(l.amountMinor, folio.currency)}
                  </span>
                  {open && !l.voided && l.kind !== "accommodation" && (
                    <form action={voidFolioLine}>
                      <input type="hidden" name="reservationId" value={reservationId} />
                      <input type="hidden" name="lineId" value={l.id} />
                      <button type="submit" aria-label="Void line" title="Void" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-danger-50 hover:text-danger-600">
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="space-y-1 border-t border-surface-border px-4 py-3 text-[13px]">
          <div className="flex justify-between text-ink-500"><span>Charges</span><span className="tnum">{money(totals.charges, folio.currency)}</span></div>
          <div className="flex justify-between text-ink-500"><span>Payments</span><span className="tnum">−{money(totals.payments, folio.currency)}</span></div>
          <div className="flex justify-between pt-1 text-[15px] font-bold text-ink-900"><span>Balance</span><span className={`tnum ${settled ? "text-success-600" : "text-danger-600"}`}>{money(totals.balance, folio.currency)}</span></div>
        </div>
      </Card>

      {open ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Post a charge */}
          <Card className="p-4">
            <h3 className="mb-3 text-[13px] font-bold text-ink-900">Post a charge</h3>
            <form action={postCharge} className="space-y-2.5">
              <input type="hidden" name="reservationId" value={reservationId} />
              <div className="flex gap-2">
                <select name="kind" defaultValue="minibar" className={`${inputCls} w-28`}>
                  <option value="minibar">Minibar</option>
                  <option value="extra">Extra</option>
                  <option value="fee">Fee</option>
                </select>
                <input name="description" required placeholder="Description" className={`${inputCls} flex-1`} />
              </div>
              <div className="flex gap-2">
                <input name="amount" type="text" inputMode="decimal" required placeholder={`Amount (${folio.currency})`} className={`${inputCls} flex-1`} />
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-500">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </form>
          </Card>

          {/* Record a payment */}
          <Card className="p-4">
            <h3 className="mb-3 text-[13px] font-bold text-ink-900">Record a payment</h3>
            <form action={postPayment} className="space-y-2.5">
              <input type="hidden" name="reservationId" value={reservationId} />
              <div className="flex gap-2">
                <select name="method" defaultValue="cash" className={`${inputCls} w-36`}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="company_account">Company account</option>
                  <option value="bank_transfer">Bank transfer</option>
                </select>
                <input name="amount" type="text" inputMode="decimal" required placeholder={`Amount (${folio.currency})`} className={`${inputCls} flex-1`} />
              </div>
              <div className="flex gap-2">
                <input name="ref" type="text" placeholder="Reference (optional)" className={`${inputCls} flex-1`} />
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-accent-500 px-3 text-[12.5px] font-semibold text-accent-600 transition-colors hover:bg-accent-50">
                  <CreditCard className="h-3.5 w-3.5" /> Take
                </button>
              </div>
              <p className="text-[10.5px] text-ink-400">Label + amount only — no card number is stored or processed.</p>
            </form>
          </Card>

          {/* Check out */}
          <Card className="p-4 lg:col-span-2">
            <h3 className="mb-3 text-[13px] font-bold text-ink-900">Check out</h3>
            {settled ? (
              <form action={checkOut} className="flex items-center gap-3">
                <input type="hidden" name="reservationId" value={reservationId} />
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-success-600"><CheckCircle2 className="h-4 w-4" /> Balance settled</span>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700">
                  <LogOut className="h-4 w-4" /> Check out
                </button>
              </form>
            ) : (
              <form action={checkOut} className="space-y-2.5">
                <input type="hidden" name="reservationId" value={reservationId} />
                <input type="hidden" name="override" value="1" />
                <p className="text-[12.5px] text-ink-600">
                  Outstanding balance of <span className="font-bold text-danger-600">{money(totals.balance, folio.currency)}</span>. Settle it above, or check out with an override (logged).
                </p>
                <div className="flex gap-2">
                  <input name="reason" type="text" placeholder="Override reason (e.g. bill to company)" className={`${inputCls} flex-1`} />
                  <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-danger-500 px-3 py-2 text-[12.5px] font-semibold text-danger-600 transition-colors hover:bg-danger-50">
                    <LogOut className="h-3.5 w-3.5" /> Check out with balance
                  </button>
                </div>
              </form>
            )}
          </Card>
        </div>
      ) : (
        <Card className="p-4 text-center text-[13px] text-ink-500">
          This folio is closed. Final balance {money(totals.balance, folio.currency)}.
        </Card>
      )}
    </div>
  );
}
