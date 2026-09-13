import Link from "next/link";
import { getPlatformHealth } from "@/lib/data";
import { PageTitle, Panel, Tile, AllClear, initials } from "@/components/v2/parts";

export const dynamic = "force-dynamic";

/** Platform health, from the same `getPlatformHealth` the live `/health` uses. */
export default async function V2Health() {
  const h = await getPlatformHealth();
  const w = h.window24h;

  return (
    <>
      <PageTitle title="Platform health"
                 right={<span className="chip">last 24 hours</span>}
                 lede="Demo hotels ARE included here. A demo hotel's failing push is a real failing push — catching it early is the whole reason they live in production." />

      <div className="kpis">
        <Tile label="Sync success" value={w.successRate === null ? "—" : `${w.successRate}%`}
              note={w.total ? `${w.total.toLocaleString()} attempts` : "nothing synced in 24h"}
              tone={w.successRate !== null && w.successRate < 95 ? "warn" : "pms"} />
        <Tile label="Failed" value={String(w.failed)} note={`${w.pushes} pushes · ${w.pulls} pulls`}
              tone={w.failed > 0 ? "neg" : "pms"} />
        <Tile label="Open errors" value={String(h.openErrors)}
              note={`${h.bySeverity.critical} critical · ${h.bySeverity.warning} warning`}
              tone={h.bySeverity.critical > 0 ? "neg" : h.openErrors > 0 ? "warn" : "pms"} />
        <Tile label="Hotels watched" value={String(h.byTenant.length)} note="demo included, on purpose" tone="brand" />
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <Panel title="Recent failures" badge={h.failedRecent.length > 0 ? <span className="badge n">{h.failedRecent.length}</span> : undefined}
               action={<Link className="ghost" href="/health">Open the live screen →</Link>}>
          {h.failedRecent.length === 0 ? (
            <AllClear>No failed syncs in the last seven days.</AllClear>
          ) : h.failedRecent.slice(0, 8).map((f) => (
            <div className="q" key={f.id}>
              <span className="sev" style={{ background: "var(--neg)" }} />
              <span className="av">{initials(f.property)}</span>
              <span className="txt"><b>{f.property} · {f.channel}</b><s>{f.summary}</s></span>
              <span className="when" style={{ color: "var(--ink-3)" }}>
                {new Date(f.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            </div>
          ))}
        </Panel>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <Panel title="By hotel" badge={<span className="badge f">{h.byTenant.length}</span>}>
          <div className="scroll">
            <table>
              <thead><tr><th>Hotel</th><th className="r">Syncs (24h)</th><th className="r">Success</th><th className="r">Open errors</th></tr></thead>
              <tbody>
                {h.byTenant.map((t) => (
                  <tr key={t.id}>
                    <td><span className="who"><span className="av">{initials(t.name)}</span>
                      <span className="l"><b>{t.name}</b><s>{t.status}</s></span></span></td>
                    <td className="r tn">{t.syncs.toLocaleString()}</td>
                    <td className="r tn" style={{ fontWeight: 600, color: t.successRate === null ? "var(--ink-4)" : t.successRate < 95 ? "var(--warn)" : "var(--pos)" }}>
                      {t.successRate === null ? "—" : `${t.successRate}%`}
                    </td>
                    <td className="r tn" style={{ color: t.openErrors > 0 ? "var(--neg)" : "var(--ink-4)", fontWeight: t.openErrors > 0 ? 600 : 400 }}>
                      {t.openErrors || "—"}
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
