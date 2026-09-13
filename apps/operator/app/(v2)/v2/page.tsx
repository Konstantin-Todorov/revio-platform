import Link from "next/link";
import { getOperatorDashboard } from "@/lib/data";
import { PageTitle, Panel, Tile, AllClear, SEV, initials, poly, money } from "@/components/v2/parts";

export const dynamic = "force-dynamic";

/**
 * Home, on the real database.
 *
 * ⚠️ Reads the SAME `getOperatorDashboard` the live `/overview` reads. That is the point of running
 * the candidate here rather than looking at another mockup: a design is only worth judging against
 * real names, real lengths and real emptiness.
 */
export default async function V2Home({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  /*
   * `?demo=1` — the same opt-in the live Overview carries, and for the same reason its own note
   * gives: with no real customers every figure is honestly zero, and "look at the console and see
   * nothing" is a poor way to check the console works. The default stays honest; this is never
   * sticky and is always announced on screen.
   */
  const includeDemo = (await searchParams).demo === "1";
  const d = await getOperatorDashboard({ includeDemo });
  const forward = d.forward.reduce((s, f) => s + f.revenueMinor, 0);
  const nights = d.forward.reduce((s, f) => s + f.roomNights, 0);
  const last = d.back.at(-1);

  // The line is drawn in the 640×168 box with an 8px gutter and a 12px top inset.
  const line = poly(d.forward.map((f) => f.revenueMinor), 624, 120)
    .split(" ")
    .map((p) => { const [x, y] = p.split(","); return `${Number(x) + 8},${Number(y) + 12}`; })
    .join(" ");

  return (
    <>
      <PageTitle
        title="Home"
        right={
          includeDemo ? (
            <>
              <span className="chip act" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>
                Demo included — not real revenue
              </span>
              <Link className="chip" href="/v2">Back to real figures</Link>
            </>
          ) : (
            <>
              <span className="chip act">Real hotels <span style={{ opacity: 0.6 }}>×</span></span>
              {d.demo.count > 0 && (
                <Link className="chip" href="/v2?demo=1">
                  {d.demo.count} demo hidden · {money(d.demo.mrrMinor)}/mo — show them
                </Link>
              )}
            </>
          )
        }
      />

      <div className="grid g-hero">
        <section className="card hero pad in">
          <div className="eyebrow"><span className="dotm" /> Monthly recurring revenue</div>
          <div className="big tn">{money(d.money.mrrMinor)}</div>
          {/* Zero is a designed state, not a blank. What replaces the delta is the fact that answers
              "so what": how many hotels exist, and what is being held back from the figure. */}
          <p className="hero-sub">
            {d.money.mrrMinor === 0 ? (
              <>
                Nothing is billed yet, and that is correct. {d.money.clients} hotel
                {d.money.clients === 1 ? "" : "s"} on the books
                {d.demo.count > 0 && (
                  <>, and {d.demo.count} demo account{d.demo.count === 1 ? "" : "s"} excluded — worth{" "}
                    <b>{money(d.demo.mrrMinor)}/mo</b> if they were real</>
                )}.
              </>
            ) : (
              <>
                Across {d.money.active} active hotel{d.money.active === 1 ? "" : "s"}.{" "}
                {/* ⚠️ This said "demo accounts are excluded" unconditionally — while the page was
                    rendering them INCLUDED. A screen stating the opposite of what it is showing is
                    the exact defect this project keeps finding; the sentence now follows the data. */}
                {includeDemo
                  ? <b>Demo hotels are counted in every figure below. None of this is real revenue.</b>
                  : <>Demo accounts are excluded from every figure here.</>}
              </>
            )}
          </p>
          <div className="legend"><span><i style={{ background: "var(--brand)" }} />Their forward book, by month</span></div>

          {/* Length is not the test: six months of zeroes passes it and draws a flat line along the
              axis, which looks like a rendering fault rather than an empty book. */}
          {d.forward.length > 1 && forward > 0 ? (
            <svg className="chart" viewBox="0 0 640 168" style={{ marginTop: 10 }} role="img" aria-label="Their forward book by month.">
              <line className="gl" x1="8" y1="132" x2="632" y2="132" />
              <line className="gl" x1="8" y1="88" x2="632" y2="88" />
              <line className="gl" x1="8" y1="44" x2="632" y2="44" />
              <polyline className="drawn" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={line} />
              {d.forward.map((f, i) => (
                <text key={f.key} className="ax" x={8 + (i / (d.forward.length - 1)) * 624} y="156"
                      textAnchor={i === 0 ? "start" : i === d.forward.length - 1 ? "end" : "middle"}>{f.label}</text>
              ))}
            </svg>
          ) : (
            <p className="empty">No forward bookings yet — the chart fills in as hotels take them.</p>
          )}
        </section>

        <div className="tiles">
          <Tile label="Unbilled tier drift" value={money(d.money.unbilledDriftMinor)} tone="warn"
                note={d.money.unbilledDriftMinor > 0 ? "per month, already earned" : "every plan matches its room count"}
                spark={d.rows.map((r) => r.driftMinor)} />
          <Tile label="Their forward book" value={money(forward)} tone="pms"
                note={`${nights.toLocaleString()} room-nights on the books`}
                spark={d.forward.map((f) => f.revenueMinor)} />
          <Tile label={last ? `Billed ${last.label}` : "Billed"} value={money(last?.billedMinor ?? 0)} tone="brand"
                note={last ? `${money(last.paidMinor)} of it paid` : "nothing billed yet"}
                spark={d.back.map((b) => b.billedMinor)} />
        </div>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <Panel title="Needs you today"
               badge={d.feed.length > 0 ? <span className="badge n">{d.feed.length}</span> : undefined}
               action={<Link className="ghost" href="/v2/clients">Ordered by how soon, not how bad →</Link>}>
          {d.feed.length === 0
            ? <AllClear>Nothing needs you today. Every plan matches its rooms and no sync is failing.</AllClear>
            : d.feed.slice(0, 6).map((f, i) => (
                <Link className="q" key={i} href={`/clients/${f.clientId}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <span className="sev" style={{ background: SEV[f.severity] }} />
                  <span className="av">{initials(f.clientName)}</span>
                  <span className="txt"><b>{f.clientName}</b><s>{f.title}{f.detail ? ` — ${f.detail}` : ""}</s></span>
                </Link>
              ))}
        </Panel>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <Panel title="Hotels"
               badge={<span className="badge f">{d.rows.length} real · {d.demo.count} demo hidden</span>}
               action={<Link className="ghost" href="/v2/clients">All hotels →</Link>}>
          {d.rows.length === 0 ? (
            <p className="empty">No hotels yet. The first one appears here the moment it is onboarded.</p>
          ) : (
            <div className="scroll">
              <table>
                <thead><tr><th>Hotel</th><th>Plan</th><th className="r">Monthly</th><th className="r">Unbilled</th><th className="r">Bookings</th></tr></thead>
                <tbody>
                  {d.rows.slice(0, 6).map((r) => (
                    <tr key={r.id}>
                      <td><span className="who"><span className="av">{initials(r.name)}</span>
                        <span className="l"><b>{r.name}</b><s>{r.openErrors > 0 ? `${r.openErrors} open error${r.openErrors === 1 ? "" : "s"}` : "no open errors"}</s></span></span></td>
                      <td><span className="tag">{r.plan}</span></td>
                      <td className="r tn" style={{ fontWeight: 600 }}>{money(r.monthlyMinor)}</td>
                      <td className="r tn" style={{ color: r.driftMinor ? "var(--warn)" : "var(--ink-4)", fontWeight: r.driftMinor ? 600 : 400 }}>
                        {r.driftMinor ? money(r.driftMinor) : "—"}
                      </td>
                      <td className="r tn">{r.reservations.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
