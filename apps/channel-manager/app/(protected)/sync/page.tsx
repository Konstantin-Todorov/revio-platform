import Link from "next/link";
import { AlertTriangle, Ban } from "lucide-react";
import { prisma } from "@/lib/db";
import { getProperty, getDashboard } from "@/lib/data";
import { resolveErrorItem } from "@/lib/actions-config";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { LinkTabs } from "@revio/ui/link-tabs";
import { CAPABILITY_ERROR_CODE } from "@revio/core";
import { i18n } from "@/lib/i18n/server";
import { relativeTimeIn } from "@/lib/i18n/relative";
import { sync as syncDict, sayCadence } from "@/lib/i18n/sync";

export const dynamic = "force-dynamic";

/*
 * ⚠️ An unknown status used to fall through to the neutral pill AND to the green row tint below,
 * because the row colour asked only "is it failed?". A push that went nowhere therefore looked
 * exactly like one that arrived. These four are what `recordPush` writes when nothing was delivered.
 */
const TONE: Record<string, Tone> = {
  success: "success",
  pending: "warning",
  failed: "danger",
  warning: "warning",
  noop: "neutral",
  skipped: "neutral",
};
const TABS = ["activity", "errors", "audit"] as const;

/** V2 IA: ONE operations screen — the live push/pull feed, the actionable errors, and the audit trail. */
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; ch?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some((k) => k === sp.tab) ? sp.tab! : "activity";
  const s = (await i18n()).t(syncDict);
  const { errorItems } = await getDashboard();
  // Capability limitations are NOT failures (spec §5.2) — count them apart so red never cries wolf.
  const capability = errorItems.filter((e) => e.code === CAPABILITY_ERROR_CODE);
  const real = errorItems.filter((e) => e.code !== CAPABILITY_ERROR_CODE);
  const critical = real.filter((e) => e.severity === "critical").length;

  return (
    <div>
      <PageHeader title={s.title} subtitle={s.subtitle} />

      {/* Errors up top (CM-UPDATES-V1): the problem summary before the feed. */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Link href="/sync?tab=errors" className="rounded-lg border border-surface-border bg-white px-4 py-2.5 transition-colors hover:bg-surface-muted">
          <div className={`tnum text-[18px] font-bold ${critical > 0 ? "text-danger-600" : "text-ink-900"}`}>{critical}</div>
          <div className="text-[11px] font-medium text-ink-400">{s.tiles.critical}</div>
        </Link>
        <Link href="/sync?tab=errors" className="rounded-lg border border-surface-border bg-white px-4 py-2.5 transition-colors hover:bg-surface-muted">
          <div className={`tnum text-[18px] font-bold ${real.length - critical > 0 ? "text-warning-600" : "text-ink-900"}`}>{real.length - critical}</div>
          <div className="text-[11px] font-medium text-ink-400">{s.tiles.warnings}</div>
        </Link>
        <Link href="/sync?tab=errors" className="rounded-lg border border-surface-border bg-white px-4 py-2.5 transition-colors hover:bg-surface-muted">
          <div className="tnum text-[18px] font-bold text-ink-500">{capability.length}</div>
          <div className="text-[11px] font-medium text-ink-400">{s.tiles.limitations}</div>
        </Link>
      </div>

      <div className="mb-3">
        <LinkTabs
          label={s.tabsLabel}
          tabs={TABS.map((key) => ({
            href: `/sync?tab=${key}`,
            label: s.tabs[key],
            active: tab === key,
            // Red counts real problems only — a channel limitation is not a failure (spec §5.2), and
            // counting it made the badge say 2 beside a "1 critical error" tile.
            ...(key === "errors" && real.length > 0 ? { badge: String(real.length), badgeTone: "danger" as const } : {}),
          }))}
        />
      </div>

      {s.recordsNote && <p className="-mt-1 mb-3 text-[11.5px] text-ink-400">{s.recordsNote}</p>}
      {tab === "activity" && <ActivityTab ch={sp.ch} />}
      {tab === "errors" && <ErrorsTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}

async function ActivityTab({ ch }: { ch?: string }) {
  const { t, locale } = await i18n();
  const s = t(syncDict);
  const relativeTime = relativeTimeIn(locale);
  const property = await getProperty();
  const channels = await prisma.channel.findMany({ where: { propertyId: property.id }, orderBy: { name: "asc" } });
  /*
   * The newest successful collection across this property's real channels — which is what "when do
   * bookings arrive" actually means to a hotelier. A mock channel would flatter it, so it is left
   * out.
   */
  const lastPull = await prisma.channel.findFirst({
    where: { propertyId: property.id, status: "connected", connectivityMode: { not: "mock" }, lastSyncAt: { not: null } },
    orderBy: { lastSyncAt: "desc" },
    select: { lastSyncAt: true },
  });
  const cadence = sayCadence(s, lastPull?.lastSyncAt ?? null, new Date());

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
    <>
    {/*
      ⚠️ When any of this happens, said plainly and first.
      The founder asked on 2026-09-12 whether pushes and pulls are instant or whether you wait, after
      a real booking took longer to appear than expected. Nothing on this screen answered it, so the
      only way to find out was to watch — and somebody who does not know bookings arrive within five
      minutes cannot tell "not yet" from "broken".
    */}
    <Card className={`mb-4 p-4 ${cadence.overdue ? "border-warning-200 bg-warning-50" : ""}`}>
      <p className={`text-[13px] leading-relaxed ${cadence.overdue ? "text-warning-800" : "text-ink-600"}`}>
        {cadence.sentence}
      </p>
    </Card>

    <Card>
      <CardHeader
        title={s.logs.title}
        subtitle={s.logs.subtitle}
        action={
          <form method="GET" action="/sync" className="flex items-center gap-1.5">
            <input type="hidden" name="tab" value="activity" />
            <select name="ch" defaultValue={ch ?? ""} className="h-8 rounded-md border border-surface-border bg-white px-2 text-[12px] text-ink-600 outline-none focus:border-brand-600">
              <option value="">{s.logs.allChannels}</option>
              {channels.map((c) => <option key={c.id} value={c.code}>{c.name}</option>)}
            </select>
            <button type="submit" className="rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 hover:bg-surface-muted">{s.logs.filter}</button>
          </form>
        }
      />
      <div className="max-h-[560px] overflow-y-auto overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
              {Object.values(s.cols).map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className={`border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted ${
                e.status === "failed" ? "bg-danger-50/50" : e.status === "success" ? "bg-success-50/20" : ""
              }`}>
                <td className="px-4 py-3"><span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-bold uppercase text-ink-500">{s.kinds[e.kind] ?? e.kind}</span></td>
                <td className="px-4 py-3 font-semibold text-ink-900">{e.channel?.name ?? "—"}</td>
                <td className="px-4 py-3 text-ink-600">
                  {e.summary}
                  {/*
                    ⚠️ `detail` was never rendered. Every explanation written into a sync event —
                    "no mapped target, map the room types first", "N bookings could not be imported"
                    — was stored and shown to nobody, which is why a rejected booking looked like
                    silence. It is the only actionable text on this screen.
                  */}
                  {e.detail && (
                    <span className="mt-0.5 block text-[12px] leading-snug text-ink-400">{e.detail}</span>
                  )}
                </td>
                <td className="px-4 py-3"><StatusPill tone={TONE[e.status] ?? "neutral"}>{s.statuses[e.status] ?? e.status}</StatusPill></td>
                <td className="px-4 py-3 text-[12px] text-ink-400">{relativeTime(e.createdAt)}</td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-[13px] text-ink-400">{s.logs.empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
    </>
  );
}

async function ErrorsTab() {
  const { t, locale } = await i18n();
  const s = t(syncDict);
  const x = s.errors;
  const relativeTime = relativeTimeIn(locale);
  const { errorItems } = await getDashboard();
  const capability = errorItems.filter((e) => e.code === CAPABILITY_ERROR_CODE);
  const real = errorItems.filter((e) => e.code !== CAPABILITY_ERROR_CODE);

  const ErrorCard = ({ e, limitation }: { e: (typeof errorItems)[number]; limitation?: boolean }) => (
    <Card key={e.id} className="p-4">
      <div className="flex items-start gap-3">
        {limitation
          ? <StatusPill tone="neutral">{x.limitation}</StatusPill>
          : <StatusPill tone={e.severity === "critical" ? "danger" : "warning"}>{x.severity[e.severity] ?? e.severity}</StatusPill>}
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-ink-900">{e.message}</div>
          <div className="mt-0.5 text-[12px] text-ink-400">
            {e.channel?.name ?? "—"}{e.productLabel ? ` · ${e.productLabel}` : ""}{e.dateAffected ? ` · ${e.dateAffected.toISOString().slice(0, 10)}` : ""} · {relativeTime(e.createdAt)}
          </div>
          {e.recommendedAction && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-surface-muted px-3 py-2 text-[12.5px] text-ink-600">
              <span><span className="font-semibold text-ink-700">{x.recommended}</span> {e.recommendedAction}</span>
              {/* Actionable, not just descriptive (spec §3.8): the fix is one click away. */}
              {e.code.includes("not_mapped") && e.channel && (
                <Link href={`/mapping?ch=${e.channel.code}`} className="font-semibold text-brand-700 underline">{x.fixInMapping}</Link>
              )}
            </div>
          )}
        </div>
        <form action={resolveErrorItem}>
          <input type="hidden" name="id" value={e.id} />
          <button
            type="submit"
            title={limitation ? x.ignoreTitle : x.resolveTitle}
            className="rounded-md border border-surface-border px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-500 transition-colors hover:bg-surface-muted hover:text-ink-800"
          >
            {limitation ? x.ignore : x.resolve}
          </button>
        </form>
      </div>
    </Card>
  );

  return (
    <div className="space-y-3">
      {real.length > 0 && (
        <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-400">
          <AlertTriangle className="h-3.5 w-3.5" /> {x.real}
        </div>
      )}
      {real.map((e) => <ErrorCard key={e.id} e={e} />)}
      {capability.length > 0 && (
        <div className="mt-4 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-400">
          <Ban className="h-3.5 w-3.5" /> {x.limitations}
        </div>
      )}
      {capability.map((e) => <ErrorCard key={e.id} e={e} limitation />)}
      {/*
        ⚠️ "No open errors" is NOT "everything is syncing cleanly".
        A property with nothing mapped, no channel connected, or a paused connection raises no error
        and delivers nothing — and this card used to congratulate it. The claim now covers only what
        it can see: that nothing has failed. Whether anything was DELIVERED is the push rows' job,
        and they say so in their own words now (BUG-014).
      */}
      {errorItems.length === 0 && (
        <Card className="p-10 text-center text-[13px] text-ink-400">
          {x.none}
        </Card>
      )}
    </div>
  );
}

async function AuditTab() {
  const { t, locale } = await i18n();
  const s = t(syncDict);
  const relativeTime = relativeTimeIn(locale);
  const property = await getProperty();
  const entries = await prisma.auditEntry.findMany({
    where: { propertyId: property.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <Card>
      <CardHeader title={s.audit.title} />
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
              {Object.values(s.audit.cols).map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
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
                <td className="px-4 py-3">{e.syncResult ? <StatusPill tone={e.syncResult === "success" ? "success" : "danger"}>{s.audit.results[e.syncResult] ?? e.syncResult}</StatusPill> : "—"}</td>
                <td className="px-4 py-3 text-[12px] text-ink-400">{relativeTime(e.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
