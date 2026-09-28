"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient, type ActionResult } from "@/lib/actions";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import { ActionForm } from "@revio/ui/action-form";
import { ACCOUNT_TYPES, todayInTimeZone, type AccountType } from "@revio/core";

const TYPE_HINT: Record<AccountType, string> = Object.fromEntries(ACCOUNT_TYPES.map((t) => [t.key, t.blurb])) as Record<AccountType, string>;

export function CreateClientDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AccountType>("live");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(createClient, null);

  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700">
        <Plus className="h-4 w-4" /> New client
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Onboard a new client">
        <p className="mb-3 text-[12.5px] text-ink-500">
          Creates the client organization, its first property, and the <span className="font-semibold text-ink-700">Owner</span> login.
          The Owner then adds their own staff inside the product.
        </p>
        <ActionForm action={formAction} state={state} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client / organization"><input name="name" required className={inputCls} placeholder="Grand Marina Hotels" /></Field>
            <Field label="First property"><input name="propertyName" className={inputCls} placeholder="Grand Marina — Sofia" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner name"><input name="ownerName" className={inputCls} placeholder="Lena Koch" /></Field>
            <Field label="Owner email"><input name="ownerEmail" type="email" required className={inputCls} placeholder="lena@grandmarina.com" /></Field>
          </div>
          {/* The client's language: their guests' emails, the owner's invitation and the panel they
              open start in it. English is the base; a Bulgarian hotel is set to Bulgarian here. */}
          <Field label="Language (guests' emails and the owner's panel)">
            <select name="language" defaultValue="en" className={inputCls}>
              <option value="en">English</option>
              <option value="bg">Български</option>
            </select>
          </Field>
          {/* What kind of account — decided now, so a test hotel never sits among the business. */}
          <Field label="Account type" hint={TYPE_HINT[type]}>
            <select name="accountType" value={type} onChange={(e) => setType(e.target.value as AccountType)} className={inputCls}>
              {ACCOUNT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </Field>
          {type === "pilot" && (
            <Field label="Free until" hint="Pilots are not invoiced until this date. Three months if left empty.">
              <input name="freeUntil" type="date" min={todayInTimeZone("Europe/Sofia")} className={inputCls} />
            </Field>
          )}
          <Field label="Plan">
            <select name="plan" defaultValue="starter" className={inputCls}>
              <option value="starter">Starter (0–30 rooms)</option>
              <option value="growth">Growth (31–50 rooms)</option>
              <option value="scale">Scale (50–100+ rooms)</option>
            </select>
          </Field>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">Products (sold separately)</span>
            <div className="flex flex-wrap gap-2">
              {[["hasChannelManager", "RevioLink (CM)", true], ["hasReservation", "RevioCRS", false], ["hasPms", "RevioPMS", false]].map(([name, label, def]) => (
                <label key={name as string} className="flex cursor-pointer items-center gap-2 rounded-md border border-surface-border px-3 py-1.5 text-[12.5px] font-medium text-ink-600 hover:bg-surface-muted">
                  <input type="checkbox" name={name as string} defaultChecked={def as boolean} className="h-4 w-4 rounded border-surface-border text-brand-600" /> {label as string}
                </label>
              ))}
            </div>
          </div>

          {state?.error && (
            <div role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">
              {state.error}
              {state.link && (
                <Link href={state.link.href} onClick={() => setOpen(false)} className="mt-1.5 block font-semibold text-danger-700 underline underline-offset-2">
                  {state.link.label} →
                </Link>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? "Creating…" : "Create client"}</button>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}
