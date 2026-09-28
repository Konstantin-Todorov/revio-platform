"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  ACCOUNT_TYPES, CLOSE_REASONS, SUSPEND_REASONS, earliestSelectable, todayInTimeZone, type AccountType, type LifecycleAction,
} from "@revio/core";

/** A free period is agreed in our office's day, and only ever ends in the future. */
const OFFICE_TZ = "Europe/Sofia";
import { ActionForm } from "@revio/ui/action-form";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/primitives";
import { AccountTypeChip } from "./AccountTypeChip";
import { DangerZone } from "./DangerZone";
import {
  changeBillingAction, changeProductsAction, changeStatusAction, changeTypeAction, type LifecycleFormResult,
} from "@/lib/actions-lifecycle";

/**
 * The top of a client's page: who they are, what they have, whether they are all right, what they
 * owe — and every consequential change, each in a dialog that asks why.
 *
 * Borrowed from Stripe's customer page and Salesforce's highlights panel: the facts that decide
 * what you do next sit in one band that never scrolls away, and the commands live in one place on
 * the record rather than scattered through the page (and never in a list row).
 */
export interface ClientHeaderProps {
  tenantId: string;
  name: string;
  subtitle: string;
  accountType: AccountType;
  status: { value: string; label: string; tone: "success" | "warning" | "danger" | "neutral"; detail?: string; reason: string | null };
  next: { action: LifecycleAction; label: string }[];
  billing: { mode: string; label: string; freeUntil: string | null; note: string | null };
  products: { field: "channelManager" | "reservation" | "pms"; name: string; on: boolean; trial: string | null }[];
  owes: { label: string; detail: string; tone: "success" | "warning" | "danger" | "neutral" };
  health: { label: string; detail: string; tone: "success" | "warning" | "danger" | "neutral" };
  channels: { connected: number; live: number };
  deletion: null | {
    tenantName: string;
    counts: { reservations: number; properties: number; users: number; taxInvoices: number };
    blocked?: { reason: string; instead: string };
    warning?: string;
    keepsInvoices?: number;
  };
}

type Open = null | { kind: "status"; action: LifecycleAction } | { kind: "products" } | { kind: "type" } | { kind: "billing" } | { kind: "delete" };

