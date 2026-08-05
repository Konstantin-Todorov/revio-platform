"use client";

import { useActionState, useEffect, useState } from "react";
import { Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { saveContact, deleteContact, type ActionResult } from "@/lib/actions-crm";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import { Card, CardHeader, StatusPill } from "@/components/ui/primitives";

export interface ContactView {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  isBilling: boolean;
  note: string | null;
}

const EMPTY: ContactView = { id: "", name: "", role: null, email: null, phone: null, isPrimary: false, isBilling: false, note: null };

/**
 * The people, as distinct from the logins.
 *
 * `User` rows are staff accounts — who can sign in. These are who we talk to, and the two overlap
 * far less than a schema would suggest: the owner who decides on renewal often has no login at all,
 * and the person who pays the invoice is rarely the one who bought. Modelling either as a staff
 * account would mean inventing credentials for people who must never have any.
 */
export function ContactsPanel({ tenantId, contacts }: { tenantId: string; contacts: ContactView[] }) {
  const [editing, setEditing] = useState<ContactView | null>(null);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveContact, null);
  useEffect(() => { if (state?.ok) setEditing(null); }, [state]);

  return (
    <Card>
      <CardHeader
        title={`Contacts (${contacts.length})`}
        action={
          <button onClick={() => setEditing(EMPTY)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-600 hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        }
      />

      {contacts.length === 0 ? (
        <p className="px-4 py-5 text-[13px] text-ink-500">
          Nobody recorded. An account you cannot phone is an account you cannot save — add the person you would
          actually call.
        </p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {contacts.map((c) => (
            <li key={c.id} className="group px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink-900">{c.name}</span>
                    {c.role && <span className="text-[11.5px] text-ink-500">{c.role}</span>}
                    {c.isPrimary && <StatusPill tone="success">primary</StatusPill>}
                    {c.isBilling && <StatusPill tone="info">billing</StatusPill>}
                  </div>
                  {/* Real links: the whole point of writing a number down is dialling it from here. */}
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                        <Mail className="h-3 w-3" /> {c.email}
                      </a>
                    )}
                    {c.phone && (
                      <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </a>
                    )}
                  </div>
                  {c.note && <p className="mt-1 text-[11.5px] text-ink-500">{c.note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`} className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-surface-muted hover:text-ink-700">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <form action={deleteContact}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="tenantId" value={tenantId} />
                    <button aria-label={`Remove ${c.name}`} className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? "Edit contact" : "Add contact"}>
        {editing && (
          <form action={formAction} className="space-y-3.5" key={editing.id || "new"}>
            <input type="hidden" name="tenantId" value={tenantId} />
            {editing.id && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name"><input name="name" required defaultValue={editing.name} className={inputCls} placeholder="Maria Petrova" /></Field>
              <Field label="Role"><input name="role" defaultValue={editing.role ?? ""} className={inputCls} placeholder="Owner" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email"><input name="email" type="email" defaultValue={editing.email ?? ""} className={inputCls} placeholder="maria@hotel.bg" /></Field>
              <Field label="Phone"><input name="phone" defaultValue={editing.phone ?? ""} className={inputCls} placeholder="+359 88 123 4567" /></Field>
            </div>
            <div className="flex flex-wrap gap-2">
              {[["isPrimary", "Primary contact", editing.isPrimary], ["isBilling", "Billing contact", editing.isBilling]].map(([name, label, checked]) => (
                <label key={name as string} className="flex cursor-pointer items-center gap-2 rounded-md border border-surface-border px-3 py-1.5 text-[12.5px] font-medium text-ink-600 hover:bg-surface-muted">
                  <input type="checkbox" name={name as string} defaultChecked={checked as boolean} className="h-4 w-4 rounded border-surface-border text-brand-600" /> {label as string}
                </label>
              ))}
            </div>
            <Field label="Note"><input name="note" defaultValue={editing.note ?? ""} className={inputCls} placeholder="Best reached mornings; prefers Bulgarian." /></Field>

            {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
              <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? "Saving…" : "Save contact"}</button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}
