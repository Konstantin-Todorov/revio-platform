import Link from "next/link";
import { createCmConnector } from "@revio/core";
import { Cable, CheckCircle2, Link2, Radio } from "lucide-react";
import { prisma } from "@/lib/db";
import { getProperty } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { CmConnectionActions } from "@/components/distribution/CmConnectionActions";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const CH_TONE: Record<string, Tone> = { connected: "success", pending: "warning", error: "danger", disabled: "neutral", not_connected: "neutral" };

export default async function DistributionPage() {
  const property = await getProperty();
  const connector = createCmConnector(property.cmKind === "reviolink_internal" ? null : property.cmKind);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [channels, syncs24h, syncsOk24h] = await Promise.all([
    prisma.channel.findMany({ where: { propertyId: property.id }, orderBy: { name: "asc" } }),
    prisma.syncEvent.count({ where: { propertyId: property.id, kind: { in: ["push", "pull"] }, createdAt: { gte: since24h } } }),
    prisma.syncEvent.count({ where: { propertyId: property.id, kind: { in: ["push", "pull"] }, createdAt: { gte: since24h }, status: "success" } }),
  ]);
  const health = syncs24h > 0 ? Math.round((syncsOk24h / syncs24h) * 100) : null;
  const cmStatus = property.cmStatus;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Distribution"
        subtitle={`${property.name} · the CRS never talks to an OTA — everything flows through ONE connected channel manager`}
      />

      <Card>
        <CardHeader title="Connected Channel Manager" subtitle="Exactly one per property — RevioLink (internal) or a third-party through the identical connector" action={<CmConnectionActions status={cmStatus} />} />
        <div className="flex flex-wrap items-start gap-4 px-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Cable className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-ink-900">{connector.displayName}</span>
              <StatusPill tone={cmStatus === "connected" ? "success" : cmStatus === "paused" ? "warning" : "neutral"}>
                <CheckCircle2 className="mr-1 inline h-3 w-3" />{cmStatus} · internal
              </StatusPill>
              {health != null && (
                <span className={`text-[12px] font-semibold ${health < 100 ? "text-warning-700" : "text-success-600"}`}>
                  {health < 100 ? "⚠ " : ""}{health}% delivered · last 24h
                </span>
              )}
            </div>
            <p className="mt-1.5 max-w-2xl text-[13px] text-ink-500">
              This property runs on the platform's own channel manager — the connection is <span className="font-semibold text-ink-700">internal:
              shared inventory core, no network hop</span>. Every reservation, hold and out-of-order period you create here is
              already in the numbers RevioLink pushes to the OTAs.
            </p>
            {/* CM switching seam (spec §3.8): third-party CMs plug into the IDENTICAL connector. */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11.5px]">
              <span className="font-semibold text-ink-500">Channel manager:</span>
              <span className="rounded-md bg-brand-50 px-2 py-1 font-semibold text-brand-800 ring-1 ring-brand-600/30">RevioLink (internal)</span>
              {["SiteMinder", "RoomRaccoon", "Other third-party"].map((n) => (
                <span key={n} title="Plugs into the identical ChannelManagerConnector — available on request, never a second code path" className="cursor-not-allowed rounded-md border border-dashed border-surface-border px-2 py-1 text-ink-400">
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* CRS ↔ CM mapping (spec §3.8) — a DISTINCT layer from CM ↔ OTA mapping, never blurred. */}
      <Card>
        <CardHeader title="CRS ↔ Channel-manager mapping" subtitle="Which CRS products the connected CM distributes" />
        <div className="flex items-start gap-3 px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-50 text-success-600"><Link2 className="h-4.5 w-4.5" /></span>
          <div className="text-[13px] text-ink-600">
            <span className="font-semibold text-success-600">Automatic.</span> The CM is RevioLink — both products edit the{" "}
            <span className="font-semibold text-ink-800">same shared-core room types and rate plans</span>, so there is nothing to map
            (one record, two windows). With a third-party CM you would explicitly map CRS room types ↔ the CM's rooms here.
            <div className="mt-1.5 text-[12px] text-ink-400">
              Channel-manager ↔ OTA mapping is a different layer and stays inside RevioLink → Mapping — never in the CRS.
            </div>
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

      {/* Slimmed on purpose (spec §3.8): the detailed activity feed and error queue live in
          RevioLink's Sync Center — this screen never duplicates them (and never shows
          operational events). One health line + the door to the detail. */}
      <p className="text-[11.5px] text-ink-400">
        Full push/pull detail (logs, errors, re-sync, mapping, pull bookings) lives in{" "}
        <Link href="/" className="font-semibold text-brand-700 hover:underline">RevioLink → Sync Center</Link> — this screen is
        the CRS view of the same shared records.
      </p>
    </div>
  );
}
