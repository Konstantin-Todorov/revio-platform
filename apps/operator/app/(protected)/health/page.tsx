import { CheckCircle2, XCircle, AlertTriangle, ArrowUpDown } from "lucide-react";
import { getPlatformHealth } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

function relative(d: Date): string {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export default async function HealthPage() {
  const h = await getPlatformHealth();
  const rate = h.window24h.successRate;

  const cards = [
    { icon: CheckCircle2, tone: rate == null ? "neutral" : rate >= 99 ? "success" : rate >= 90 ? "warning" : "danger", value: rate == null ? "—" : `${rate}%`, label: "Sync success", sub: "last 24h" },
    { icon: ArrowUpDown, tone: "info", value: h.window24h.total, label: "Sync events", sub: `${h.window24h.pushes} push · ${h.window24h.pulls} pull` },
    { icon: XCircle, tone: h.window24h.failed ? "danger" : "neutral", value: h.window24h.failed, label: "Failed syncs", sub: "last 24h" },
    { icon: AlertTriangle, tone: h.openErrors ? "danger" : "neutral", value: h.openErrors, label: "Open errors", sub: `${h.bySeverity.critical} critical · ${h.bySeverity.warning} warn` },
  ];
  const TONE_BG: Record<string, string> = {
    success: "bg-success-50 text-success-600", info: "bg-accent-50 text-accent-600",
    warning: "bg-warning-50 text-warning-600", danger: "bg-danger-50 text-danger-600", neutral: "bg-surface-sunken text-ink-500",
  };

  return (
    <div>
      <PageHeader title="Platform Health" subtitle="Cross-tenant sync health and error volumes across every hotel" />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="p-4">
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-md ${TONE_BG[c.tone]}`}><Icon className="h-[18px] w-[18px]" /></div>
              <div className="tnum text-[26px] font-bold leading-none tracking-tight text-ink-900">{c.value}</div>
              <div className="mt-1.5 text-[12.5px] font-semibold text-ink-700">{c.label}</div>
              <div className="text-[11.5px] text-ink-400">{c.sub}</div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <CardHeader title="Per-client sync health — last 24h" />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Client", "Sync events", "Success", "Open errors", "Status"].map((x) => <th key={x} className="px-4 py-2.5 font-semibold">{x}</th>)}
              </tr>
            </thead>
            <tbody>
              {h.byTenant.map((t) => (
                <tr key={t.id} className="border-b border-surface-border last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{t.name}</td>
                  <td className="px-4 py-2.5 tnum text-ink-700">{t.syncs}</td>
                  <td className="px-4 py-2.5">
                    {t.successRate == null ? <span className="text-ink-400">no activity</span>
                      : <StatusPill tone={t.successRate >= 99 ? "success" : t.successRate >= 90 ? "warning" : "danger"}>{t.successRate}%</StatusPill>}
                  </td>
                  <td className="px-4 py-2.5">{t.openErrors ? <span className="tnum font-semibold text-danger-600">{t.openErrors}</span> : <span className="text-ink-400">0</span>}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={t.status === "active" ? "success" : "warning"}>{t.status}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Recent sync failures" />
        {h.failedRecent.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-ink-400">No sync failures recorded. 🎉</div>
        ) : (
          <ul className="divide-y divide-surface-border">
            {h.failedRecent.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink-800">{f.summary}</div>
                  <div className="text-[11.5px] text-ink-500">{f.property} · {f.channel}{f.detail ? ` · ${f.detail}` : ""}</div>
                </div>
                <span className="shrink-0 text-[11.5px] text-ink-400">{relative(f.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-[11.5px] text-ink-400">
        Sync is in-process for the demo (no external queue yet). Queue depth / retry backlog (Redis + BullMQ)
        lands with the scheduler infrastructure — see the platform roadmap.
      </p>
    </div>
  );
}
