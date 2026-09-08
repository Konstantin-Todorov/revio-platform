import { UserPlus, Trash2, ShieldCheck, User } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardHeader, StatusPill } from "@/components/ui/primitives";
import { getOperatorUsers } from "@/lib/data";
import { getOperatorSession } from "@/lib/session";
import { inviteOperator, updateOperatorRole, removeOperator } from "@/lib/actions-settings";

export const dynamic = "force-dynamic";

const inputCls =
  "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[16px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-600 sm:text-[13px]";
const ROLE_LABEL: Record<string, string> = { super_admin: "Super admin", support: "Support" };

/**
 * Everyone who can read every hotel on the platform.
 *
 * New accounts are invited and choose their own password — nobody here can set or read one.
 */
export default async function StaffSettingsPage() {
  const session = await getOperatorSession();
  if (!session) redirect("/logout");
  const users = await getOperatorUsers();
  const isAdmin = session.role === "super_admin";

  return (
    <>
    {/* Operator staff */}
    <Card className="mb-4">
      <CardHeader title={`Operator staff · ${users.length}`} />
      <ul className="divide-y divide-surface-border">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-sunken text-ink-500">
                {u.role === "super_admin" ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13.5px] font-semibold text-ink-900">{u.name}</span>
                  {u.id === session.userId && <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">You</span>}
                </div>
                <div className="truncate text-[11.5px] text-ink-500">{u.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && u.id !== session.userId ? (
                <>
                  <form action={updateOperatorRole} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={u.id} />
                    <select name="role" defaultValue={u.role} className={`${inputCls} py-0`}>
                      <option value="super_admin">Super admin</option>
                      <option value="support">Support</option>
                    </select>
                    <button type="submit" className="rounded-md border border-surface-border px-2 py-1 text-[11.5px] font-semibold text-ink-600 hover:bg-surface-muted">Save</button>
                  </form>
                  <form action={removeOperator}>
                    <input type="hidden" name="id" value={u.id} />
                    <button type="submit" aria-label="Remove" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-danger-50 hover:text-danger-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </form>
                </>
              ) : (
                <StatusPill tone={u.role === "super_admin" ? "success" : "neutral"}>{ROLE_LABEL[u.role]}</StatusPill>
              )}
            </div>
          </li>
        ))}
      </ul>
      {isAdmin && (
        <div className="border-t border-surface-border bg-surface-muted px-4 py-3">
          <form action={inviteOperator} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-ink-600">Name</span>
              <input name="name" required placeholder="Full name" className={`${inputCls} w-40`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-ink-600">Email</span>
              <input name="email" type="email" required placeholder="name@revio.app" className={`${inputCls} w-52`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-ink-600">Role</span>
              <select name="role" defaultValue="support" className={`${inputCls} w-32`}>
                <option value="support">Support</option>
                <option value="super_admin">Super admin</option>
              </select>
            </label>
            <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              <UserPlus className="h-3.5 w-3.5" /> Invite
            </button>
          </form>
        </div>
      )}
    </Card>
    </>
  );
}
