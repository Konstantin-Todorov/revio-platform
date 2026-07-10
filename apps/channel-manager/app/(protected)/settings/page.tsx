import Link from "next/link";
import { Building2, Users } from "lucide-react";
import { getSettings } from "@/lib/data";
import { getSession } from "@/lib/session";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { PropertySettingsForm } from "@/components/settings/PropertySettingsForm";
import { DeliverySettingsForm } from "@/components/settings/DeliverySettingsForm";
import { AddPropertyDialog } from "@/components/settings/UserManagement";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ property, users, properties, totalRooms }, session] = await Promise.all([getSettings(), getSession()]);
  const canManage = session?.role === "owner" || session?.role === "admin";

  return (
    <div>
      <PageHeader title="Settings" subtitle="Property, your team, and connections" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Property" subtitle={`${totalRooms} physical rooms across the active room types`} />
            <div className="p-5"><PropertySettingsForm property={property} /></div>
          </Card>

          <Card>
            <CardHeader
              title="Reservation delivery & notifications"
              subtitle="Where channel bookings are emailed when no PMS/CRS takes delivery, plus the arrival summaries"
            />
            <div className="p-5">
              <DeliverySettingsForm property={property} emailMode={process.env.RESEND_API_KEY ? "resend" : "mock"} />
            </div>
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
            <CardHeader title="Team" />
            <div className="px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-600"><Users className="h-4 w-4" /></span>
                <div className="flex-1 text-[12.5px] text-ink-500">{users.length} user{users.length === 1 ? "" : "s"} on this account</div>
                <Link href="/users" className="rounded-md border border-surface-border px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
                  Manage users
                </Link>
              </div>
            </div>
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
