import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, CreditCard, LogOut, Ban, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { SplitSquareHorizontal, ArrowRightLeft, ShieldCheck, Repeat, FileText, Trash2 } from "lucide-react";
import { getFolioView } from "@/lib/folio";
import { assessMoveForReservation } from "@/lib/move-reconciliation";
import { listInvoicesForReservation, DOC_LABEL } from "@/lib/invoice";
import { gatewayMode } from "@revio/payments";
import { OUTLET_LABEL } from "@/lib/posting";
import { postCharge, postPayment, voidFolioLine, createFolio, removeFolio, resolveFolio, resolveMoveDifference, moveFolioLine, captureDeposit, useDeposit, refundDeposit, addStayExtra, removeStayExtra } from "@/lib/actions-folio";
import { issueInvoice } from "@/lib/actions-invoice";
import { checkOut } from "@/lib/actions-frontdesk";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

/** How a closed folio ended, said plainly. `outstanding` is the only one that is still a task. */
const OUTCOME_LABEL: Record<string, string> = {
  settled: "Settled",
  outstanding: "Outstanding",
  paid_offsystem: "Paid off-system",
  written_off: "Written off",
};
const OUTCOME_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  settled: "success",
  outstanding: "danger",
  paid_offsystem: "success",
  written_off: "warning",
};

/**
 * The four exits from "closed — outstanding" (§1.4).
 *
 * Ordered by how good the outcome is for the hotel: the money arrives, the money arrived elsewhere,
 * the money is still coming, the money is gone. Write-off is last and is the only one styled as
 * destructive, because it is the only one that turns a receivable into a loss.
 */
const RESOLUTIONS = [
  {
    key: "reopen",
    label: "Reopen and take payment",
    detail: "Reopens the folio so a payment can be posted normally, then it closes at zero.",
    cta: "Reopen",
    needsNote: false,
    tone: "normal" as const,
    notePlaceholder: "",
  },
  {
    key: "paid_offsystem",
    label: "Mark as paid — settled off-system",
    detail: "The money arrived another way: bank transfer, cash, an external card terminal.",
    cta: "Mark paid",
    needsNote: true,
    tone: "normal" as const,
    notePlaceholder: "Method and reference",
  },
  {
    key: "receivable",
    label: "Keep as a receivable",
    detail: "Still owed and still being chased — billed to a company, invoice sent.",
    cta: "Keep chasing",
    needsNote: true,
    tone: "normal" as const,
    notePlaceholder: "Who owes it, and by when",
  },
  {
    key: "written_off",
    label: "Write off",
    detail: "The balance is forgiven. Recorded as a loss, never as a payment.",
    cta: "Write off",
    needsNote: true,
    tone: "danger" as const,
    notePlaceholder: "Reason for the write-off",
  },
];

/** What each move resolution means, in the words a manager would use (§2.5). */
const MOVE_OPTION: Record<string, { label: string; detail: string; cta: string }> = {
  comp: { label: "Complimentary", detail: "Given away. Nothing is posted, and it is recorded as a comp so it can be counted.", cta: "Comp it" },
  charge: { label: "Charge the difference", detail: "Post the extra to the folio — the guest pays for the better room.", cta: "Charge" },
  refund: { label: "Refund the difference", detail: "Money goes back to the guest for the lesser room.", cta: "Refund" },
  waive: { label: "Waive it", detail: "Nothing goes back. The owed amount is removed, and the decision is logged.", cta: "Waive" },
  custom: { label: "Set an amount", detail: "Any of the above at a figure you choose.", cta: "Apply" },
};

