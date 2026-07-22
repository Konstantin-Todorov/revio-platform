import { Clock, Users } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getStaff } from "@/lib/data";
import { getWorkforceSummary } from "@/lib/workforce";
import { UsersManager } from "@/components/users/UsersManager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [{ property, users, meId, canManage }, workforce] = await Promise.all([getStaff(), getWorkforceSummary()]);

  return (
    <div>
      <PageHeader
        title="Staff &amp; Access Management"
        subtitle={`${property.name} · who’s working today + who can sign in and what they can touch — one shared Revio identity`}
      />

      {/* Workforce dashboard (§10.2) — who's available right now, grouped by role/department, live (not
          history). Fed by the J0 clock-in mechanism (StaffShift). Availability + light KPI, not payroll. */}
      <Card className="mb-4">
        <CardHeader
          title="Working today"
          subtitle="Live — staff currently clocked in, by department"
          action={<span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-400"><Clock className="h-3.5 w-3.5" />{workforce.totalActive} active</span>}
        />
        {workforce.totalActive === 0 ? (
          <p className="px-4 py-4 text-[12.5px] text-ink-400">No one is clocked in right now. Staff clock in from their own view (Housekeeping / Maintenance).</p>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {workforce.groups.map((g) => (
              <div key={g.role} className="rounded-lg border border-surface-border bg-surface-muted/40 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{g.roleLabel}</span>
                  <span className="tnum rounded-full bg-white px-1.5 py-0.5 text-[10.5px] font-bold text-ink-600">{g.active.length}</span>
                </div>
                <ul className="space-y-1">
                  {g.active.map((s) => (
                    <li key={s.id} className="flex items-center justify-between text-[12.5px]">
                      <span className="flex items-center gap-1.5 text-ink-800"><Users className="h-3 w-3 text-ink-400" />{s.userName}</span>
                      <span className="tnum text-[11px] text-ink-400">since {s.clockInAt.toISOString().slice(11, 16)}{s.delegated ? " · by staff" : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <UsersManager users={users} meId={meId} canManage={canManage} />
    </div>
  );
}
