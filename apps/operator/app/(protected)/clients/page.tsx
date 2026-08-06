import Link from "next/link";
import { getClients } from "@/lib/data";
import { setStatus } from "@/lib/actions";
import { Card, PageHeader, StatusPill } from "@/components/ui/primitives";
import { CreateClientDialog } from "@/components/clients/CreateClientDialog";
import { EntitlementToggle } from "@/components/clients/EntitlementToggle";
import { STAGE_LABEL, renewalStatus, type Stage } from "@/lib/account";

export const dynamic = "force-dynamic";

const PLAN_LABEL: Record<string, string> = { starter: "Starter", growth: "Growth", scale: "Scale" };
const STAGE_TONE: Record<Stage, "success" | "info" | "warning" | "danger" | "neutral"> = {
  prospect: "neutral", onboarding: "info", live: "success", at_risk: "warning", churned: "danger",
};

export default async function ClientsPage() {
  const clients = await getClients();
  const demoCount = clients.filter((c) => c.isDemo).length;

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
                {["Client", "Account", "Who to call", "Properties", "Plan", "Products (click to toggle)", "Status", ""].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-surface-border/60 align-top transition-colors last:border-0 hover:bg-surface-muted/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {/* A dot, not a badge: it has to be scannable down a column of forty hotels,
                          and colour alone carries no meaning without the flag text beside it below. */}
                      {c.worst && (
                        <span
                          aria-hidden
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            c.worst === "act" ? "bg-danger-600" : c.worst === "soon" ? "bg-warning-500" : "bg-ink-300"
                          }`}
                        />
                      )}
                      <Link href={`/clients/${c.id}`} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline">
                        {c.name}
                      </Link>
                      {/* Never hidden, always marked. A demo tenant that reads as a customer is the
                          whole hazard of keeping them in production. */}
                      {c.isDemo && (
                        <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-ink-500">demo</span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-400">/{c.slug}</div>
                    {/* The reason, in words. A row that says only "something is wrong" makes you open
                        four other screens to find out what — which is the problem this replaces. */}
                    {c.attention.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {c.attention.slice(0, 3).map((f) => (
                          <li
                            key={f.title}
                            title={f.detail}
                            className={`text-[11px] ${
                              f.severity === "act" ? "font-semibold text-danger-600" : f.severity === "soon" ? "text-warning-600" : "text-ink-400"
                            }`}
                          >
                            {f.title}
                          </li>
                        ))}
                        {c.attention.length > 3 && (
                          <li className="text-[11px] text-ink-300">+{c.attention.length - 3} more</li>
                        )}
                      </ul>
                    )}
                  </td>
                  {/* Where the relationship stands: what we say, when it renews, and — where they
                      disagree — what their usage says instead. */}
                  <td className="px-4 py-3">
                    <StatusPill tone={STAGE_TONE[c.account.stage]}>{STAGE_LABEL[c.account.stage]}</StatusPill>
                    {c.account.observed !== c.account.stage && (
                      <div className="mt-1 text-[11px] text-ink-400">looks {STAGE_LABEL[c.account.observed].toLowerCase()}</div>
                    )}
                    {/* The DATE, not the countdown. "Renews in 41 days" is already in the flag list
                        beside the client name; printing the same sentence twice on one row is how a
                        table stops being scannable. The colour carries the urgency instead. */}
                    {c.account.renewalDate && (() => {
                      const r = renewalStatus(c.account.renewalDate);
                      return (
                        <div className={`tnum mt-1 text-[11px] ${r?.severity === "act" ? "font-semibold text-danger-600" : r ? "font-semibold text-warning-600" : "text-ink-400"}`}>
                          renews {c.account.renewalDate.toISOString().slice(0, 10)}
                        </div>
                      );
                    })()}
                  </td>
                  {/* The person, then the login. They are usually not the same human — the owner who
                      decides on renewal often has no account at all. */}
                  <td className="px-4 py-3">
                    {c.account.primaryContact ? (
                      <>
                        <div className="text-ink-800">{c.account.primaryContact.name}</div>
                        <div className="text-[11px] text-ink-400">{c.account.primaryContact.phone ?? c.account.primaryContact.email}</div>
                      </>
                    ) : c.owner ? (
                      <>
                        <div className="text-ink-800">{c.owner.name}</div>
                        <div className="text-[11px] text-ink-300">login · no contact recorded</div>
                      </>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
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
        Toggling a product flips that hotel&rsquo;s entitlement — it instantly gains or loses access to RevioLink /
        RevioCRS / RevioPMS on the same shared data. This is how products are sold separately.
      </p>
      {demoCount > 0 && (
        <p className="mt-1.5 text-[12px] text-ink-400">
          <span className="font-semibold text-ink-500">{demoCount} client{demoCount === 1 ? " is" : "s are"} marked demo</span> —
          ours, for testing, living in production so every rehearsal runs against the real deployment. They work exactly
          like a real client in all five apps, and are left out of MRR, billed revenue and the attention feed.
        </p>
      )}
    </div>
  );
}
