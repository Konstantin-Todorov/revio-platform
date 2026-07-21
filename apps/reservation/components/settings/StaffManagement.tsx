"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { UserPlus, KeyRound, Pencil, UserCheck, UserX } from "lucide-react";
import {
  inviteUser, updateUser, updateUserRole, setUserActive, resetUserPassword, type ActionResult,
} from "@/lib/actions-users";
import { Modal, Field, inputCls } from "@/components/ui/Modal";

export type StaffRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  active: boolean;
};

export const ROLE_OPTIONS: [string, string][] = [
  ["owner", "Owner"],
  ["admin", "Admin"],
  ["revenue_manager", "Revenue Manager"],
  ["distribution_manager", "Distribution Manager"],
  ["read_only", "Read-only"],
];
const roleLabel = (r: string) => ROLE_OPTIONS.find(([v]) => v === r)?.[1] ?? r.replace(/_/g, " ");

/** Inline role selector — saves on change. Disabled for yourself / when not allowed. */
function RoleSelect({ userId, role, disabled }: { userId: string; role: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={role}
      disabled={disabled || pending}
      onChange={(e) => {
        const fd = new FormData();
        fd.set("id", userId);
        fd.set("role", e.target.value);
        start(() => updateUserRole(fd));
      }}
      className={`h-8 rounded-md border border-surface-border bg-white px-2 text-[12.5px] text-ink-700 outline-none focus:border-brand-600 disabled:opacity-60 ${pending ? "opacity-60" : ""}`}
    >
      {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

/** Fire a simple void server action from a hidden form (deactivate/reactivate, reset password). */
function ActionButton({
  action, fields, title, confirm, children, tone = "muted",
}: {
  action: (fd: FormData) => Promise<void>;
  fields: Record<string, string>;
  title: string;
  confirm?: string;
  children: React.ReactNode;
  tone?: "muted" | "danger" | "success";
}) {
  const [pending, start] = useTransition();
  const toneCls =
    tone === "danger" ? "text-ink-400 hover:bg-danger-50 hover:text-danger-600"
    : tone === "success" ? "text-ink-400 hover:bg-success-50 hover:text-success-600"
    : "text-ink-400 hover:bg-surface-muted hover:text-brand-700";
  return (
    <button
      type="button"
      title={title}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
        start(() => action(fd));
      }}
      className={`rounded p-1.5 transition-colors disabled:opacity-50 ${toneCls}`}
    >
      {children}
    </button>
  );
}

function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(inviteUser, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
        <UserPlus className="h-4 w-4" /> Add staff
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a team member">
        <p className="mb-3 text-[12.5px] text-ink-500">
          Creates the <strong>one shared Revio identity</strong> — the same login works across every product this
          hotel owns. (Demo: password <code className="rounded bg-surface-sunken px-1">revio1234</code>; production
          emails an invite link.)
        </p>
        <form action={formAction} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input name="name" required className={inputCls} placeholder="Lena Koch" /></Field>
            <Field label="Email (login)"><input name="email" type="email" required className={inputCls} placeholder="lena@hotel.com" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><input name="phone" className={inputCls} placeholder="+359 88 000 0000" /></Field>
            <Field label="Role">
              <select name="role" defaultValue="revenue_manager" className={inputCls}>
                {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          </div>
          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? "Adding…" : "Add staff"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function EditDialog({ user, onClose }: { user: StaffRow; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(updateUser, null);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  return (
    <Modal open onClose={onClose} title={`Edit ${user.name}`}>
      <p className="mb-3 text-[12.5px] text-ink-500">Changes apply to the shared Revio login — email is the sign-in identifier.</p>
      <form action={formAction} className="space-y-3.5">
        <input type="hidden" name="id" value={user.id} />
        <Field label="Name"><input name="name" required defaultValue={user.name} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email (login)"><input name="email" type="email" required defaultValue={user.email} className={inputCls} /></Field>
          <Field label="Phone"><input name="phone" defaultValue={user.phone ?? ""} className={inputCls} placeholder="—" /></Field>
        </div>
        {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
          <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Staff — full user-management CRUD on the shared identity (CRS-REFINEMENT-R2 §8.2): add, assign role,
 * deactivate (preferred over delete), update role, reset password, change email/phone. Read-only when the
 * current user isn't an Owner/Admin.
 */
export function StaffManagement({ users, canManage, currentUserId }: { users: StaffRow[]; canManage: boolean; currentUserId?: string }) {
  const [editing, setEditing] = useState<StaffRow | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-surface-border/60 px-4 py-3">
        <p className="text-[12px] text-ink-500">
          One account across every Revio product — manage it here or in RevioLink / RevioPMS; it’s the same identity.
        </p>
        {canManage && <InviteDialog />}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Phone</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Status</th>
              {canManage && <th className="px-4 py-2.5 text-right">Manage</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className={`border-b border-surface-border/60 last:border-0 ${u.active ? "" : "opacity-60"}`}>
                  <td className="px-4 py-2.5 font-semibold text-ink-900">
                    {u.name}
                    {isSelf && <span className="ml-1.5 rounded bg-brand-50 px-1 text-[9.5px] font-bold uppercase text-brand-700">you</span>}
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">{u.email}</td>
                  <td className="tnum px-4 py-2.5 text-ink-600">{u.phone ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {canManage ? <RoleSelect userId={u.id} role={u.role} disabled={isSelf} /> : <span className="text-ink-700">{roleLabel(u.role)}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase ${u.active ? "bg-success-50 text-success-600" : "bg-surface-sunken text-ink-400"}`}>
                      {u.active ? "active" : "deactivated"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button type="button" title="Edit name / email / phone" onClick={() => setEditing(u)} className="rounded p-1.5 text-ink-400 transition-colors hover:bg-surface-muted hover:text-brand-700">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <ActionButton
                          action={resetUserPassword}
                          fields={{ id: u.id }}
                          title="Reset password (shared login)"
                          confirm={`Reset ${u.name}'s password? Demo resets to the shared demo password; production emails a reset link.`}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </ActionButton>
                        {u.active ? (
                          <ActionButton
                            action={setUserActive}
                            fields={{ id: u.id, active: "false" }}
                            title={isSelf ? "You can't deactivate yourself" : "Deactivate"}
                            confirm={`Deactivate ${u.name}? They keep their history but can't sign in.`}
                            tone="danger"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </ActionButton>
                        ) : (
                          <ActionButton action={setUserActive} fields={{ id: u.id, active: "true" }} title="Reactivate" tone="success">
                            <UserCheck className="h-3.5 w-3.5" />
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && <EditDialog user={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
