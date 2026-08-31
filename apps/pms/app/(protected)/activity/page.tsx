import Link from "next/link";
import { redirect } from "next/navigation";
import { History, Info, User } from "lucide-react";
import { getSession } from "@/lib/session";
import { roleHasCapability } from "@/lib/roles";
import { getActivity } from "@/lib/activity";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const inputCls =
  "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none transition-colors focus:border-brand-600";

function when(d: Date): string {
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function ActivityPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string; actor?: string; auto?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // An audit log shows money, guests and configuration in one place. Managers only.
  if (!roleHasCapability(session.role, "manage")) redirect("/dashboard?error=forbidden");

  const sp = await searchParams;
  const includeAutomatic = sp.auto === "1";
  const a = await getActivity({ from: sp.from, to: sp.to, actorId: sp.actor, includeAutomatic });

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { from: a.from, to: a.to, actor: sp.actor, auto: includeAutomatic ? "1" : undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/activity?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle={`${a.rows.length} change${a.rows.length === 1 ? "" : "s"} · who did what, and when`}
      />

      <form method="GET" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">From</span>
          <input type="date" name="from" defaultValue={a.from} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">To</span>
          <input type="date" name="to" defaultValue={a.to} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Who</span>
          <select name="actor" defaultValue={sp.actor ?? ""} className={inputCls}>
            <option value="">Anyone</option>
            {a.actors.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label className="flex h-9 items-center gap-2 text-[12.5px] text-ink-700">
          <input type="checkbox" name="auto" value="1" defaultChecked={includeAutomatic} className="h-4 w-4 rounded border-surface-border" />
          Include automatic
        </label>
        <button type="submit" className="h-9 rounded-md bg-brand-700 px-3.5 text-[13px] font-semibold text-white hover:bg-brand-800">
          Show
        </button>
      </form>

      {a.hiddenAutomatic > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-surface-border bg-surface-muted px-4 py-2.5 text-[12.5px] text-ink-600">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
          <p>
            <strong className="font-semibold">{a.hiddenAutomatic}</strong> automatic entr{a.hiddenAutomatic === 1 ? "y is" : "ies are"} hidden —
            channel syncs the software made by itself. They have their own screen in RevioLink.{" "}
            <Link href={qs({ auto: "1" })} className="font-semibold text-accent-600 hover:underline">Show them anyway</Link>.
          </p>
        </div>
      )}

      {a.unattributed > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-warning-600/30 bg-warning-50 px-4 py-2.5 text-[12.5px] text-warning-700">
          <User className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            <strong className="font-semibold">{a.unattributed}</strong> of these name nobody. Until 1 September 2026
            this software recorded the change but not the person, so anything older than that says “—”. Entries
            from now on carry who made them.
          </p>
        </div>
      )}

      <Card>
        <CardHeader title="Changes" subtitle={`${a.from} → ${a.to} · newest first`} />
        {a.rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-400">
            Nothing changed in this window. Widen the dates, or include automatic entries.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                  {["When", "Who", "What", "Change"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {a.rows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-border/60 align-top last:border-0 hover:bg-surface-muted">
                    <td className="tnum whitespace-nowrap px-3 py-2 text-ink-500">{when(r.at)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-ink-800">
                      {r.actor ?? <span className="font-normal text-ink-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-ink-900">{r.entity}</span>
                      {r.field && <span className="ml-1.5 text-ink-500">{r.field}</span>}
                      {r.source !== "manual" && <StatusPill tone="neutral">{r.source}</StatusPill>}
                    </td>
                    <td className="px-3 py-2 text-ink-600">
                      {r.oldValue && <span className="text-ink-400 line-through">{r.oldValue}</span>}
                      {r.oldValue && r.newValue && <span className="mx-1.5 text-ink-300">→</span>}
                      {r.newValue}
                      {!r.oldValue && !r.newValue && <span className="text-ink-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="flex items-start gap-2 border-t border-surface-border/60 px-4 py-2.5 text-[11.5px] text-ink-400">
          <History className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {a.more
            ? "There are more changes in this window than fit on one page. Narrow the dates to see the rest."
            : "Everything recorded in this window is shown."}
        </p>
      </Card>
    </div>
  );
}