export function ClientHeader(p: ClientHeaderProps) {
  const [open, setOpen] = useState<Open>(null);
  const [menu, setMenu] = useState(false);
  const close = () => setOpen(null);

  return (
    <header className="overflow-hidden rounded-xl border border-surface-border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 bg-brand-900 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[20px] font-bold tracking-tight text-white">{p.name}</h1>
            <AccountTypeChip type={p.accountType} showLive />
          </div>
          <p className="mt-0.5 text-[12.5px] text-white/65">{p.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {p.next.map((n, i) => (
            <button
              key={n.action}
              type="button"
              onClick={() => setOpen({ kind: "status", action: n.action })}
              className={
                i === 0 && (n.action === "reinstate" || n.action === "reopen")
                  ? "h-9 rounded-md bg-white px-3.5 text-[13px] font-semibold text-brand-900 hover:bg-white/90"
                  : "h-9 rounded-md border border-white/30 px-3.5 text-[13px] font-semibold text-white hover:bg-white/10"
              }
            >
              {n.label}
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menu}
              onClick={() => setMenu((m) => !m)}
              className="flex h-9 items-center gap-1.5 rounded-md border border-white/30 px-3 text-[13px] font-semibold text-white hover:bg-white/10"
            >
              <MoreHorizontal className="h-4 w-4" /> More
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-surface-border bg-white py-1 shadow-pop">
                {[
                  { k: "products" as const, label: "Change products…" },
                  { k: "type" as const, label: "Change account type…" },
                  { k: "billing" as const, label: "Change billing…" },
                  ...(p.deletion ? [{ k: "delete" as const, label: "Delete client…" }] : []),
                ].map((m) => (
                  <button
                    key={m.k}
                    role="menuitem"
                    type="button"
                    onClick={() => { setMenu(false); setOpen({ kind: m.k }); }}
                    className={`block w-full px-3.5 py-2 text-left text-[13px] hover:bg-surface-muted ${m.k === "delete" ? "text-danger-700" : "text-ink-800"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* The four facts. Each cell is the answer, then the one line that says why. */}
      <dl className="grid grid-cols-1 divide-y divide-surface-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        <Fact term="Status">
          <StatusPill tone={p.status.tone}>{p.status.label}</StatusPill>
          {p.status.reason && <small className="font-semibold !text-ink-700">“{p.status.reason}”</small>}
          <small>{p.status.detail ?? (p.status.reason ? null : "Signed in and working normally.")}</small>
        </Fact>
        <Fact term="Products">
          <span className="flex flex-wrap gap-1">
            {p.products.filter((x) => x.on).length === 0 && <span className="text-[13px] text-ink-400">None</span>}
            {p.products.filter((x) => x.on).map((x) => (
              <span key={x.field} className="rounded bg-surface-muted px-1.5 py-0.5 text-[12px] font-semibold text-ink-700">
                {x.name}{x.trial && <span className="font-normal text-warning-600"> · {x.trial}</span>}
              </span>
            ))}
          </span>
          <small>{p.channels.connected} channel{p.channels.connected === 1 ? "" : "s"} connected</small>
        </Fact>
        <Fact term="Billing">
          <span className="text-[14px] font-semibold text-ink-900">{p.billing.label}</span>
          <small>{p.billing.note ?? "No note."}</small>
        </Fact>
        <Fact term="Owes · Health">
          <span className="flex flex-wrap gap-1.5">
            <StatusPill tone={p.owes.tone}>{p.owes.label}</StatusPill>
            <StatusPill tone={p.health.tone}>{p.health.label}</StatusPill>
          </span>
          <small>{p.owes.detail} · {p.health.detail}</small>
        </Fact>
      </dl>

      {open?.kind === "status" && <StatusDialog {...p} action={open.action} onClose={close} />}
      {open?.kind === "products" && <ProductsDialog {...p} onClose={close} />}
      {open?.kind === "type" && <TypeDialog {...p} onClose={close} />}
      {open?.kind === "billing" && <BillingDialog {...p} onClose={close} />}
      {open?.kind === "delete" && p.deletion && (
        <Modal open onClose={close} title={`Delete ${p.name}`}>
          <DangerZone
            tenantId={p.tenantId}
            tenantName={p.deletion.tenantName}
            counts={p.deletion.counts}
            {...(p.deletion.blocked ? { blocked: p.deletion.blocked } : {})}
            {...(p.deletion.warning ? { warning: p.deletion.warning } : {})}
            {...(p.deletion.keepsInvoices ? { keepsInvoices: p.deletion.keepsInvoices } : {})}
          />
        </Modal>
      )}
    </header>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-3.5 [&_small]:text-[11.5px] [&_small]:leading-snug [&_small]:text-ink-500">
      <dt className="text-[10.5px] font-bold uppercase tracking-wider text-ink-400">{term}</dt>
      <dd className="flex flex-col gap-1.5">{children}</dd>
    </div>
  );
}

/** Shared tail of every dialog: the refusal beside the fields, and the two buttons. */
function useDialog(action: (s: LifecycleFormResult | null, fd: FormData) => Promise<LifecycleFormResult>, onClose: () => void) {
  const [state, formAction, pending] = useActionState<LifecycleFormResult | null, FormData>(action, null);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  return { state, formAction, pending };
}

function Footer({ state, pending, onClose, label, danger }: { state: LifecycleFormResult | null; pending: boolean; onClose: () => void; label: string; danger?: boolean }) {
  return (
    <>
      {state?.error && <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-700">{state.error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="h-9 rounded-md border border-surface-border px-3.5 text-[13px] font-semibold text-ink-600 hover:bg-surface-muted">Cancel</button>
        <button
          type="submit"
          disabled={pending}
          className={`h-9 rounded-md px-3.5 text-[13px] font-semibold text-white disabled:opacity-60 ${danger ? "bg-danger-600 hover:bg-danger-700" : "bg-brand-800 hover:bg-brand-700"}`}
        >
          {pending ? "Saving…" : label}
        </button>
      </div>
    </>
  );
}

const STATUS_COPY: Record<LifecycleAction, { title: string; body: string; button: string; reasons?: readonly string[]; danger?: boolean }> = {
  suspend: {
    title: "Suspend",
    body: "Nobody at the hotel can sign in. Nothing is deleted and their products are kept exactly as they are — Reinstate brings everything back in one click.",
    button: "Suspend client",
    reasons: SUSPEND_REASONS,
    danger: true,
  },
  reinstate: { title: "Reinstate", body: "Sign-in works again, with every product and setting exactly as it was before the suspension.", button: "Reinstate client" },
  close: {
    title: "Close",
    body: "For a client who has left. Sign-in stops, their channels are disconnected, any trial ends and unsent invoice drafts are removed. Their data is kept for 90 days and they can be reopened until then; after that the client can be deleted. Sent invoices stay collectable.",
    button: "Close client",
    reasons: CLOSE_REASONS,
    danger: true,
  },
  reopen: { title: "Reopen", body: "They can sign in again. Channels stay disconnected until someone reconnects them on the Channels tab.", button: "Reopen client" },
};

function StatusDialog(p: ClientHeaderProps & { action: LifecycleAction; onClose: () => void }) {
  const { state, formAction, pending } = useDialog(changeStatusAction, p.onClose);
  const copy = STATUS_COPY[p.action];
  const [reason, setReason] = useState<string>(copy.reasons?.[0] ?? "");
  return (
    <Modal open onClose={p.onClose} title={`${copy.title} ${p.name}`}>
      <ActionForm action={formAction} state={state} className="space-y-3.5">
        <input type="hidden" name="tenantId" value={p.tenantId} />
        <input type="hidden" name="action" value={p.action} />
        <p className="text-[13px] leading-relaxed text-ink-600">{copy.body}</p>
        {copy.reasons ? (
          <Field label="Why">
            <select name="reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
              {copy.reasons.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        ) : null}
        <Field label={reason === "Other" ? "Reason" : "Note (optional)"}>
          <input name="reasonDetail" required={reason === "Other"} className={inputCls} placeholder={reason === "Other" ? "What happened" : "Anything the next person should know"} />
        </Field>
        {p.action === "suspend" && p.channels.connected > 0 && (
          <label className="flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 px-3 py-2.5 text-[12.5px] text-warning-800">
            <input type="checkbox" name="pauseChannels" defaultChecked className="mt-0.5 h-4 w-4" />
            <span>
              <b>Also pause their {p.channels.connected} connected channel{p.channels.connected === 1 ? "" : "s"}.</b> Suspending stops us collecting their bookings,
              but their rooms stay on sale at the OTA — a guest could book a room nobody at the hotel can see. Pausing stop-sells them.
            </span>
          </label>
        )}
        {p.action === "close" && p.channels.live > 0 && (
          <label className="flex items-start gap-2 rounded-md border border-danger-200 bg-danger-50 px-3 py-2.5 text-[12.5px] text-danger-700">
            <input type="checkbox" name="disconnectChannels" required className="mt-0.5 h-4 w-4" />
            <span>
              <b>Disconnect every channel ({p.channels.live}).</b> Required: a closed client must not stay on sale, and Channex bills us for every property with a live channel.
            </span>
          </label>
        )}
        <Footer state={state} pending={pending} onClose={p.onClose} label={copy.button} {...(copy.danger ? { danger: true } : {})} />
      </ActionForm>
    </Modal>
  );
}

function ProductsDialog(p: ClientHeaderProps & { onClose: () => void }) {
  const { state, formAction, pending } = useDialog(changeProductsAction, p.onClose);
  return (
    <Modal open onClose={p.onClose} title={`Products for ${p.name}`}>
      <ActionForm action={formAction} state={state} className="space-y-3.5">
        <input type="hidden" name="tenantId" value={p.tenantId} />
        <p className="text-[13px] leading-relaxed text-ink-600">
          Switching a product off stops them opening it; their data stays, because every product shares it. The owner is emailed about each change.
          To stop a hotel altogether, suspend or close it instead — that keeps their products for when they come back.
        </p>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-[12px] font-semibold text-ink-700">They can open</legend>
          {p.products.map((x) => (
            <label key={x.field} className="flex items-center gap-2.5 rounded-md border border-surface-border px-3 py-2 text-[13px] text-ink-800">
              <input type="checkbox" name={x.field} defaultChecked={x.on} className="h-4 w-4" />
              <span className="font-semibold">{x.name}</span>
              {x.trial && <span className="text-[12px] text-warning-600">{x.trial} — end it on the Setup tab</span>}
            </label>
          ))}
        </fieldset>
        <Field label="Why">
          <input name="reason" required className={inputCls} placeholder="e.g. Bought RevioPMS on the 3 October call" />
        </Field>
        <Footer state={state} pending={pending} onClose={p.onClose} label="Save products" />
      </ActionForm>
    </Modal>
  );
}

function TypeDialog(p: ClientHeaderProps & { onClose: () => void }) {
  const { state, formAction, pending } = useDialog(changeTypeAction, p.onClose);
  const [type, setType] = useState<AccountType>(p.accountType);
  return (
    <Modal open onClose={p.onClose} title={`Account type for ${p.name}`}>
      <ActionForm action={formAction} state={state} className="space-y-3.5">
        <input type="hidden" name="tenantId" value={p.tenantId} />
        <fieldset className="space-y-2">
          {ACCOUNT_TYPES.map((t) => (
            <label key={t.key} className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 ${type === t.key ? "border-brand-600 bg-brand-50" : "border-surface-border"}`}>
              <input type="radio" name="type" value={t.key} checked={type === t.key} onChange={() => setType(t.key)} className="mt-0.5 h-4 w-4" />
              <span>
                <span className="block text-[13px] font-semibold text-ink-900">{t.label}</span>
                <span className="block text-[12px] text-ink-500">{t.blurb}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {type === "pilot" && (
          <Field label="Free until" hint="Three months from today if left empty.">
            <input name="freeUntil" type="date" min={todayInTimeZone(OFFICE_TZ)} className={inputCls} />
          </Field>
        )}
        <p className="text-[12px] text-ink-500">Billing moves to what the new type starts on (paying · free · not billed); change it afterwards from Change billing.</p>
        <Field label="Why">
          <input name="reason" required className={inputCls} placeholder="e.g. Real hotel, testing with us until the end of the year" />
        </Field>
        <Footer state={state} pending={pending} onClose={p.onClose} label="Change type" />
      </ActionForm>
    </Modal>
  );
}

function BillingDialog(p: ClientHeaderProps & { onClose: () => void }) {
  const { state, formAction, pending } = useDialog(changeBillingAction, p.onClose);
  const [mode, setMode] = useState(p.billing.mode);
  return (
    <Modal open onClose={p.onClose} title={`Billing for ${p.name}`}>
      <ActionForm action={formAction} state={state} className="space-y-3.5">
        <input type="hidden" name="tenantId" value={p.tenantId} />
        <fieldset className="space-y-2">
          {[
            { k: "paying", l: "Paying", d: "Invoiced every month from their plan and products." },
            { k: "free", l: "Free until a date", d: "Not invoiced until the date; the first month on or after it is billed." },
            { k: "none", l: "Not billed", d: "Never invoiced. For our own accounts, or an agreement written down in the note." },
          ].map((o) => (
            <label key={o.k} className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 ${mode === o.k ? "border-brand-600 bg-brand-50" : "border-surface-border"}`}>
              <input type="radio" name="mode" value={o.k} checked={mode === o.k} onChange={() => setMode(o.k)} className="mt-0.5 h-4 w-4" />
              <span>
                <span className="block text-[13px] font-semibold text-ink-900">{o.l}</span>
                <span className="block text-[12px] text-ink-500">{o.d}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {mode === "free" && (
          <Field label="Free until">
            <input
              name="freeUntil" type="date" required defaultValue={p.billing.freeUntil ?? ""}
              min={earliestSelectable(todayInTimeZone(OFFICE_TZ), p.billing.freeUntil)} className={inputCls}
            />
          </Field>
        )}
        <Field label="Why · who agreed it">
          <input name="note" required defaultValue={p.billing.note ?? ""} className={inputCls} placeholder="e.g. Pilot agreed with the owner on 28 September" />
        </Field>
        <p className="text-[12px] text-ink-500">Unsent drafts are removed when a client stops paying. Sent and paid invoices are never changed.</p>
        <Footer state={state} pending={pending} onClose={p.onClose} label="Save billing" />
      </ActionForm>
    </Modal>
  );
}
