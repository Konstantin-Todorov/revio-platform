import Link from "next/link";
import { Building2, Boxes, Radio, CalendarCheck, AlertCircle, PauseCircle, Hotel } from "lucide-react";
import { getOverviewStats, getClients } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const PLAN_TONE = { starter: "neutral", growth: "info", scale: "success" } as const;

function relative(d: Date | null): string {
  if (!d) return "—";
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export default async function OverviewPage() {
  const [stats, clients] = await Promise.all([getOverviewStats(), getClients()]);

  const cards = [
    { icon: Building2, tone: "info", value: stats.clients, label: "Clients", sub: "Organizations" },
    { icon: Hotel, tone: "info", value: stats.properties, label: "Properties", sub: "Hotels managed" },
    { icon: Boxes, tone: "success", value: stats.products, label: "Products live", sub: "Room × rate" },
    { icon: Radio, tone: "success", value: stats.connectedChannels, label: "Channels", sub: "Connected" },
    { icon: CalendarCheck, tone: "info", value: stats.reservations, label: "Reservations", sub: "Imported" },
    { icon: AlertCircle, tone: stats.openErrors ? "danger" : "neutral", value: stats.openErrors, label: "Open errors", sub: "Across all" },
  ];
  const TONE_BG: Record<string, string> = {
    success: "bg-success-50 text-success-600", info: "bg-accent-50 text-accent-600",
    warning: "bg-warning-50 text-warning-600", danger: "bg-danger-50 text-danger-600", neutral: "bg-surface-sunken text-ink-500",
  };

  return (
    <div>
      <PageHeader title="Overview" subtitle="Every hotel on the platform, at a glance" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="p-4">
              <div style={{ animationDelay: `${i * 45}ms` }} className="animate-rise">
                <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-md ${TONE_BG[c.tone]}`}><Icon className="h-[18px] w-[18px]" /></div>
                <div className="tnum text-[26px] font-bold leading-none tracking-tight text-ink-900">{c.value}</div>
                <div className="mt-1.5 text-[12.5px] font-semibold text-ink-700">{c.label}</div>
                <div className="text-[11.5px] text-ink-400">{c.sub}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <CardHeader title="Clients — health" action={<Link href="/clients" className="text-[12px] font-semibold text-brand-600 hover:underline">Manage clients</Link>} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Client", "Plan", "Products", "Rooms", "Channels", "Reservations", "Errors", "Last sync", "Status"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-ink-900">{c.name}</div>
                    <div className="text-[11px] text-ink-400">{c.properties.length} propert{c.properties.length === 1 ? "y" : "ies"}</div>
                  </td>
                  <td className="px-4 py-2.5"><StatusPill tone={PLAN_TONE[c.plan as keyof typeof PLAN_TONE] ?? "neutral"}>{c.plan}</StatusPill></td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      {c.entitlements.channelManager && <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-700">CM</span>}
                      {c.entitlements.reservation && <span className="rounded bg-accent-50 px-1.5 py-0.5 text-[10.5px] font-bold text-accent-600">CRS</span>}
                      {c.entitlements.pms && <span className="rounded bg-success-50 px-1.5 py-0.5 text-[10.5px] font-bold text-success-600">PMS</span>}
                    </div>
                  </td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{c.counts.roomTypes}</td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{c.counts.channelsConnected}/{c.counts.channels}</td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{c.counts.reservations}</td>
                  <td className="tnum px-4 py-2.5">{c.counts.openErrors > 0 ? <span className="font-bold text-danger-500">{c.counts.openErrors}</span> : <span className="text-ink-300">0</span>}</td>
                  <td className="px-4 py-2.5 text-[12px] text-ink-400">{relative(c.lastSyncAt)}</td>
                  <td className="px-4 py-2.5">{c.status === "active" ? <StatusPill tone="success">active</StatusPill> : <StatusPill tone="warning">suspended</StatusPill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
