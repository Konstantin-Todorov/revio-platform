import { getDashboard } from "@/lib/data";
import { Card, PageHeader, StatusPill } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { errorItems } = await getDashboard();
  return (
    <div>
      <PageHeader title="Error Center" subtitle="Everything currently broken or needing attention — including config issues" />
      <div className="space-y-3">
        {errorItems.map((e) => (
          <Card key={e.id} className="p-4">
            <div className="flex items-start gap-3">
              <StatusPill tone={e.severity === "critical" ? "danger" : "warning"}>{e.severity}</StatusPill>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-ink-900">{e.message}</div>
                <div className="mt-0.5 text-[12px] text-ink-400">
                  {e.channel?.name ?? "—"}{e.productLabel ? ` · ${e.productLabel}` : ""}{e.dateAffected ? ` · ${e.dateAffected.toISOString().slice(0, 10)}` : ""} · {relativeTime(e.createdAt)}
                </div>
                {e.recommendedAction && (
                  <div className="mt-2 rounded-md bg-surface-muted px-3 py-2 text-[12.5px] text-ink-600">
                    <span className="font-semibold text-ink-700">Recommended:</span> {e.recommendedAction}
                  </div>
                )}
              </div>
              <button className="rounded-md border border-surface-border px-3 py-1.5 text-[12px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Retry</button>
            </div>
          </Card>
        ))}
        {errorItems.length === 0 && <Card className="p-10 text-center text-[13px] text-ink-400">No open errors — everything is syncing cleanly.</Card>}
      </div>
    </div>
  );
}
