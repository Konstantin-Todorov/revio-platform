"use client";

import { useActionState, useRef } from "react";
import { UserPlus, ShieldCheck, Power } from "lucide-react";
import { StatusPill } from "@/components/ui/primitives";
import { inviteStaff, setStaffRole, setStaffActive, type ActionResult } from "@/lib/actions-users";
import { PMS_ROLES, ROLE_LABEL } from "@/lib/roles";

type StaffUser = { id: string; name: string; email: string; role: string; active: boolean };

const inputCls = "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600";

function RoleSelect({ user, disabled }: { user: StaffUser; disabled: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={setStaffRole}>
      <input type="hidden" name="id" value={user.id} />
      <select
        key={user.role}
        name="role"
        defaultValue={PMS_ROLES.includes(user.role as (typeof PMS_ROLES)[number]) ? user.role : "manager"}
        disabled={disabled}
        onChange={() => ref.current?.requestSubmit()}
        className={`${inputCls} w-40 disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {PMS_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </select>
    </form>
  );
}

export function UsersManager({ users, meId, canManage }: { users: StaffUser[]; meId: string; canManage: boolean }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, fd) => inviteStaff(_prev, fd),
    null,
  );

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="rounded-lg border border-surface-border bg-white p-4 shadow-card">
          <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-bold text-ink-900"><UserPlus className="h-4 w-4 text-accent-600" /> Invite a person</h3>
          <form action={action} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-ink-600">Name</span>
              <input name="name" required placeholder="Jane Doe" className={`${inputCls} w-40`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-ink-600">Email</span>
              <input name="email" type="email" required placeholder="jane@hotel.com" className={`${inputCls} w-52`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-ink-600">Role</span>
              <select name="role" defaultValue="reception" className={`${inputCls} w-40`}>
                {PMS_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </label>
            <button disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-500 disabled:opacity-60">
              <UserPlus className="h-3.5 w-3.5" /> {pending ? "Inviting…" : "Invite"}
            </button>
          </form>
          {result?.error && <p className="mt-2 text-[12px] font-medium text-danger-600">{result.error}</p>}
          {result?.ok && <p className="mt-2 text-[12px] font-medium text-success-600">Invited — they can sign in with the shared demo password.</p>}
          <p className="mt-2 text-[11px] text-ink-400">One identity per person across every Revio product — this invites or re-roles the shared account, it never creates a PMS-only login.</p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
        <div className="border-b border-surface-border px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-ink-400">Staff · {users.length}</div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              <th className="px-4 py-2.5">Person</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Status</th>
              {canManage && <th className="px-4 py-2.5 text-right">Access</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isMe = u.id === meId;
              return (
                <tr key={u.id} className={`border-b border-surface-border/60 last:border-0 ${u.active ? "" : "opacity-60"}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 font-semibold text-ink-900">{u.name}{isMe && <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">YOU</span>}</div>
                    <div className="text-[11.5px] text-ink-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    {canManage && !isMe ? <RoleSelect user={u} disabled={false} /> : <StatusPill tone="neutral">{ROLE_LABEL[u.role] ?? u.role}</StatusPill>}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.active ? <StatusPill tone="success">Active</StatusPill> : <StatusPill tone="warning">Deactivated</StatusPill>}
                  </td>
                  {canManage && (
                    <td className="px-4 py-2.5 text-right">
                      {isMe ? (
                        <span className="text-[11.5px] text-ink-400">—</span>
                      ) : (
                        <form action={setStaffActive} className="inline">
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                          <button className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${u.active ? "border-surface-border text-ink-600 hover:bg-danger-50 hover:text-danger-600" : "border-success-500/50 text-success-600 hover:bg-success-50"}`}>
                            <Power className="h-3.5 w-3.5" /> {u.active ? "Deactivate" : "Reactivate"}
                          </button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="flex items-center gap-1.5 text-[11.5px] text-ink-400">
        <ShieldCheck className="h-3.5 w-3.5" /> Housekeeper is the scoped mobile view; Outlet / POS is the outlet-only posting view — role-gated screens layer onto these assignments.
      </p>
    </div>
  );
}
