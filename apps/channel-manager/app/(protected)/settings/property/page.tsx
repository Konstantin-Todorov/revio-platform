import { Building2 } from "lucide-react";
import { getSettings } from "@/lib/data";
import { getSession } from "@/lib/session";
import { Card, CardHeader } from "@/components/ui/primitives";
import { PropertySettingsForm } from "@/components/settings/PropertySettingsForm";
import { AddPropertyDialog } from "@/components/settings/UserManagement";

export const dynamic = "force-dynamic";

/** Your hotel's own details, and every property on this account. */
export default async function PropertySettingsPage() {
  const [{ property, properties, totalRooms }, session] = await Promise.all([getSettings(), getSession()]);
  const canManage = session?.role === "owner" || session?.role === "admin";

  return (
    <>
      <Card>
        <CardHeader title="Property" subtitle={`${totalRooms} physical rooms across the active room types`} />
        <div className="p-5"><PropertySettingsForm property={property} /></div>
      </Card>

      <Card>
        <CardHeader
          title="Properties"
          action={
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-ink-400">{properties.length}</span>
              <AddPropertyDialog canManage={canManage} />
            </div>
          }
        />
        <ul className="divide-y divide-surface-border/60">
          {properties.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                <Building2 className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-ink-900">
                  {p.name}
                  {p.id === property.id && (
                    <span className="ml-1.5 text-[10px] font-bold uppercase text-brand-600">active</span>
                  )}
                </div>
                <div className="text-[11px] text-ink-400">{p.baseCurrency} · {p.timezone}</div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
