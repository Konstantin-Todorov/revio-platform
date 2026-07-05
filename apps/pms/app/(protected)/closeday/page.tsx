import Link from "next/link";
import { Moon, UserX, LogOut, Receipt, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getCloseDayView } from "@/lib/closeday";
import { markNoShow, closeDay } from "@/lib/actions-closeday";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function pretty(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${MO[(m ?? 1) - 1]} ${y}`;
}

export default async function CloseDayPage({ searchParams }: { searchParams: Promise<{ closed?: string }> }) {
  const { closed } = await searchParams;
  const { property, today, businessDate, noShowCandidates, dueOutStillIn, unsettled } = await getCloseDayView();
  const behind = businessDate < today;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Close Day" subtitle={`${property.name} · night audit`} />

      {closed != null && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-success-50 px-3 py-2 text-[12.5px] font-medium text-success-600">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Day closed — {closed} reservation{closed === "1" ? "" : "s"} marked no-show, business date rolled forward.
        </div>
      )}

      {/* Business date */}
      <Card className="mb-4 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Moon className="h-5 w-5" /></div>
          <div>
            <div className="text-[12px] font-medium text-ink-500">Current business date</div>
            <div className="text-[18px] font-bold tracking-tight text-ink-900">{pretty(businessDate)}</div>
          </div>
          {behind && <span className="ml-auto rounded bg-warning-50 px-2 py-1 text-[11px] font-semibold text-warning-600">behind calendar ({pretty(today)})</span>}
        </div>
      </Card>

      {/* No-show candidates */}
      <Card className="mb-4">
        <CardHeader title="Un-arrived — will become no-shows" action={<span className="flex items-center gap-1 text-[12px] font-semibold text-ink-400"><UserX className="h-3.5 w-3.5" />{noShowCandidates.length}</span>} />
        {noShowCandidates.length === 0 ? (
          <div className="px-4 py-5 text-center text-[12.5px] text-ink-400">Everyone expected has arrived. 🎉</div>
        ) : (
          <ul className="divide-y divide-surface-border">
            {noShowCandidates.map((r) => (
              <li key={r.reservationId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-ink-900">{r.guestName}</div>
                  <div className="text-[11.5px] text-ink-500">{r.detail}</div>
                </div>
                <form action={markNoShow}>
                  <input type="hidden" name="reservationId" value={r.reservationId} />
                  <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted hover:text-danger-600">
                    <UserX className="h-3.5 w-3.5" /> No-show
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Warnings: due-out still in, unsettled folios */}
      {(dueOutStillIn.length > 0 || unsettled.length > 0) && (
        <Card className="mb-4">
          <CardHeader title="Before you close" />
          <ul className="divide-y divide-surface-border">
            {dueOutStillIn.map((r) => (
              <li key={`o-${r.reservationId}`} className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]">
                <span className="flex items-center gap-2 text-ink-700"><LogOut className="h-3.5 w-3.5 text-warning-600" /> {r.guestName} — {r.detail} (not checked out)</span>
                <Link href={`/folio/${r.reservationId}`} className="text-[11.5px] font-semibold text-accent-600 hover:underline">Check out</Link>
              </li>
            ))}
            {unsettled.map((r) => (
              <li key={`u-${r.reservationId}`} className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]">
                <span className="flex items-center gap-2 text-ink-700"><Receipt className="h-3.5 w-3.5 text-danger-600" /> {r.guestName} — open balance {money(r.balance, r.currency)}</span>
                <Link href={`/folio/${r.reservationId}`} className="text-[11.5px] font-semibold text-accent-600 hover:underline">Folio</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Close */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12.5px] text-ink-600">
            <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
              Closing will mark the {noShowCandidates.length} un-arrived reservation{noShowCandidates.length === 1 ? "" : "s"} as no-show and roll the business date to {pretty(businessDate)} + 1 day.</p>
          </div>
          <form action={closeDay}>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              <Moon className="h-4 w-4" /> Close {pretty(businessDate)}
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
