import Link from "next/link";
import { Receipt, Archive, FileText, CircleDollarSign } from "lucide-react";
import { Card, PageHeader, StatusPill } from "@/components/ui/primitives";
import { listFolios, listFolioHistory, listReceivables, folioOutcomeSummary } from "@/lib/folio";
import { OutcomeSummary } from "@/components/folios/OutcomeSummary";
import { OpenFoliosTable, type OpenFolioRow } from "@/components/folios/OpenFoliosTable";
import { i18n } from "@/lib/i18n/server";
import { folios as foliosDict } from "@/lib/i18n/folios";

export const dynamic = "force-dynamic";

export default async function FoliosPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "history" ? "history" : sp.tab === "receivables" ? "receivables" : "open";
  const { t, money } = await i18n();
  const s = t(foliosDict);

  // Open / History split (§4.1): Open = today's operational work; History = the read-only financial record.
  // Receivables is loaded on EVERY tab, not just its own, because its count belongs on the tab
  // label: money owed by people who have already left is the thing most easily forgotten, and a tab
  // you have to open to discover there is anything in it is a tab nobody opens.
  const [{ rows: openRows }, history, receivables, outcomes] = await Promise.all([
    listFolios(),
    tab === "history" ? listFolioHistory(sp.q) : Promise.resolve(null),
    listReceivables(),
    // Only on History: it is the financial record, and this is the summary of it (J1).
    tab === "history" ? folioOutcomeSummary() : Promise.resolve(null),
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
      <PageHeader title={s.title} subtitle={s.subtitle} />

      <div className="mb-4 flex items-center gap-1 border-b border-surface-border">
        <Tab id="open" label={s.tabs.open} icon={Receipt} />
        <Tab id="receivables" label={s.tabs.receivables} icon={CircleDollarSign} count={receivables.rows.length} />
        <Tab id="history" label={s.tabs.history} icon={Archive} />
      </div>

      {tab === "open" ? (
        openRows.length === 0 ? (
          <Card surface="flat" className="p-8 text-center">
            <p className="text-[14px] font-semibold text-ink-900">{s.noOneTitle}</p>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-500">
              {s.noOneBefore}{" "}
              <Link href="/dashboard" className="font-semibold text-accent-600 underline">{s.frontDesk}</Link>.
            </p>
          </Card>
        ) : (
          <Card surface="flat">
            <OpenFoliosTable t={s.table} rows={openRows.map<OpenFolioRow>((r) => ({ reservationId: r.reservationId, guestName: r.guestName, units: r.units, balance: r.balance, currency: r.currency, balanceLabel: r.balance == null ? null : money(r.balance, r.currency) }))} />
          </Card>
        )
      ) : tab === "receivables" ? (
        /* §1.5 — money owed by guests who have already left. Before this existed, a folio closed
           with a balance appeared in OPEN (it was derived from assignment rows, not folio status),
           so the debt was both invisible as a receivable and misleading as a live bill. */
        receivables.rows.length === 0 ? (
          <Card surface="flat" className="p-8 text-center">
            <p className="text-[14px] font-semibold text-ink-900">{s.nothingOutstanding}</p>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-500">
              {s.nothingOutstandingBody}
            </p>
          </Card>
        ) : (
          <Card surface="flat">
            <div className="flex items-baseline justify-between border-b border-surface-border px-4 py-3">
              <span className="text-[12.5px] font-semibold text-ink-700">
                {s.unpaid(receivables.rows.length)}
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
                      {row.closedAt ? s.left(row.closedAt.toISOString().slice(0, 10)) : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {/* Age is what makes this a list you work rather than read. A month-old debt and
                        yesterday's are not the same task, and a date you have to subtract in your
                        head does not say so. */}
                    <StatusPill tone={row.ageDays >= 30 ? "danger" : row.ageDays >= 7 ? "warning" : "neutral"}>
                      {row.ageDays === 0 ? s.today : s.days(row.ageDays)}
                    </StatusPill>
                    <span className="tnum text-[13px] font-bold text-danger-600">{money(row.balance, row.currency)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-surface-border px-4 py-2.5 text-[11px] text-ink-400">
              {s.receivablesNote}
            </p>
          </Card>
        )
      ) : (
        <>
        {/* J1 — above the archive, because the totals are the thing an owner came for and the rows
            are how they check them. Collected, owed and lost stay three numbers. */}
        {outcomes && (
          <OutcomeSummary
            totals={outcomes.totals}
            headline={outcomes.headline}
            sinceDays={outcomes.sinceDays}
            currency={receivables.property.baseCurrency}
            t={s.outcomes}
            money={(m) => money(m, receivables.property.baseCurrency)}
          />
        )}
        <Card surface="flat">
          {/* History search (§4.2) — read-only archive; find a guest's folio, its invoices reachable. */}
          <form method="GET" className="flex items-center gap-2 border-b border-surface-border px-4 py-2.5">
            <input type="hidden" name="tab" value="history" />
            <input name="q" defaultValue={sp.q ?? ""} placeholder={s.searchHistory} className="w-full bg-transparent text-[13px] text-ink-900 outline-none placeholder:text-ink-400" />
            <button className="shrink-0 rounded-md bg-accent-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-500">{s.search}</button>
            {sp.q && <Link href="/folios?tab=history" className="shrink-0 text-[12px] font-semibold text-ink-500 hover:underline">{s.clear}</Link>}
          </form>
          {!history || history.rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12.5px] text-ink-400">{sp.q ? s.noMatch(sp.q) : s.noArchive}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                    <th className="px-4 py-2.5">{s.cols.guest}</th>
                    <th className="px-4 py-2.5">{s.cols.stay}</th>
                    <th className="px-4 py-2.5">{s.cols.room}</th>
                    <th className="px-4 py-2.5">{s.cols.invoice}</th>
                    <th className="px-4 py-2.5 text-right">{s.cols.balance}</th>
                    <th className="px-4 py-2.5">{s.cols.status}</th>
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
                          {r.settled ? s.settled : (r.balanceMinor ?? 0) > 0 ? s.balanceDue : s.open}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-surface-border/60 px-4 py-2 text-[11px] text-ink-400">
            {s.readOnly}
          </p>
        </Card>
        </>
      )}
    </div>
  );
}
