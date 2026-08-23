import Link from "next/link";
import { Receipt, Archive, FileText, CircleDollarSign } from "lucide-react";
import { Card, PageHeader, StatusPill } from "@/components/ui/primitives";
import { listFolios, listFolioHistory, listReceivables } from "@/lib/folio";
import { OpenFoliosTable, type OpenFolioRow } from "@/components/folios/OpenFoliosTable";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FoliosPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "history" ? "history" : sp.tab === "receivables" ? "receivables" : "open";

  // Open / History split (§4.1): Open = today's operational work; History = the read-only financial record.
  // Receivables is loaded on EVERY tab, not just its own, because its count belongs on the tab
  // label: money owed by people who have already left is the thing most easily forgotten, and a tab
  // you have to open to discover there is anything in it is a tab nobody opens.
  const [{ rows: openRows }, history, receivables] = await Promise.all([
    listFolios(),
    tab === "history" ? listFolioHistory(sp.q) : Promise.resolve(null),
    listReceivables(),
  ]);

  const Tab = ({ id, label, icon: Icon, count }: { id: "open" | "history" | "receivables"; label: string; icon: typeof Receipt; count?: number }) => (
    <Link
      href={`/folios?tab=${id}`}
      className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors ${
        tab === id ? "border-accent-600 text-accent-700" : "border-transparent text-ink-500 hover:text-ink-700"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
      {count ? <span className="rounded-full bg-danger-50 px-1.5 py-0.5 text-[10.5px] font-bold text-danger-600">{count}</span> : null}
    </Link>
  );

  return (
    <div>
      <PageHeader title="Folios &amp; Billing" subtitle="Open = live bills for in-house guests. Receivables = money owed by guests who have left. History = the settled financial record." />

      <div className="mb-4 flex items-center gap-1 border-b border-surface-border">
        <Tab id="open" label="Open" icon={Receipt} />
        <Tab id="receivables" label="Receivables" icon={CircleDollarSign} count={receivables.rows.length} />
        <Tab id="history" label="History" icon={Archive} />
      </div>

      {tab === "open" ? (
        openRows.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-[14px] font-semibold text-ink-900">No one in house</p>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-500">
              Folios open automatically when a guest checks in. Check someone in from the{" "}
              <Link href="/dashboard" className="font-semibold text-accent-600 underline">Front Desk</Link>.
            </p>
          </Card>
        ) : (
          <Card>
            <OpenFoliosTable rows={openRows.map<OpenFolioRow>((r) => ({ reservationId: r.reservationId, guestName: r.guestName, units: r.units, balance: r.balance, currency: r.currency }))} />
          </Card>
        )
      ) : tab === "receivables" ? (
        /* §1.5 — money owed by guests who have already left. Before this existed, a folio closed
           with a balance appeared in OPEN (it was derived from assignment rows, not folio status),
           so the debt was both invisible as a receivable and misleading as a live bill. */
        receivables.rows.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-[14px] font-semibold text-ink-900">Nothing outstanding</p>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-500">
              Every departed guest has settled. A stay checked out with an unpaid balance lands here until a manager resolves it.
            </p>
          </Card>
        ) : (
          <Card>
            <div className="flex items-baseline justify-between border-b border-surface-border px-4 py-3">
              <span className="text-[12.5px] font-semibold text-ink-700">
                {receivables.rows.length} unpaid folio{receivables.rows.length === 1 ? "" : "s"} · oldest first
              </span>
              <span className="tnum text-[15px] font-bold text-danger-600">
                {money(receivables.totalMinor, receivables.rows[0]!.currency)}
              </span>
            </div>
            <ul className="divide-y divide-surface-border">
              {receivables.rows.map((row) => (
                <li key={row.folioId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/folio/${row.reservationId}`} className="text-[13px] font-semibold text-accent-600 hover:underline">
                      {row.guestName}
                    </Link>
                    <div className="mt-0.5 text-[11.5px] text-ink-500">
                      {row.label}
                      {row.closedAt ? ` · left ${row.closedAt.toISOString().slice(0, 10)}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {/* Age is what makes this a list you work rather than read. A month-old debt and
                        yesterday's are not the same task, and a date you have to subtract in your
                        head does not say so. */}
                    <StatusPill tone={row.ageDays >= 30 ? "danger" : row.ageDays >= 7 ? "warning" : "neutral"}>
                      {row.ageDays === 0 ? "today" : `${row.ageDays}d`}
                    </StatusPill>
                    <span className="tnum text-[13px] font-bold text-danger-600">{money(row.balance, row.currency)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-surface-border px-4 py-2.5 text-[11px] text-ink-400">
              Open a folio to resolve it — reopen and take payment, mark it paid off-system, keep chasing it, or write it off.
            </p>
          </Card>
        )
      ) : (
        <Card>
          {/* History search (§4.2) — read-only archive; find a guest's folio, its invoices reachable. */}
          <form method="GET" className="flex items-center gap-2 border-b border-surface-border px-4 py-2.5">
            <input type="hidden" name="tab" value="history" />
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Search guest, reservation # or invoice #…" className="w-full bg-transparent text-[13px] text-ink-900 outline-none placeholder:text-ink-400" />
            <button className="shrink-0 rounded-md bg-accent-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-500">Search</button>
            {sp.q && <Link href="/folios?tab=history" className="shrink-0 text-[12px] font-semibold text-ink-500 hover:underline">Clear</Link>}
          </form>
          {!history || history.rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12.5px] text-ink-400">{sp.q ? `No settled folios match “${sp.q}”.` : "No departed stays yet — the archive fills as guests check out."}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                    <th className="px-4 py-2.5">Guest</th>
                    <th className="px-4 py-2.5">Stay</th>
                    <th className="px-4 py-2.5">Room</th>
                    <th className="px-4 py-2.5">Invoice</th>
                    <th className="px-4 py-2.5 text-right">Balance</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.rows.map((r) => (
                    <tr key={r.reservationId} className="border-b border-surface-border/60 last:border-0 hover:bg-surface-muted">
                      <td className="px-4 py-2.5">
                        <Link href={`/folio/${r.reservationId}`} className="font-semibold text-accent-600 hover:underline">{r.guestName}</Link>
                        <div className="tnum text-[11px] text-ink-400">#{r.externalId ?? r.reservationId.slice(-6)}</div>
                      </td>
                      <td className="tnum px-4 py-2.5 text-ink-600">{r.checkIn && r.checkOut ? `${r.checkIn} → ${r.checkOut}` : "—"}</td>
                      <td className="px-4 py-2.5 text-ink-600">{r.units.join(", ") || "—"}</td>
                      <td className="px-4 py-2.5 text-ink-600">
                        {r.invoiceNumbers.length ? (
                          <span className="inline-flex items-center gap-1 tnum text-[12px]"><FileText className="h-3 w-3 text-ink-400" />{r.invoiceNumbers.join(", ")}</span>
                        ) : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{r.balanceMinor == null ? "—" : money(r.balanceMinor, r.currency)}</td>
                      <td className="px-4 py-2.5">
                        <StatusPill tone={r.settled ? "success" : (r.balanceMinor ?? 0) > 0 ? "danger" : "neutral"}>
                          {r.settled ? "Settled" : (r.balanceMinor ?? 0) > 0 ? "Balance due" : "Open"}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-surface-border/60 px-4 py-2 text-[11px] text-ink-400">
            History is read-only — a closed folio is corrected with a credit note, never edited.
          </p>
        </Card>
      )}
    </div>
  );
}
