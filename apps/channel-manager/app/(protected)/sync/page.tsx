import { getDashboard } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const TONE: Record<string, Tone> = { success: "success", pending: "warning", failed: "danger" };

export default async function Page() {
  const { syncEvents } = await getDashboard();
  return (
    <div>
      <PageHeader title="Sync Center" subtitle="Live push / pull activity across channels" />
      <Card>
        <CardHeader title="Recent sync activity" />
        <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
              {["Direction", "Channel", "Summary", "Status", "When"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {syncEvents.map((e) => (
              <tr key={e.id} className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3"><span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-bold uppercase text-ink-500">{e.kind}</span></td>
                <td className="px-4 py-3 font-semibold text-ink-900">{e.channel?.name ?? "—"}</td>
                <td className="px-4 py-3 text-ink-600">{e.summary}</td>
                <td className="px-4 py-3"><StatusPill tone={TONE[e.status] ?? "neutral"}>{e.status}</StatusPill></td>
                <td className="px-4 py-3 text-[12px] text-ink-400">{relativeTime(e.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
