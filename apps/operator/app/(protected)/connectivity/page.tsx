import { getConnectivity } from "@/lib/data";
import { removeConnectivityKey, testStoredKey, testPlatformKey } from "@/lib/actions-connectivity";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { KeyDialog } from "@/components/connectivity/KeyDialog";

export const dynamic = "force-dynamic";

function relative(d: Date): string {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

type Cred = {
  hint: string; updatedAt: Date;
  lastCheckOk: boolean | null; lastCheckedAt: Date | null; lastCheckMessage: string | null;
};

/**
 * A stored key's health, in three states — and the third one is the point.
 *
 * Working / rejected / **never tested**. A key nobody has exercised is not a working key, and until
 * 2026-09-01 this screen showed it identically to one that was: a revoked credential sat here
 * looking healthy while the first real hotel's channel did nothing for hours.
 */
function Health({ cred }: { cred: Cred }) {
  if (cred.lastCheckOk === null) {
    return <StatusPill tone="warning">never tested</StatusPill>;
  }
  return (
    <span title={`${cred.lastCheckMessage ?? ""}${cred.lastCheckedAt ? ` · checked ${relative(cred.lastCheckedAt)}` : ""}`}>
      <StatusPill tone={cred.lastCheckOk ? "success" : "danger"}>
        {cred.lastCheckOk ? "working" : "rejected"}
      </StatusPill>
    </span>
  );
}

function KeyCell({ tenantId, tenantName, mode, cred }: { tenantId: string; tenantName: string; mode: string; cred: Cred | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {cred ? (
        <>
          <span title="This client OVERRIDES the platform key" className="rounded bg-warning-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-warning-700">own key</span>
          <span className="tnum rounded bg-surface-sunken px-1.5 py-0.5 text-[11.5px] font-semibold text-ink-700">{cred.hint}</span>
          <Health cred={cred} />
          <form action={testStoredKey}>
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="mode" value={mode} />
            <button type="submit" className="rounded-md px-2 py-1 text-[11px] font-semibold text-accent-600 transition-colors hover:bg-accent-50">Check now</button>
          </form>
        </>
      ) : (
        // Not an absence — the normal, correct state. Saying "not set" invited somebody to fix it.
        <span className="text-[12px] text-ink-400">uses our platform key</span>
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
      {/*
        * THE PLATFORM KEY IS THE NORMAL CASE, so it goes first and largest.
        *
        * We are certified with Channex as a PMS partner: one organisation, one key scoped to all
        * properties, and Channex bills US per property with an active channel. A hotel does not need
        * a Channex account of its own and normally does not have one.
        *
        * The per-tenant rows below are the EXCEPTION — a hotel that arrives already owning a Channex
        * account and wants to keep it. Presenting them as the default (which this screen used to do)
        * invites somebody to paste a key per client and quietly override the platform key for that
        * hotel, which is exactly what went wrong on 2026-09-01.
        */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-bold text-ink-900">Our platform key</h3>
            <p className="mt-0.5 max-w-2xl text-[11.5px] text-ink-500">
              One Channex organisation, one key, every property. This is what almost every hotel uses —
              they do not need a Channex account of their own. Set on channel-manager, reservation and
              pms in Railway; not stored here, so it is checked live.
            </p>
          </div>
          <div className="flex gap-2">
            {["channex_prod", "channex_sandbox"].map((m) => (
              <form key={m} action={testPlatformKey}>
                <input type="hidden" name="mode" value={m} />
                <button type="submit" className="rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-700">
                  Check {m === "channex_prod" ? "production" : "sandbox"}
                </button>
              </form>
            ))}
          </div>
        </div>
      </Card>

      <PageHeader
        title="Connectivity"
        subtitle="Per-client keys — the EXCEPTION, for a hotel that brings its own Channex account. Leave a client unset and our platform key is used. Tested on save; “Check now” asks Channex again."
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
                      : <StatusPill tone="neutral">all on test</StatusPill>}
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
