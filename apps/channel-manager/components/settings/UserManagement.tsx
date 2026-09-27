"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { UserPlus, Plus } from "lucide-react";
import { inviteUser, updateUserRole, addProperty, type ActionResult } from "@/lib/actions-users";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { settings as settingsDict } from "@/lib/i18n/settings";

export const ROLE_OPTIONS = ["owner", "admin", "revenue_manager", "distribution_manager", "read_only"] as const;

/** Inline role selector — saves on change. Disabled for the current user / when not allowed. */
export function RoleSelect({ userId, role, disabled }: { userId: string; role: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const roles = translate(settingsDict, useLocale()).users.roles;
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
      {ROLE_OPTIONS.map((v) => <option key={v} value={v}>{roles[v]}</option>)}
    </select>
  );
}

export function InviteUserDialog({ canManage }: { canManage: boolean }) {
  const u = translate(settingsDict, useLocale()).users;
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(inviteUser, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  if (!canManage) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
        <UserPlus className="h-4 w-4" /> {u.invite}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={u.inviteTitle}>
        <p className="mb-3 text-[12.5px] text-ink-500">{u.inviteLead}</p>
        <form action={formAction} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label={u.name}><input name="name" required className={inputCls} placeholder={u.namePlaceholder} /></Field>
            <Field label={u.email}><input name="email" type="email" required className={inputCls} placeholder={u.emailPlaceholder} /></Field>
          </div>
          <Field label={u.role}>
            <select name="role" defaultValue="distribution_manager" className={inputCls}>
              {ROLE_OPTIONS.map((v) => <option key={v} value={v}>{u.roles[v]}</option>)}
            </select>
          </Field>
          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">{u.cancel}</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? u.inviting : u.send}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function AddPropertyDialog({ canManage }: { canManage: boolean }) {
  const p = translate(settingsDict, useLocale()).property;
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(addProperty, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  if (!canManage) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
        <Plus className="h-4 w-4" /> {p.add}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={p.addTitle}>
        <p className="mb-3 text-[12.5px] text-ink-500">{p.addLead}</p>
        <form action={formAction} className="space-y-3.5">
          <Field label={p.name}><input name="name" required className={inputCls} placeholder={p.addNamePlaceholder} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={p.currency}><select name="baseCurrency" defaultValue="EUR" className={inputCls}>{["EUR", "USD", "GBP"].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label={p.timezone}><input name="timezone" defaultValue="Europe/Sofia" className={inputCls} /></Field>
          </div>
          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">{p.cancel}</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? p.adding : p.add}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
