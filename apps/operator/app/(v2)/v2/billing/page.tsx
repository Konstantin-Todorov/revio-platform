import Link from "next/link";
import { getBilling } from "@/lib/data";
import { PageTitle, Panel, Tile, AllClear, initials, money, moneyExact } from "@/components/v2/parts";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { bg: string; fg: string }> = {
  paid: { bg: "var(--pos-bg)", fg: "var(--pos)" },
  sent: { bg: "var(--warn-bg)", fg: "var(--warn)" },
  draft: { bg: "var(--line-soft)", fg: "var(--ink-3)" },
};

/** Invoices, from the same `getBilling` the live `/billing` uses. */
export default async function V2Billing() {
  const b = await getBilling();
  const drafts = b.recent.filter((i) => i.status === "draft");

  return (
    <>
      <PageTitle title="Invoices" right={<span className="chip">{b.period}</span>}
                 lede="Demo hotels are invoiced too — deliberately, so the billing flow stays testable — but their invoices never reach MRR or the unpaid count." />

      <div className="kpis">
        <Tile label="MRR" value={money(b.mrr)} note="real, active hotels only" tone="brand" />
        <Tile label="Awaiting payment" value={String(b.unpaidCount)}
              note="issued and sent, not yet settled" tone={b.unpaidCount > 0 ? "warn" : "pms"} />
        <Tile label="Drafts" value={String(drafts.length)} note="nobody has been asked for these yet" tone="crs" />
        <Tile label="Demo hotels" value={String(b.demoCount)} note="invoiced, never counted" tone="warn" />
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <Panel title="Recent invoices" badge={<span className="badge f">{b.recent.length}</span>}
               action={<Link className="ghost" href="/billing">Open the live screen →</Link>}>
          {b.recent.length === 0 ? (
            <AllClear>No invoices yet. The monthly run creates the first ones.</AllClear>
          ) : (
            <div className="scroll">
              <table>
                <thead><tr><th>Hotel</th><th>Period</th><th>Number</th><th className="r">Net</th><th className="r">Gross</th><th>Status</th></tr></thead>
                <tbody>
                  {b.recent.map((i) => {
                    const s = STATUS[i.status] ?? STATUS.draft!;
                    return (
                      <tr key={i.id}>
                        <td><Link href={`/invoice/${i.id}`} className="who" style={{ textDecoration: "none", color: "inherit" }}>
                          <span className="av">{initials(i.tenant)}</span>
                          <span className="l"><b>{i.tenant}</b><s>{i.isDemo ? "demo — never counted" : "real client"}</s></span>
                        </Link></td>
                        <td className="tn">{i.period}</td>
                        <td className="tn" style={{ color: i.number ? "var(--ink-2)" : "var(--ink-4)" }}>{i.number ?? "not issued"}</td>
                        <td className="r tn">{moneyExact(i.amountMinor)}</td>
                        <td className="r tn" style={{ fontWeight: 600 }}>{moneyExact(i.grossMinor ?? i.amountMinor)}</td>
                        <td><span className="tag" style={{ background: s.bg, color: s.fg }}><i style={{ background: "currentColor" }} />{i.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
