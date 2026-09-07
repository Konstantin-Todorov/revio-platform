import { prisma } from "@/lib/db";
import { getProperty } from "@/lib/data";
import { getSession } from "@/lib/session";
import { deletePermissionRole, savePermissionRole } from "@/lib/actions-settings";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { Card, CardHeader } from "@/components/ui/primitives";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { StaffManagement, type StaffRow } from "@/components/settings/StaffManagement";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400";

const GROUP_LABEL: Record<string, string> = {
  reservations: "Reservations", rates: "Rates", inventory: "Inventory", restrictions: "Restrictions",
  users: "Users", reports: "Reports", distribution: "Distribution", finance: "Finance",
};

export default async function SettingsUsersPage() {
  const property = await getProperty();
  // Who is looking: the Staff card hides management from a non-admin and never offers to
  // deactivate the account you are signed in as.
  const session = await getSession();
  const [roles, users] = await Promise.all([
    prisma.permissionRole.findMany({
      where: { tenantId: property.tenantId },
      include: { access: true },
      orderBy: [{ builtin: "desc" }, { name: "asc" }],
    }),
    prisma.user.findMany({ where: { tenantId: property.tenantId }, orderBy: { name: "asc" } }),
  ]);

  const levelOf = (role: (typeof roles)[number], group: string) =>
    role.access.find((a) => a.group === group)?.level ?? "none";

  return (
    <>
      <Card>
        <CardHeader title="Users & Permissions" subtitle="Define roles here. Assign people to them in RevioLink → User Management — one login per person across every Revio product." />
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5">Role</th>
                {PERMISSION_GROUPS.map((g) => <th key={g} className="px-2 py-2.5 text-center">{GROUP_LABEL[g]}</th>)}
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="group border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2">
                    <span className="font-semibold text-ink-900">{role.name}</span>
                    {role.builtin && <span className="ml-1.5 rounded bg-surface-sunken px-1 text-[9.5px] font-bold uppercase text-ink-400">built-in</span>}
                  </td>
                  {PERMISSION_GROUPS.map((g) => {
                    const level = levelOf(role, g);
                    return (
                      <td key={g} className="px-2 py-2 text-center">
                        <span className={`inline-block min-w-[38px] rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase ${
                          level === "edit" ? "bg-success-50 text-success-600" : level === "view" ? "bg-brand-50 text-brand-700" : "text-ink-300"
                        }`}>
                          {level}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-right">
                    {!role.builtin && (
                      <span className="opacity-0 transition-opacity group-hover:opacity-100">
                        <DeleteButton action={deletePermissionRole} id={role.id} label={role.name} note="Users keep their assignment until changed." />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details className="border-t border-surface-border/60">
          <summary className="cursor-pointer px-4 py-2.5 text-[12.5px] font-semibold text-brand-700 hover:bg-surface-muted">
            + Add a custom role
          </summary>
          <form action={savePermissionRole} className="grid grid-cols-2 items-end gap-3 p-4 lg:grid-cols-5">
            <div className="col-span-2 lg:col-span-1">
              <label className={labelCls}>Role name</label>
              <input name="name" required placeholder="e.g. Front Desk" className={inputCls} />
            </div>
            {PERMISSION_GROUPS.map((g) => (
              <div key={g}>
                <label className={labelCls}>{GROUP_LABEL[g]}</label>
                <select name={`level_${g}`} defaultValue="none" className={inputCls}>
                  <option value="none">None</option>
                  <option value="view">View</option>
                  <option value="edit">Edit</option>
                </select>
              </div>
            ))}
            <button className="h-[34px] rounded-md bg-brand-800 px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">Create role</button>
          </form>
        </details>
      </Card>

      {/* Staff — full user-management CRUD on the shared identity (spec §8.2). Supersedes the old
          "managed in RevioLink only" note: user management is now surfaced in each product, all acting
          on the one shared-core account. */}
      <Card>
        <CardHeader
          title={`Staff (${users.length})`}
          subtitle="Add, deactivate, change role, reset password, edit email/phone — all on the one shared Revio identity"
        />
        <StaffManagement
          users={users.map<StaffRow>((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, active: u.active }))}
          canManage={session?.role === "owner" || session?.role === "admin"}
          currentUserId={session?.userId}
        />
      </Card>
    </>
  );
}
