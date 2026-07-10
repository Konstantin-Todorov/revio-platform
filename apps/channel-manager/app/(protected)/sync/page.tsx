import Link from "next/link";
import { AlertTriangle, Ban } from "lucide-react";
import { prisma } from "@/lib/db";
import { getProperty, getDashboard } from "@/lib/data";
import { resolveErrorItem } from "@/lib/actions-config";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";
import { CAPABILITY_ERROR_CODE } from "@revio/core";

export const dynamic = "force-dynamic";

const TONE: Record<string, Tone> = { success: "success", pending: "warning", failed: "danger" };
const TABS = [
  ["activity", "Activity"],
  ["errors", "Errors"],
  ["audit", "Audit Log"],
] as const;

/** V2 IA: ONE operations screen — the live push/pull feed, the actionable errors, and the audit trail. */
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; ch?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some(([t]) => t === sp.tab) ? sp.tab! : "activity";
  const { errorItems } = await getDashboard();
  // Capability limitations are NOT failures (spec §5.2) — count them apart so red never cries wolf.
  const capability = errorItems.filter((e) => e.code === CAPABILITY_ERROR_CODE);
  const real = errorItems.filter((e) => e.code !== CAPABILITY_ERROR_CODE);
  const critical = real.filter((e) => e.severity === "critical").length;

  return (
    <div>
      <PageHeader title="Sync Center" subtitle="The channel I/O log — outbound ARI pushes, inbound bookings, and the permanent audit trail" />

      {/* Errors up top (CM-UPDATES-V1): the problem summary before the feed. */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Link href="/sync?tab=errors" className="rounded-lg border border-surface-border bg-white px-4 py-2.5 transition-colors hover:bg-surface-muted">
          <div className={`tnum text-[18px] font-bold ${critical > 0 ? "text-danger-600" : "text-ink-900"}`}>{critical}</div>
          <div className="text-[11px] font-medium text-ink-400">Critical errors</div>
        </Link>
        <Link href="/sync?tab=errors" className="rounded-lg border border-surface-border bg-white px-4 py-2.5 transition-colors hover:bg-surface-muted">
          <div className={`tnum text-[18px] font-bold ${real.length - critical > 0 ? "text-warning-600" : "text-ink-900"}`}>{real.length - critical}</div>
          <div className="text-[11px] font-medium text-ink-400">Warnings</div>
        </Link>
        <Link href="/sync?tab=errors" className="rounded-lg border border-surface-border bg-white px-4 py-2.5 transition-colors hover:bg-surface-muted">
          <div className="tnum text-[18px] font-bold text-ink-500">{capability.length}</div>
          <div className="text-[11px] font-medium text-ink-400">Channel limitations (not errors)</div>
        </Link>
      </div>

      <div className="mb-3 flex items-center gap-1 border-b border-surface-border">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/sync?tab=${key}`}
            className={`-mb-px border-b-2 px-3.5 py-2 text-[13px] font-semibold transition-colors ${
              tab === key ? "border-brand-700 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {label}
            {key === "errors" && errorItems.length > 0 && (
              <span className="ml-1.5 rounded-full bg-danger-500 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">{errorItems.length}</span>
            )}
          </Link>
        ))}
      </div>

      {tab === "activity" && <ActivityTab ch={sp.ch} />}
      {tab === "errors" && <ErrorsTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}

