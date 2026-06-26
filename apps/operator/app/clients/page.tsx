import { getClients } from "@/lib/data";
import { setStatus } from "@/lib/actions";
import { Card, PageHeader, StatusPill } from "@/components/ui/primitives";
import { CreateClientDialog } from "@/components/clients/CreateClientDialog";
import { EntitlementToggle } from "@/components/clients/EntitlementToggle";

export const dynamic = "force-dynamic";

const PLAN_LABEL: Record<string, string> = { starter: "Starter", growth: "Growth", scale: "Scale" };

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Onboard hotels, set which products they bought, and manage access"
        action={<CreateClientDialog />}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Client", "Owner", "Properties", "Plan", "Products (click to toggle)", "Status", ""].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-surface-border/60 align-top transition-colors last:border-0 hover:bg-surface-muted/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink-900">{c.name}</div>
                    <div className="text-[11px] text-ink-400">/{c.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    {c.owner ? <><div className="text-ink-800">{c.owner.name}</div><div className="text-[11px] text-ink-400">{c.owner.email}</div></> : <span className="text-ink-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {c.properties.map((p) => <div key={p.id}>{p.name}</div>)}
                  </td>
                  <td className="px-4 py-3"><StatusPill tone={c.plan === "scale" ? "success" : c.plan === "growth" ? "info" : "neutral"}>{PLAN_LABEL[c.plan] ?? c.plan}</StatusPill></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <EntitlementToggle tenantId={c.id} product="channelManager" enabled={c.entitlements.channelManager} />
                      <EntitlementToggle tenantId={c.id} product="reservation" enabled={c.entitlements.reservation} />
                      <EntitlementToggle tenantId={c.id} product="pms" enabled={c.entitlements.pms} />
                    </div>
                  </td>
                  <td className="px-4 py-3">{c.status === "active" ? <StatusPill tone="success">active</StatusPill> : <StatusPill tone="warning">suspended</StatusPill>}</td>
                  <td className="px-2 py-3">
                    <form action={setStatus}>
                      <input type="hidden" name="tenantId" value={c.id} />
                      <input type="hidden" name="status" value={c.status === "active" ? "suspended" : "active"} />
                      <button type="submit" className="rounded-md border border-surface-border px-2.5 py-1 text-[11.5px] font-semibold text-ink-500 transition-colors hover:bg-surface-muted">
                        {c.status === "active" ? "Suspend" : "Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-3 text-[12px] text-ink-400">
        Toggling a product flips that hotel's entitlement — it instantly gains or loses access to RevioLink /
        RevioCRS / RevioPMS on the same shared data. This is how products are sold separately.
      </p>
    </div>
  );
}
