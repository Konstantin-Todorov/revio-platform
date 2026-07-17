import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, CreditCard, LogOut, Ban, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { SplitSquareHorizontal, ArrowRightLeft, ShieldCheck } from "lucide-react";
import { getFolioView } from "@/lib/folio";
import { OUTLET_LABEL } from "@/lib/posting";
import { postCharge, postPayment, voidFolioLine, createFolio, moveFolioLine, captureDeposit, useDeposit, refundDeposit } from "@/lib/actions-folio";
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

const KIND_LABEL: Record<string, string> = {
  accommodation: "Room", minibar: "Minibar", extra: "Extra", fee: "Fee", tax: "Tax", payment: "Payment",
  deposit_held: "Deposit held", deposit_use: "Deposit applied", deposit_refund: "Deposit refunded",
};
const KIND_TONE: Record<string, Tone> = {
  accommodation: "neutral", minibar: "info", extra: "neutral", fee: "warning", tax: "warning", payment: "success",
  deposit_held: "info", deposit_use: "success", deposit_refund: "neutral",
};
/** Held deposits are a liability — neither a charge nor a payment until applied (spec §4.4). */
const DEPOSIT_KINDS = new Set(["deposit_held", "deposit_use", "deposit_refund"]);
const inputCls = "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600";

