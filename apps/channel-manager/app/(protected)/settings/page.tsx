import { Building2 } from "lucide-react";
import { getSettings } from "@/lib/data";
import { getSession } from "@/lib/session";
import { removeUser } from "@/lib/actions-users";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { PropertySettingsForm } from "@/components/settings/PropertySettingsForm";
import { InviteUserDialog, AddPropertyDialog, RoleSelect } from "@/components/settings/UserManagement";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ property, users, properties }, session] = await Promise.all([getSettings(), getSession()]);
  const canManage = session?.role === "owner" || session?.role === "admin";

  return (
    <div>
      <PageHeader title="Settings" subtitle="Property, your team, and connections" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Property" />
            <div className="p-5"><PropertySettingsForm property={property} /></div>
          </Card>

          <Card>
            <CardHeader
              title="Properties"
              action={<div className="flex items-center gap-2"><span className="text-[12px] font-semibold text-ink-400">{properties.length}</span><AddPropertyDialog canManage={canManage} /></div>}
            />
            <ul className="divide-y divide-surface-border/60">
              {properties.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-600"><Building2 className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-ink-900">{p.name}{p.id === property.id && <span className="ml-1.5 text-[10px] font-bold uppercase text-brand-600">active</span>}</div>
                    <div className="text-[11px] text-ink-400">{p.baseCurrency} · {p.timezone}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Users & Permissions" action={<InviteUserDialog canManage={canManage} />} />
            <ul className="divide-y divide-surface-border/60">
              {users.map((u) => {
                const isSelf = u.id === session?.userId;
                return (
                  <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-800 text-[11px] font-bold text-white">
                      {u.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-ink-900">{u.name}{isSelf && <span className="ml-1.5 text-[10px] font-bold uppercase text-ink-400">you</span>}</div>
                      <div className="truncate text-[11px] text-ink-400">{u.email}</div>
                    </div>
                    {canManage ? (
                      <div className="flex items-center gap-1.5">
                        <RoleSelect userId={u.id} role={u.role} disabled={isSelf} />
                        {!isSelf && (
                          <form action={removeUser}>
                            <input type="hidden" name="id" value={u.id} />
                            <button type="submit" aria-label={`Remove ${u.name}`} className="rounded-md px-2 py-1 text-[11px] font-semibold text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600">Remove</button>
                          </form>
                        )}
                      </div>
                    ) : (
                      <StatusPill tone="info">{u.role.replace(/_/g, " ")}</StatusPill>
                    )}
                  </li>
                );
              })}
            </ul>
            {!canManage && <div className="border-t border-surface-border px-4 py-2.5 text-[11.5px] text-ink-400">Only an Owner or Admin can manage users.</div>}
          </Card>

          <Card>
            <CardHeader title="API / PMS Connection" />
            <div className="px-4 py-4 text-[12.5px] text-ink-500">
              API credentials and webhooks live here — a placeholder for connecting a foreign PMS, built out when
              standalone mode is extended.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
