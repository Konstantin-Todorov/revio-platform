import { getConnectivity } from "@/lib/data";
import { removeConnectivityKey } from "@/lib/actions-connectivity";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { KeyDialog } from "@/components/connectivity/KeyDialog";

export const dynamic = "force-dynamic";

function relative(d: Date): string {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function KeyCell({ tenantId, tenantName, mode, cred }: { tenantId: string; tenantName: string; mode: string; cred: { hint: string; updatedAt: Date } | null }) {
  return (
    <div className="flex items-center gap-2">
      {cred ? (
        <>
          <span className="tnum rounded bg-surface-sunken px-1.5 py-0.5 text-[11.5px] font-semibold text-ink-700">{cred.hint}</span>
          <span className="text-[11px] text-ink-400">{relative(cred.updatedAt)}</span>
        </>
      ) : (
        <span className="text-[12px] text-ink-300">not set</span>
      )}
      <KeyDialog tenantId={tenantId} tenantName={tenantName} mode={mode} hasKey={!!cred} />
      {cred && (
        <form action={removeConnectivityKey}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="mode" value={mode} />
          <button type="submit" className="rounded-md px-2 py-1 text-[11px] font-semibold text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600">Remove</button>
        </form>
      )}
    </div>
  );
}

export default async function Page() {
  const rows = await getConnectivity();

  return (
    <div>
      <PageHeader
        title="Connectivity"
        subtitle="Per-client OTA / Channex credentials — encrypted at rest, never visible to hotels"
      />
      <Card>
        <CardHeader title="Channex API keys" />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Client", "Sandbox key", "Production key", "Live channels"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-3 font-semibold text-ink-900">{r.name}</td>
                  <td className="px-4 py-3"><KeyCell tenantId={r.id} tenantName={r.name} mode="channex_sandbox" cred={r.sandbox} /></td>
                  <td className="px-4 py-3"><KeyCell tenantId={r.id} tenantName={r.name} mode="channex_prod" cred={r.prod} /></td>
                  <td className="px-4 py-3">
                    {r.channexChannels > 0
                      ? <StatusPill tone="info">{r.channexChannels} on Channex</StatusPill>
                      : <StatusPill tone="neutral">all mock</StatusPill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-[12px] text-ink-400">
        Resolution order at push/pull time: the client's stored key first, then the platform env key
        (<code className="rounded bg-surface-sunken px-1">CHANNEX_SANDBOX_KEY</code> /{" "}
        <code className="rounded bg-surface-sunken px-1">CHANNEX_PROD_KEY</code>) as fallback. Hotels can
        never read this table — it's outside the tenant perimeter.
      </p>
    </div>
  );
}