async function ActivityTab({ ch }: { ch?: string }) {
  const property = await getProperty();
  const channels = await prisma.channel.findMany({ where: { propertyId: property.id }, orderBy: { name: "asc" } });
  const events = await prisma.syncEvent.findMany({
    where: {
      propertyId: property.id,
      // Boundary-rule display guard (spec §1): only channel I/O ever renders here.
      kind: { in: ["push", "pull"] },
      ...(ch ? { channel: { code: ch } } : {}),
    },
    include: { channel: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <Card>
      <CardHeader
        title="Logs — pushes & pulls"
        subtitle="Green = delivered · red = failed"
        action={
          <form method="GET" action="/sync" className="flex items-center gap-1.5">
            <input type="hidden" name="tab" value="activity" />
            <select name="ch" defaultValue={ch ?? ""} className="h-8 rounded-md border border-surface-border bg-white px-2 text-[12px] text-ink-600 outline-none focus:border-brand-600">
              <option value="">All channels</option>
              {channels.map((c) => <option key={c.id} value={c.code}>{c.name}</option>)}
            </select>
            <button type="submit" className="rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 hover:bg-surface-muted">Filter</button>
          </form>
        }
      />
      <div className="max-h-[560px] overflow-y-auto overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
              {["Direction", "Channel", "Summary", "Status", "When"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className={`border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted ${e.status === "failed" ? "bg-danger-50/50" : "bg-success-50/20"}`}>
                <td className="px-4 py-3"><span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-bold uppercase text-ink-500">{e.kind}</span></td>
                <td className="px-4 py-3 font-semibold text-ink-900">{e.channel?.name ?? "—"}</td>
                <td className="px-4 py-3 text-ink-600">{e.summary}</td>
                <td className="px-4 py-3"><StatusPill tone={TONE[e.status] ?? "neutral"}>{e.status}</StatusPill></td>
                <td className="px-4 py-3 text-[12px] text-ink-400">{relativeTime(e.createdAt)}</td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-[13px] text-ink-400">No sync activity yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function ErrorsTab() {
  const { errorItems } = await getDashboard();
  const capability = errorItems.filter((e) => e.code === CAPABILITY_ERROR_CODE);
  const real = errorItems.filter((e) => e.code !== CAPABILITY_ERROR_CODE);

  const ErrorCard = ({ e, limitation }: { e: (typeof errorItems)[number]; limitation?: boolean }) => (
    <Card key={e.id} className="p-4">
      <div className="flex items-start gap-3">
        {limitation
          ? <StatusPill tone="neutral">limitation</StatusPill>
          : <StatusPill tone={e.severity === "critical" ? "danger" : "warning"}>{e.severity}</StatusPill>}
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-ink-900">{e.message}</div>
          <div className="mt-0.5 text-[12px] text-ink-400">
            {e.channel?.name ?? "—"}{e.productLabel ? ` · ${e.productLabel}` : ""}{e.dateAffected ? ` · ${e.dateAffected.toISOString().slice(0, 10)}` : ""} · {relativeTime(e.createdAt)}
          </div>
          {e.recommendedAction && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-surface-muted px-3 py-2 text-[12.5px] text-ink-600">
              <span><span className="font-semibold text-ink-700">Recommended:</span> {e.recommendedAction}</span>
              {/* Actionable, not just descriptive (spec §3.8): the fix is one click away. */}
              {e.code.includes("not_mapped") && e.channel && (
                <Link href={`/mapping?ch=${e.channel.code}`} className="font-semibold text-brand-700 underline">Fix in Mapping →</Link>
              )}
            </div>
          )}
        </div>
        <form action={resolveErrorItem}>
          <input type="hidden" name="id" value={e.id} />
          <button
            type="submit"
            title={limitation ? "Ignore — this channel simply doesn't support the restriction" : "Mark resolved"}
            className="rounded-md border border-surface-border px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-500 transition-colors hover:bg-surface-muted hover:text-ink-800"
          >
            {limitation ? "Ignore" : "Resolve"}
          </button>
        </form>
      </div>
    </Card>
  );

  return (
    <div className="space-y-3">
      {real.length > 0 && (
        <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-400">
          <AlertTriangle className="h-3.5 w-3.5" /> Real errors — something broke
        </div>
      )}
      {real.map((e) => <ErrorCard key={e.id} e={e} />)}
      {capability.length > 0 && (
        <div className="mt-4 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-400">
          <Ban className="h-3.5 w-3.5" /> Channel limitations — known in advance, not failures (spec §5.2)
        </div>
      )}
      {capability.map((e) => <ErrorCard key={e.id} e={e} limitation />)}
      {errorItems.length === 0 && <Card className="p-10 text-center text-[13px] text-ink-400">No open errors — everything is syncing cleanly.</Card>}
    </div>
  );
}

async function AuditTab() {
  const property = await getProperty();
  const entries = await prisma.auditEntry.findMany({
    where: { propertyId: property.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <Card>
      <CardHeader title="Permanent record of every change" />
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
              {["Entity", "Field", "Old", "New", "Source", "Result", "When"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3 font-semibold text-ink-900">{e.entity}</td>
                <td className="px-4 py-3 text-ink-500">{e.field ?? "—"}</td>
                <td className="px-4 py-3 text-ink-400">{e.oldValue ?? "—"}</td>
                <td className="px-4 py-3 font-semibold text-ink-700">{e.newValue ?? "—"}</td>
                <td className="px-4 py-3"><span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-500">{e.source}</span></td>
                <td className="px-4 py-3">{e.syncResult ? <StatusPill tone={e.syncResult === "success" ? "success" : "danger"}>{e.syncResult}</StatusPill> : "—"}</td>
                <td className="px-4 py-3 text-[12px] text-ink-400">{relativeTime(e.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