const ERRORS: Record<string, string> = {
  charge: "Enter a description and a positive amount.",
  payment: "Choose a method and a positive amount.",
  closed: "This folio is closed — no more postings.",
  voidaccom: "Accommodation lines can’t be voided (they come from the reservation).",
  balance: "Settle the balance first, or check out with an override below.",
  deposit: "Enter a positive amount (and, to capture, a deposit type).",
  extra: "Enter a name and a positive per-night price.",
  buyer: "Enter who the invoice is billed to.",
  invoice: "Couldn’t issue the invoice — is there a folio to bill?",
  gateway: "The card gateway declined the transaction — try again or use another method.",
  folioprimary: "The main folio is the stay’s bill — it can’t be removed, only closed.",
  folioclosed: "A closed folio is part of the financial record — correct it with a credit note.",
  foliolines: "Move this folio’s charges back to another folio first, then remove it.",
  departed: "This stay has already checked out. Reopen it to make changes.",
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

export default async function FolioPage({ params, searchParams }: { params: Promise<{ reservationId: string }>; searchParams: Promise<{ error?: string; moved?: string }> }) {
  const { reservationId } = await params;
  const { error, moved } = await searchParams;
  const data = await getFolioView(reservationId);
  if (!data) redirect("/folios");
  const { reservation: r, folios, currency, combined, moveTargets, depositTypes, stayExtras, isManager } = data!;
  const invoices = await listInvoicesForReservation(reservationId);
  // Only present while a cross-type move is unreconciled (§2.5).
  const move = await assessMoveForReservation(reservationId);

  const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
  const rooms = r.assignments.map((a) => a.unit.label).join(", ");
  const open = folios.some((f) => f.status === "open");
  const settled = combined.balance === 0;
  const split = folios.length > 1;
  // Which folio the §1.4 resolutions act on: the closed one still carrying a balance. Falls back to
  // the primary only so the form always has a target; when nothing is outstanding the panel that
  // uses it is not rendered at all.
  const outstandingFolio =
    folios.find((f) => f.status === "closed" && f.totals.balance !== 0) ?? folios[0]!;
  const outstandingCount = folios.filter((f) => f.status === "closed" && f.totals.balance !== 0).length;

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

      {/* The price question a cross-type move opens (§2.5). The move already happened — the guest is
          in the room — so this is not a confirmation, it is the decision that follows: give it away,
          sell it, or set an amount. Nothing is posted until somebody chooses, because a difference
          posted automatically is one nobody agreed to. */}
      {move && move.kind === "rate_affecting" && (
        <Card className="mb-4 p-4">
          <h3 className="text-[13px] font-bold text-ink-900">
            {move.direction === "upgrade" ? "Upgraded" : move.direction === "downgrade" ? "Downgraded" : "Moved"} to a different room type
          </h3>
          <p className="mt-1 text-[12.5px] text-ink-600">
            Booked <span className="font-semibold">{move.bookedRoomTypeName}</span>, staying in{" "}
            <span className="font-semibold">{move.accommodatedRoomTypeName}</span> (room {move.unitLabel}).{" "}
            {move.nights.length > 0 ? (
              <>
                Priced over {move.nights.length} night{move.nights.length === 1 ? "" : "s"}
                {move.nights[0] !== undefined && <> from {move.nights[0]}</>} — nights already slept are not re-priced.
              </>
            ) : (
              <>No nights left to re-price.</>
            )}
          </p>

          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-[12px] text-ink-500">Difference</span>
            <span className={`tnum text-[16px] font-bold ${move.direction === "upgrade" ? "text-ink-900" : "text-success-600"}`}>
              {move.differenceMinor >= 0 ? "+" : "−"}{money(Math.abs(move.differenceMinor), move.currency)}
            </span>
          </div>

          {!isManager && (
            <p className="mt-2 text-[12px] text-ink-500">A manager decides what happens to this amount.</p>
          )}

          <div className="mt-3 space-y-2">
            {move.options.map((opt) => (
              <form key={opt} action={resolveMoveDifference} className="flex flex-wrap items-center gap-2 rounded-md border border-surface-border px-3 py-2.5">
                <input type="hidden" name="reservationId" value={reservationId} />
                <input type="hidden" name="resolution" value={opt} />
                <div className="min-w-[180px] flex-1">
                  <div className="text-[12.5px] font-semibold text-ink-900">{MOVE_OPTION[opt].label}</div>
                  <div className="text-[11.5px] text-ink-500">{MOVE_OPTION[opt].detail}</div>
                </div>
                {opt === "custom" && (
                  <input name="amountMinor" type="number" min="0" placeholder="Amount in cents" disabled={!isManager}
                    className={`${inputCls} w-36 disabled:cursor-not-allowed disabled:bg-surface-muted`} />
                )}
                <input name="note" type="text" placeholder="Reason (optional)" disabled={!isManager}
                  className={`${inputCls} w-44 disabled:cursor-not-allowed disabled:bg-surface-muted`} />
                <button type="submit" disabled={!isManager}
                  title={isManager ? undefined : "Manager approval required"}
                  className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-2 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:text-ink-300 disabled:hover:bg-transparent">
                  {MOVE_OPTION[opt].cta}
                </button>
              </form>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-ink-400">
            The booking itself is unchanged and nothing was sent to any channel — the guest still bought{" "}
            {move.bookedRoomTypeName}.
          </p>
        </Card>
      )}

      {/* Landed here from a cross-type move (§2.5). The room changed; what was SOLD did not, and the
          difference is a decision rather than an automatic posting. Saying so here — where the money
          is — is the difference between a considered comp and a silently absorbed one. */}
      {moved && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-brand-50 px-3 py-2.5 text-[12.5px] text-brand-800">
          <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <span className="font-bold">Moved to a different room type.</span>{" "}
            The booking is unchanged — the guest still bought what they bought, and nothing was sent to any channel.
            If the new room prices differently, post the difference as a charge, or comp it. Either way it is recorded.
          </div>
        </div>
      )}

      {/* One bill card per folio (primary + split/company). Lines can move between them. */}
      {folios.map((folio) => (
        <Card key={folio.id} className="mb-4">
          <CardHeader
            title={`${folio.label}${folio.isPrimary ? "" : " folio"}`}
            action={
              <div className="flex items-center gap-2.5">
                {folio.status === "closed" && folio.outcome && (
                  <StatusPill tone={OUTCOME_TONE[folio.outcome] ?? "neutral"}>{OUTCOME_LABEL[folio.outcome] ?? folio.outcome}</StatusPill>
                )}
                <span className={`tnum text-[13px] font-bold ${folio.totals.balance === 0 ? "text-success-600" : "text-danger-600"}`}>{money(folio.totals.balance, currency)}</span>
                {/* The inverse `createFolio` never had (§1.6). Only where it is actually safe: a
                    non-primary, open, empty split. Everywhere else the action refuses anyway, and a
                    button that always errors is worse than no button. */}
                {!folio.isPrimary && folio.status === "open" && folio.lines.filter((l) => !l.voided).length === 0 && (
                  <form action={removeFolio}>
                    <input type="hidden" name="reservationId" value={reservationId} />
                    <input type="hidden" name="folioId" value={folio.id} />
                    <button type="submit" title="Remove this empty split folio" className="inline-flex items-center gap-1 rounded-md border border-surface-border px-2 py-1 text-[11px] font-semibold text-ink-500 transition-colors hover:bg-danger-50 hover:text-danger-600">
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </form>
                )}
              </div>
            }
          />
          {folio.lines.length === 0 ? (
            <div className="px-4 py-4 text-center text-[12.5px] text-ink-400">Nothing on this folio yet — move charges across from the main one.</div>
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
              <p className="text-[10.5px] text-ink-400">
                Cash / company / bank are drawer entries. Card runs through the payment gateway
                ({gatewayMode() === "stripe_test" ? "Stripe test-mode" : "mock"}) — only a token is stored, never a card number.
              </p>
            </form>
          </Card>

          {/* Stay extras — recurring, accrue per night at the audit (spec §3.6) */}
          <Card className="p-4 lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[13px] font-bold text-ink-900">Stay extras</h3>
              <span className="text-[11px] text-ink-400">Recurring per night — posts at each night audit. Doesn’t change the booked rate plan; the folio reflects reality.</span>
            </div>
            {stayExtras.length > 0 && (
              <ul className="mb-3 divide-y divide-surface-border/60 rounded-md border border-surface-border">
                {stayExtras.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[12.5px]">
                    <span className="flex items-center gap-1.5 font-semibold text-ink-800"><Repeat className="h-3 w-3 text-accent-600" />{e.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="tnum text-ink-600">{money(e.priceMinor, currency)} / night</span>
                      <form action={removeStayExtra}>
                        <input type="hidden" name="reservationId" value={reservationId} />
                        <input type="hidden" name="id" value={e.id} />
                        <button type="submit" title="Stop this extra (nights already accrued stay on the bill)" className="flex h-6 w-6 items-center justify-center rounded text-ink-300 transition-colors hover:bg-danger-50 hover:text-danger-600">
                          <Ban className="h-3 w-3" />
                        </button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <form action={addStayExtra} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="reservationId" value={reservationId} />
              <input name="name" required placeholder="e.g. Breakfast" className={`${inputCls} w-40`} />
              <input name="price" type="text" inputMode="decimal" required placeholder={`Per night (${currency})`} className={`${inputCls} w-32`} />
              <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-accent-500 px-3 text-[12.5px] font-semibold text-accent-600 transition-colors hover:bg-accent-50">
                <Repeat className="h-3.5 w-3.5" /> Add for the stay
              </button>
            </form>
          </Card>

          {/* Invoicing — render a folio (or the split's chosen folio) as a numbered tax document (§4.3) */}
          <Card className="p-4 lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[13px] font-bold text-ink-900">Invoicing</h3>
              <span className="text-[11px] text-ink-400">Charges live on folios; an invoice renders them as a numbered tax document — gapless series, tax per rate, accommodation broken out.</span>
            </div>
            {invoices.length > 0 && (
              <ul className="mb-3 divide-y divide-surface-border/60 rounded-md border border-surface-border">
                {invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[12.5px]">
                    <Link href={`/invoice/${inv.id}`} className="flex items-center gap-1.5 font-semibold text-accent-600 hover:underline">
                      <FileText className="h-3 w-3" /> {inv.number}
                      <span className="font-normal text-ink-400">· {DOC_LABEL[inv.docType as "invoice"] ?? inv.docType} · {inv.buyerName}</span>
                    </Link>
                    <span className="tnum text-ink-700">{money(inv.grossMinor, inv.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
            <form action={issueInvoice} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="reservationId" value={reservationId} />
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-ink-600">Document</span>
                <select name="docType" defaultValue="invoice" className={`${inputCls} w-28`}>
                  <option value="invoice">Invoice</option>
                  <option value="proforma">Proforma</option>
                  <option value="credit_note">Credit note</option>
                </select>
              </label>
              {folios.length > 1 && (
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-ink-600">Folio</span>
                  <select name="folioId" defaultValue={folios[0]!.id} className={`${inputCls} w-28`}>
                    {folios.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-ink-600">Bill to</span>
                <input name="buyerName" required defaultValue={guestName} className={`${inputCls} w-40`} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-ink-600">Buyer VAT ID</span>
                <input name="buyerVatId" placeholder="(company)" className={`${inputCls} w-32`} />
              </label>
              <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
                <FileText className="h-3.5 w-3.5" /> Issue
              </button>
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
            {/* No deposit types yet — so there is nothing to take a deposit AS. The form used to
                render anyway: an empty dropdown, a live "Take deposit" button, and a grey footnote
                explaining why it could not work. That reads as half-built rather than as
                not-set-up-yet, and the button was a trap. Say what is missing and where to fix it. */}
            {depositTypes.length === 0 ? (
              <div className="rounded-md border border-dashed border-surface-border px-3 py-4 text-center">
                <p className="text-[12.5px] font-semibold text-ink-700">No deposit types set up</p>
                <p className="mx-auto mt-1 max-w-sm text-[11.5px] text-ink-500">
                  A deposit type decides whether the money is <em>held</em> as a liability or applied to the bill
                  straight away — so one has to exist before a deposit can be taken.
                </p>
                <Link
                  href="/configuration"
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-1.5 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
                >
                  Set them up in Configuration
                </Link>
              </div>
            ) : (
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
            )}
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
        settled ? (
          <Card className="p-4 text-center text-[13px] text-ink-500">
            This folio is closed and settled. Final balance {money(combined.balance, currency)}.
          </Card>
        ) : (
          /* CLOSED — OUTSTANDING (§1.4). This card is the whole point of the round: the screen used
             to say "closed · final balance €513" and stop, which is a record in a state with no
             available action. The money is still owed, so it says so, and it offers the four ways
             out. Every one is logged with who and why. */
          <Card className="p-4">
            <div className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
              <div className="text-[12.5px] text-danger-700">
                <span className="font-bold">Closed with {money(combined.balance, currency)} outstanding.</span>{" "}
                The stay has ended and this money is still owed. It stays on the{" "}
                <Link href="/folios?tab=receivables" className="font-semibold underline">receivables list</Link> until it is resolved.
                {outstandingCount > 1 && (
                  <> These resolutions apply to <span className="font-semibold">{outstandingFolio.label}</span> — {outstandingCount - 1} other folio{outstandingCount === 2 ? "" : "s"} on this stay {outstandingCount === 2 ? "is" : "are"} also outstanding and {outstandingCount === 2 ? "needs" : "need"} resolving separately.</>
                )}
              </div>
            </div>

            {!isManager && (
              <p className="mb-3 text-[12px] text-ink-500">
                A manager settles this. You can see what is owed and what the options are, but not choose one.
              </p>
            )}

            <div className="space-y-2">
              {RESOLUTIONS.map((res) => (
                <form key={res.key} action={resolveFolio} className="flex flex-wrap items-center gap-2 rounded-md border border-surface-border px-3 py-2.5">
                  <input type="hidden" name="reservationId" value={reservationId} />
                  {/* The folio that actually owes money, not simply the first one. With a company
                      split the debt is often NOT on the primary, and resolving the wrong folio would
                      report the wrong one settled while the real balance stayed outstanding. */}
                  <input type="hidden" name="folioId" value={outstandingFolio.id} />
                  <input type="hidden" name="resolution" value={res.key} />
                  <div className="min-w-[190px] flex-1">
                    <div className="text-[12.5px] font-semibold text-ink-900">{res.label}</div>
                    <div className="text-[11.5px] text-ink-500">{res.detail}</div>
                  </div>
                  {res.needsNote && (
                    <input name="note" type="text" placeholder={res.notePlaceholder} disabled={!isManager} className={`${inputCls} w-52 disabled:cursor-not-allowed disabled:bg-surface-muted`} />
                  )}
                  <button
                    type="submit"
                    disabled={!isManager}
                    title={isManager ? undefined : "Manager approval required"}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-semibold transition-colors ${
                      res.tone === "danger"
                        ? "border border-danger-500 text-danger-600 hover:bg-danger-50"
                        : "border border-surface-border text-ink-700 hover:bg-surface-muted"
                    } disabled:cursor-not-allowed disabled:border-surface-border disabled:text-ink-300 disabled:hover:bg-transparent`}
                  >
                    {res.cta}
                  </button>
                </form>
              ))}
            </div>

            <p className="mt-3 text-[11px] text-ink-400">
              Money that arrived off-system and money that was written off both close the folio at zero, and are
              recorded separately — one is revenue collected, the other is revenue lost.
            </p>
          </Card>
        )
      )}
    </div>
  );
}
