import Link from "next/link";
import { getClients } from "@/lib/data";
import { monthlyPriceMinor } from "@/lib/pricing";
import { PageTitle, Panel, Tile, initials, money } from "@/components/v2/parts";

export const dynamic = "force-dynamic";

/** Hotels, read from the same `getClients` the live `/clients` uses. */
export default async function V2Clients() {
  const all = await getClients();
  const real = all.filter((c) => !c.isDemo);
  const demo = all.filter((c) => c.isDemo);
  const priceOf = (c: (typeof all)[number]) => monthlyPriceMinor(c.plan, c.billedEntitlements);
  const rooms = real.reduce((s, c) => s + c.counts.units, 0);
  const live = real.filter((c) => c.status === "active").length;

  return (
    <>
      <PageTitle title="Hotels" right={<span className="chip act">Real hotels <span style={{ opacity: .6 }}>×</span></span>}
                 lede="Every tenant on the platform, what they hold and what it is worth. Demo accounts are listed last and never counted in money." />

      <div className="kpis">
        <Tile label="Hotels" value={String(real.length)} note={`${live} active`} tone="brand" />
        <Tile label="Rooms under management" value={rooms.toLocaleString()} note="physical rooms, not room types" tone="pms" />
        <Tile label="Monthly" value={money(real.reduce((s, c) => s + priceOf(c), 0))} note="at today's plans" tone="crs" />
        <Tile label="Demo" value={String(demo.length)} note="never counted in money" tone="warn" />
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <Panel title="Every hotel" badge={<span className="badge f">{all.length}</span>}
               action={<Link className="ghost" href="/clients">Open the live screen →</Link>}>
          <div className="scroll">
            <table>
              <thead>
                <tr><th>Hotel</th><th>Products</th><th>Plan</th><th className="r">Rooms</th><th className="r">Monthly</th><th>Status</th></tr>
              </thead>
              <tbody>
                {[...real, ...demo].map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/clients/${c.id}`} className="who" style={{ textDecoration: "none", color: "inherit" }}>
                        <span className="av">{initials(c.name)}</span>
                        <span className="l"><b>{c.name}</b><s>{c.isDemo ? "demo account" : `${c.counts.channelsConnected} channel${c.counts.channelsConnected === 1 ? "" : "s"} connected`}</s></span>
                      </Link>
                    </td>
                    <td>
                      {(["channelManager", "reservation", "pms"] as const).map((k, i) =>
                        c.entitlements[k] ? (
                          <span className="tag" key={k} style={{ marginRight: 4 }}>
                            <i style={{ background: ["var(--link)", "var(--crs)", "var(--pms)"][i] }} />
                            {["Link", "CRS", "PMS"][i]}
                          </span>
                        ) : null)}
                    </td>
                    <td><span className="tag">{c.plan}</span></td>
                    <td className="r tn">{c.counts.units}</td>
                    <td className="r tn" style={{ fontWeight: 600 }}>{c.isDemo ? "—" : money(priceOf(c))}</td>
                    <td>
                      <span className="tag" style={c.status !== "active"
                        ? { background: "var(--neg-bg)", color: "var(--neg)" }
                        : c.isDemo ? { background: "var(--warn-bg)", color: "var(--warn)" }
                        : { background: "var(--pos-bg)", color: "var(--pos)" }}>
                        <i style={{ background: "currentColor" }} />
                        {c.status !== "active" ? "Suspended" : c.isDemo ? "Demo" : "Live"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
