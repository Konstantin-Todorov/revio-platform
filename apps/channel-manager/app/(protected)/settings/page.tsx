import { getSettings } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { PropertySettingsForm } from "@/components/settings/PropertySettingsForm";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", admin: "Admin", revenue_manager: "Revenue Manager",
  distribution_manager: "Distribution Manager", read_only: "Read-only",
};

export default async function Page() {
  const { property, users } = await getSettings();

  return (
    <div>
      <PageHeader title="Settings" subtitle="Property, currency, users and connections" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Property" />
          <div className="p-5">
            <PropertySettingsForm property={property} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Users & Permissions" action={<span className="text-[12px] font-semibold text-ink-400">{users.length}</span>} />
            <ul className="divide-y divide-surface-border/60">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-800 text-[11px] font-bold text-white">
                    {u.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-ink-900">{u.name}</div>
                    <div className="truncate text-[11px] text-ink-400">{u.email}</div>
                  </div>
                  <StatusPill tone="info">{ROLE_LABEL[u.role] ?? u.role}</StatusPill>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="API / PMS Connection" />
            <div className="px-4 py-4 text-[12.5px] text-ink-500">
              API credentials and webhooks live here. A placeholder for connecting to a foreign PMS — built out
              when standalone mode is extended (per spec, not in V1).
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