export default async function FolioPage({ params, searchParams }: { params: Promise<{ reservationId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { reservationId } = await params;
  const { error } = await searchParams;
  const data = await getFolioView(reservationId);
  if (!data) redirect("/folios");
  const { reservation: r, folios, currency, combined, moveTargets, depositTypes } = data!;

  const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
  const rooms = r.assignments.map((a) => a.unit.label).join(", ");
  const open = folios.some((f) => f.status === "open");
  const settled = combined.balance === 0;
  const split = folios.length > 1;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/folios" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Folios
      </Link>
      <PageHeader
        title={`Folio — ${guestName}`}
        subtitle={`${rooms ? `Room ${rooms} · ` : ""}${currency}${!open ? " · closed" : ""}${split ? ` · ${folios.length} folios` : ""}`}
        action={open ? undefined : <StatusPill tone="neutral">Closed</StatusPill>}
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {ERRORS[error] ?? "Something went wrong — try again."}
        </div>
      )}

      {/* One bill card per folio (primary + split/company). Lines can move between them. */}
      {folios.map((folio) => (
        <Card key={folio.id} className="mb-4">
          <CardHeader
            title={`${folio.label}${folio.isPrimary ? "" : " folio"}`}
            action={<span className={`tnum text-[13px] font-bold ${folio.totals.balance === 0 ? "text-success-600" : "text-danger-600"}`}>{money(folio.totals.balance, currency)}</span>}
          />
          {folio.lines.length === 0 ? (
            <div className="px-4 py-4 text-center text-[12.5px] text-ink-400">No lines yet — move charges here from the guest folio.</div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {folio.lines.map((l) => {
                const isPayment = l.kind === "payment";
                const isDeposit = DEPOSIT_KINDS.has(l.kind);
                // Only a payment or an APPLIED deposit reduces the balance; a held/refunded deposit
                // is a liability movement and shows plain (spec §4.4).
                const isCredit = isPayment || l.kind === "deposit_use";
                return (
                  <li key={l.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${l.voided ? "opacity-50" : ""}`}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <StatusPill tone={KIND_TONE[l.kind] ?? "neutral"}>{KIND_LABEL[l.kind] ?? l.kind}</StatusPill>
                      <span className={`truncate text-[13px] ${l.voided ? "text-ink-400 line-through" : "text-ink-800"}`}>{l.description}</span>
                      {l.outlet && !isPayment && <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-ink-400">{OUTLET_LABEL[l.outlet] ?? l.outlet}</span>}
                      {l.voided && <span className="text-[10.5px] font-semibold uppercase tracking-wide text-danger-500">void</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`tnum text-[13px] font-semibold ${isCredit ? "text-success-600" : isDeposit ? "text-brand-700" : "text-ink-900"} ${l.voided ? "line-through" : ""}`}>
                        {isCredit ? "−" : ""}{money(l.amountMinor, currency)}
                      </span>
                      {/* Move this line to another folio of the stay (spec §3.6). */}
                      {open && !l.voided && !isPayment && !isDeposit && split && (
                        <form action={moveFolioLine} className="flex items-center">
                          <input type="hidden" name="reservationId" value={reservationId} />
                          <input type="hidden" name="lineId" value={l.id} />
                          <ArrowRightLeft className="h-3 w-3 text-ink-300" />
                          <select name="targetFolioId" defaultValue="" className="ml-0.5 max-w-[92px] rounded border border-surface-border bg-white py-0.5 pl-1 pr-4 text-[10.5px] text-ink-500 outline-none">
                            <option value="" disabled>move…</option>
                            {moveTargets.filter((t) => t.id !== folio.id).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                          </select>
                          <button type="submit" className="ml-0.5 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-ink-600 hover:bg-ink-100">go</button>
                        </form>
                      )}
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
          )}
        </Card>
      ))}

      {/* Combined total across every folio + add a split/company folio. */}
      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="space-y-1 text-[13px]">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-ink-500">
              <span>Charges {money(combined.charges, currency)}</span>
              <span>Payments −{money(combined.payments, currency)}</span>
              {combined.depositsHeld > 0 && (
                <span className="font-semibold text-brand-700" title="A held deposit is a liability — outside charges and payments until applied or refunded">
                  Deposits held {money(combined.depositsHeld, currency)}
                </span>
              )}
            </div>
            <div className="text-[15px] font-bold text-ink-900">Balance <span className={`tnum ${settled ? "text-success-600" : "text-danger-600"}`}>{money(combined.balance, currency)}</span> <span className="text-[11px] font-normal text-ink-400">across {folios.length} folio{folios.length === 1 ? "" : "s"}</span></div>
          </div>
          {open && (
            <form action={createFolio} className="flex items-center gap-1.5">
              <input type="hidden" name="reservationId" value={reservationId} />
              <input name="label" placeholder="Company" className={`${inputCls} w-28`} />
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-2 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
                <SplitSquareHorizontal className="h-3.5 w-3.5" /> Split
              </button>
            </form>
          )}
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
                <input name="amount" type="text" inputMode="decimal" required placeholder={`Amount (${currency})`} className={`${inputCls} flex-1`} />
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
                <input name="amount" type="text" inputMode="decimal" required placeholder={`Amount (${currency})`} className={`${inputCls} flex-1`} />
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

          {/* Deposits — a liability, not revenue (spec §4.4) */}
          <Card className="p-4 lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[13px] font-bold text-ink-900">Deposits</h3>
              <span className="text-[12px] text-ink-500">
                Held: <span className="tnum font-bold text-brand-700">{money(combined.depositsHeld, currency)}</span>
                <span className="ml-1.5 text-[11px] text-ink-400">money held that may be returned — outside the balance until applied</span>
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <form action={captureDeposit} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="reservationId" value={reservationId} />
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-ink-600">Type</span>
                  <select name="depositTypeId" className={`${inputCls} w-40`}>
                    {depositTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} · {t.behaviour === "held" ? "held" : "applied"}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-ink-600">Method</span>
                  <select name="method" defaultValue="cash" className={`${inputCls} w-24`}>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                  </select>
                </label>
                <input name="amount" type="text" inputMode="decimal" required placeholder={`Amount (${currency})`} className={`${inputCls} w-32`} />
                <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
                  <ShieldCheck className="h-3.5 w-3.5" /> Take deposit
                </button>
              </form>

              {combined.depositsHeld > 0 && (
                <div className="flex flex-wrap items-end gap-2 border-l border-surface-border pl-4">
                  <form action={useDeposit} className="flex items-end gap-1.5">
                    <input type="hidden" name="reservationId" value={reservationId} />
                    <input name="amount" type="text" inputMode="decimal" placeholder="all" className={`${inputCls} w-20`} />
                    <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-success-500 px-3 text-[12.5px] font-semibold text-success-600 transition-colors hover:bg-success-50">
                      Use deposit
                    </button>
                  </form>
                  <form action={refundDeposit} className="flex items-end gap-1.5">
                    <input type="hidden" name="reservationId" value={reservationId} />
                    <input name="amount" type="text" inputMode="decimal" placeholder="all" className={`${inputCls} w-20`} />
                    <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-surface-border px-3 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
                      Refund
                    </button>
                  </form>
                </div>
              )}
            </div>
            {depositTypes.length === 0 && <p className="mt-2 text-[11px] text-ink-400">No deposit types configured for this property yet.</p>}
          </Card>

          {/* Check out */}
          <Card className="p-4 lg:col-span-2">
            <h3 className="mb-3 text-[13px] font-bold text-ink-900">Check out</h3>
            {combined.depositsHeld > 0 && (
              <p className="mb-2.5 flex items-start gap-1.5 rounded-md bg-brand-50 px-2.5 py-2 text-[12px] text-brand-800">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span><span className="font-semibold">{money(combined.depositsHeld, currency)} still held.</span> Use it against the balance or refund it before the guest leaves.</span>
              </p>
            )}
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
                  Outstanding balance of <span className="font-bold text-danger-600">{money(combined.balance, currency)}</span> across {folios.length} folio{folios.length === 1 ? "" : "s"}. Settle it above, or check out with an override (logged).
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
          This folio is closed. Final balance {money(combined.balance, currency)}.
        </Card>
      )}
    </div>
  );
}
