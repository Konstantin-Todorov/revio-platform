import Link from "next/link";
import { Receipt, Archive, FileText } from "lucide-react";
import { Card, PageHeader, StatusPill } from "@/components/ui/primitives";
import { listFolios, listFolioHistory } from "@/lib/folio";
import { OpenFoliosTable, type OpenFolioRow } from "@/components/folios/OpenFoliosTable";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FoliosPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "history" ? "history" : "open";

  // Open / History split (§4.1): Open = today's operational work; History = the read-only financial record.
  const [{ rows: openRows }, history] = await Promise.all([
    listFolios(),
    tab === "history" ? listFolioHistory(sp.q) : Promise.resolve(null),
  ]);

  const Tab = ({ id, label, icon: Icon }: { id: "open" | "history"; label: string; icon: typeof Receipt }) => (
    <Link
      href={`/folios?tab=${id}`}
      className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors ${
        tab === id ? "border-accent-600 text-accent-700" : "border-transparent text-ink-500 hover:text-ink-700"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );

  return (
    <div>
      <PageHeader title="Folios &amp; Billing" subtitle="Open = live bills for in-house guests. History = the settled financial record." />

      <div className="mb-4 flex items-center gap-1 border-b border-surface-border">
        <Tab id="open" label="Open" icon={Receipt} />
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
            History is read-only (§4.6) — a closed folio is corrected with a credit note, never edited.
          </p>
        </Card>
      )}
    </div>
  );
}
