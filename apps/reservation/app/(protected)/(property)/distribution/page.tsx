import Link from "next/link";
import { connectivityModeLabel, createCmConnector } from "@revio/core";
import { i18n } from "@/lib/i18n/server";
import { distribution as distributionDict } from "@/lib/i18n/distribution";
import { relativeTimeIn } from "@/lib/i18n/relative";
import { Cable, CheckCircle2, Link2, Radio } from "lucide-react";
import { prisma } from "@/lib/db";
import { getProperty } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { CmConnectionActions } from "@/components/distribution/CmConnectionActions";

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
  const { t, locale } = await i18n();
  const s = t(distributionDict);
  const relativeTime = relativeTimeIn(locale);

  return (
    <div className="space-y-5">
      <PageHeader
        title={s.title}
        subtitle={s.subtitle(property.name)}
      />

      <Card>
        <CardHeader title={s.cmTitle} subtitle={s.cmSubtitle} action={<CmConnectionActions status={cmStatus} />} />
        <div className="flex flex-wrap items-start gap-4 px-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Cable className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-ink-900">{property.cmKind === "reviolink_internal" ? s.internalName : connector.displayName}</span>
              <StatusPill tone={cmStatus === "connected" ? "success" : cmStatus === "paused" ? "warning" : "neutral"}>
                <CheckCircle2 className="mr-1 inline h-3 w-3" />{s.cmStatus[cmStatus] ?? cmStatus}{s.internal}
              </StatusPill>
              {health != null && (
                <span className={`text-[12px] font-semibold ${health < 100 ? "text-warning-700" : "text-success-600"}`}>
                  {health < 100 ? "⚠ " : ""}{s.delivered(health)}
                </span>
              )}
            </div>
            <p className="mt-1.5 max-w-2xl text-[13px] text-ink-500">
              {s.internalLead}<span className="font-semibold text-ink-700">{s.internalBold}</span>{s.internalTail}
            </p>
            {/* CM switching seam (spec §3.8): third-party CMs plug into the IDENTICAL connector. */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11.5px]">
              <span className="font-semibold text-ink-500">{s.cmLabel}</span>
              <span className="rounded-md bg-brand-50 px-2 py-1 font-semibold text-brand-800 ring-1 ring-brand-600/30">{s.reviolinkInternal}</span>
              {["SiteMinder", "RoomRaccoon", s.otherThirdParty].map((n) => (
                <span key={n} title={s.onRequest} className="cursor-not-allowed rounded-md border border-dashed border-surface-border px-2 py-1 text-ink-400">
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* CRS ↔ CM mapping (spec §3.8) — a DISTINCT layer from CM ↔ OTA mapping, never blurred.
          The distinction is ours to maintain, not theirs to learn: the screen says where each job is
          done and stops. It used to explain the layering and the third-party case, which is a feature
          this hotel does not have. */}
      <Card>
        <CardHeader
          title={s.reachTitle}
          subtitle={s.reachSub}
        />
        <div className="flex items-start gap-3 px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-50 text-success-600"><Link2 className="h-4.5 w-4.5" /></span>
          <div className="text-[13px] text-ink-600">
            <span className="font-semibold text-success-600">{s.nothingToSetUp}</span>{s.sells}
            <span className="font-semibold text-ink-800">{s.sameThings}</span>{s.inStep}
            <div className="mt-1.5 text-[12px] text-ink-400">
              {s.mappingHint}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title={s.channelsTitle(channels.length)} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                {[s.cols.channel, s.cols.status, s.cols.mode, s.cols.lastSync].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr key={ch.id} className="border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-ink-900"><Radio className="mr-1.5 inline h-3.5 w-3.5 text-ink-400" />{ch.name}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={CH_TONE[ch.status] ?? "neutral"}>{s.channelStatus[ch.status] ?? ch.status.replace("_", " ")}</StatusPill></td>
                  <td className="px-4 py-2.5 text-ink-600">{s.modes[ch.connectivityMode] ?? connectivityModeLabel(ch.connectivityMode)}</td>
                  <td className="px-4 py-2.5 text-ink-500">{relativeTime(ch.lastSyncAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-surface-border/60 px-4 py-2.5 text-[11.5px] text-ink-400">
          {s.perOta}
        </p>
      </Card>

      {/* Slimmed on purpose (spec §3.8): the detailed activity feed and error queue live in
          RevioLink's Sync Center — this screen never duplicates them (and never shows
          operational events). One health line + the door to the detail. */}
      <p className="text-[11.5px] text-ink-400">
        {s.fullDetailLead}
        <Link href="/" className="font-semibold text-brand-700 hover:underline">{s.syncCenter}</Link>{s.fullDetailTail}
      </p>
    </div>
  );
}
