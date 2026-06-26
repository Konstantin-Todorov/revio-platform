"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { UserPlus, Plus } from "lucide-react";
import { inviteUser, updateUserRole, addProperty, type ActionResult } from "@/lib/actions-users";
import { Modal, Field, inputCls } from "@/components/ui/Modal";

export const ROLE_OPTIONS: [string, string][] = [
  ["owner", "Owner"],
  ["admin", "Admin"],
  ["revenue_manager", "Revenue Manager"],
  ["distribution_manager", "Distribution Manager"],
  ["read_only", "Read-only"],
];

/** Inline role selector — saves on change. Disabled for the current user / when not allowed. */
export function RoleSelect({ userId, role, disabled }: { userId: string; role: string; disabled?: boolean }) {
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

export function InviteUserDialog({ canManage }: { canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(inviteUser, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  if (!canManage) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
        <UserPlus className="h-4 w-4" /> Invite user
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Invite a team member">
        <p className="mb-3 text-[12.5px] text-ink-500">They’ll get access to this hotel scoped to their role. (Demo: password <code className="rounded bg-surface-sunken px-1">revio1234</code>; production sends an invite link.)</p>
        <form action={formAction} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input name="name" required className={inputCls} placeholder="Lena Koch" /></Field>
            <Field label="Email"><input name="email" type="email" required className={inputCls} placeholder="lena@hotel.com" /></Field>
          </div>
          <Field label="Role">
            <select name="role" defaultValue="distribution_manager" className={inputCls}>
              {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? "Inviting…" : "Send invite"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function AddPropertyDialog({ canManage }: { canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(addProperty, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  if (!canManage) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
        <Plus className="h-4 w-4" /> Add property
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a property">
        <p className="mb-3 text-[12.5px] text-ink-500">For chains — add another hotel to this account. It appears in the property switcher and gets its own rooms, rates and channels.</p>
        <form action={formAction} className="space-y-3.5">
          <Field label="Property name"><input name="name" required className={inputCls} placeholder="Grand Marina — Varna" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Base currency"><select name="baseCurrency" defaultValue="EUR" className={inputCls}>{["EUR", "USD", "GBP", "BGN"].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Time zone"><input name="timezone" defaultValue="Europe/Sofia" className={inputCls} /></Field>
          </div>
          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? "Adding…" : "Add property"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
