import Link from "next/link";
import { prisma } from "@/lib/db";
import { getProperty, getDashboard } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const TONE: Record<string, Tone> = { success: "success", pending: "warning", failed: "danger" };
const TABS = [
  ["activity", "Activity"],
  ["errors", "Errors"],
  ["audit", "Audit Log"],
] as const;

/** V2 IA: ONE operations screen — the live push/pull feed, the actionable errors, and the audit trail. */
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some(([t]) => t === sp.tab) ? sp.tab! : "activity";
  const { errorItems } = await getDashboard();

  return (
    <div>
      <PageHeader title="Sync Center" subtitle="Everything operational — live activity, open errors, and the permanent audit trail" />

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

      {tab === "activity" && <ActivityTab />}
      {tab === "errors" && <ErrorsTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}

async function ActivityTab() {
  const property = await getProperty();
  const events = await prisma.syncEvent.findMany({
    where: { propertyId: property.id },
    include: { channel: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <Card>
      <CardHeader title="Push / pull activity" />
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
              {["Direction", "Channel", "Summary", "Status", "When"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
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
  return (
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
          </div>
        </Card>
      ))}
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
