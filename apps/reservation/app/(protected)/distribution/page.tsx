import Link from "next/link";
import { createCmConnector } from "@revio/core";
import { Cable, CheckCircle2, Radio } from "lucide-react";
import { prisma } from "@/lib/db";
import { getProperty } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const CH_TONE: Record<string, Tone> = { connected: "success", pending: "warning", error: "danger", disabled: "neutral", not_connected: "neutral" };

export default async function DistributionPage() {
  const property = await getProperty();
  // V1 ships with exactly one connector kind; third-party CMs implement the same interface later.
  const connector = createCmConnector(null);

  const [channels, syncEvents, errors] = await Promise.all([
    prisma.channel.findMany({ where: { propertyId: property.id }, orderBy: { name: "asc" } }),
    prisma.syncEvent.findMany({ where: { propertyId: property.id }, orderBy: { createdAt: "desc" }, take: 10, include: { channel: { select: { name: true } } } }),
    prisma.errorItem.findMany({ where: { propertyId: property.id, resolved: false }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Distribution"
        subtitle={`${property.name} · the CRS never talks to an OTA — everything flows through ONE connected channel manager`}
      />

      <Card>
        <CardHeader title="Connected Channel Manager" />
        <div className="flex flex-wrap items-start gap-4 px-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Cable className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-ink-900">{connector.displayName}</span>
              <StatusPill tone="success"><CheckCircle2 className="mr-1 inline h-3 w-3" />connected · internal</StatusPill>
            </div>
            <p className="mt-1.5 max-w-2xl text-[13px] text-ink-500">
              This property runs on the platform's own channel manager, so the connection is <span className="font-semibold text-ink-700">internal —
              shared inventory core, no network hop</span>. Every reservation, hold and out-of-order period you create here is
              already in the numbers RevioLink pushes to the OTAs. A third-party channel manager (SiteMinder, RoomRaccoon…)
              would plug into the exact same connector interface — one integration pattern, never two code paths.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title={`Channels distributed by the connected CM (${channels.length})`} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                {["Channel", "Status", "Mode", "Last sync"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr key={ch.id} className="border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-ink-900"><Radio className="mr-1.5 inline h-3.5 w-3.5 text-ink-400" />{ch.name}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={CH_TONE[ch.status] ?? "neutral"}>{ch.status.replace("_", " ")}</StatusPill></td>
                  <td className="px-4 py-2.5 text-ink-600">{ch.connectivityMode === "mock" ? "demo (mock)" : ch.connectivityMode.replace("_", " ")}</td>
                  <td className="px-4 py-2.5 text-ink-500">{relativeTime(ch.lastSyncAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-surface-border/60 px-4 py-2.5 text-[11.5px] text-ink-400">
          Per-OTA configuration (mapping, commissions, re-sync) lives inside the channel manager — never in the CRS (spec rule).
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent sync activity" />
          {syncEvents.length === 0 ? (
            <div className="px-4 py-5 text-[13px] text-ink-500">No sync events yet.</div>
          ) : (
            <ul className="divide-y divide-surface-border/60">
              {syncEvents.map((e) => (
                <li key={e.id} className="flex items-center gap-2.5 px-4 py-2.5 text-[12.5px]">
                  <StatusPill tone={e.status === "success" ? "success" : e.status === "failed" ? "danger" : "warning"}>{e.kind}</StatusPill>
                  <span className="min-w-0 flex-1 truncate text-ink-700">{e.summary}</span>
                  <span className="shrink-0 text-[11px] text-ink-400">{e.channel?.name ?? "all"} · {relativeTime(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={`Unresolved distribution errors (${errors.length})`} />
          {errors.length === 0 ? (
            <div className="px-4 py-5 text-[13px] text-ink-500">Nothing needs attention.</div>
          ) : (
            <ul className="divide-y divide-surface-border/60">
              {errors.map((e) => (
                <li key={e.id} className="px-4 py-2.5 text-[12.5px]">
                  <div className="flex items-center gap-2">
                    <StatusPill tone={e.severity === "critical" ? "danger" : "warning"}>{e.severity}</StatusPill>
                    <span className="font-semibold text-ink-900">{e.message}</span>
                  </div>
                  {e.recommendedAction && <div className="mt-0.5 text-[11.5px] text-ink-500">→ {e.recommendedAction}</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="text-[11.5px] text-ink-400">
        Full push/pull tooling (re-sync, mapping, pull bookings) lives in{" "}
        <Link href="/" className="font-semibold text-brand-700 hover:underline">RevioLink</Link> — this screen is the CRS view of the same shared records.
      </p>
    </div>
  );
}
