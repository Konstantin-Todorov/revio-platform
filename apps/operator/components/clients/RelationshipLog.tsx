"use client";

import { useActionState, useEffect, useRef } from "react";
import { AlertTriangle, Flag, Mail, Phone, Pin, PinOff, Receipt, StickyNote, Trash2, Users } from "lucide-react";
import { addNote, toggleNotePin, deleteNote, type ActionResult } from "@/lib/actions-crm";
import { NOTE_KINDS, NOTE_LABEL, type NoteKind } from "@/lib/account";
import { Card, CardHeader } from "@/components/ui/primitives";
import { inputCls } from "@/components/ui/Modal";
import { DateField } from "@revio/ui/date-field";

export interface LogItem {
  id: string;
  /** ISO string — deliberately not a Date. Everything crossing into a client component is a value. */
  at: string;
  kind: string;
  title: string;
  detail?: string;
  author?: string;
  pinned?: boolean;
}

/** Entries the platform derived. They are history, not something anyone can pin or delete. */
const DERIVED = new Set(["milestone", "invoice"]);

const ICON: Record<string, typeof Phone> = {
  call: Phone, email: Mail, meeting: Users, note: StickyNote, issue: AlertTriangle,
  milestone: Flag, invoice: Receipt,
};
const ICON_TONE: Record<string, string> = {
  call: "bg-accent-50 text-accent-600",
  email: "bg-accent-50 text-accent-600",
  meeting: "bg-accent-50 text-accent-600",
  note: "bg-surface-sunken text-ink-500",
  issue: "bg-danger-50 text-danger-600",
  milestone: "bg-success-50 text-success-600",
  invoice: "bg-surface-sunken text-ink-500",
};

function when(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * What was said, and when — the third question asked at the moment someone picks up the phone.
 *
 * Two decisions worth stating. The compose box is **always open**, not behind a modal: logging a call
 * has to cost two clicks or it does not get done, and a CRM whose log is empty is worse than none
 * because it looks authoritative. And the log **merges what we wrote with what the platform already
 * knew** — created, first booking, invoices — so a client has a history the first time this page is
 * opened rather than starting blank on the day the feature shipped.
 */
export function RelationshipLog({ tenantId, items }: { tenantId: string; items: LogItem[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(addNote, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) form.current?.reset(); }, [state]);

  const pinned = items.filter((i) => i.pinned);
  const rest = items.filter((i) => !i.pinned);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader title="Relationship log" />

      <form ref={form} action={formAction} className="space-y-2.5 border-b border-surface-border bg-surface-muted/40 px-4 py-3.5">
        <div className="flex flex-wrap gap-2">
          <select name="kind" defaultValue="call" className={`${inputCls} w-auto min-w-[110px]`}>
            {NOTE_KINDS.map((k) => <option key={k} value={k}>{NOTE_LABEL[k as NoteKind]}</option>)}
          </select>
          {/* A call logged on Monday for a call made on Friday belongs on Friday. */}
          <DateField name="occurredAt" defaultValue={today} max={today} className={`${inputCls} w-auto`} />
        </div>
        <input type="hidden" name="tenantId" value={tenantId} />
        <textarea
          name="body"
          rows={2}
          required
          placeholder="Spoke to Maria — happy with sync, asked about a second property in the spring."
          className="w-full rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600"
        />
        <div className="flex items-center justify-between gap-2">
          {state?.error ? <span className="text-[12px] font-medium text-danger-600">{state.error}</span> : <span />}
          <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
            {pending ? "Logging…" : "Log it"}
          </button>
        </div>
      </form>

      {pinned.length > 0 && (
        <div className="border-b border-surface-border bg-warning-50/40">
          <ul className="divide-y divide-surface-border/60">
            {pinned.map((i) => <Entry key={i.id} item={i} tenantId={tenantId} />)}
          </ul>
        </div>
      )}

      {rest.length === 0 ? (
        <p className="px-4 py-5 text-[13px] text-ink-500">Nothing logged yet.</p>
      ) : (
        <ul className="max-h-[26rem] divide-y divide-surface-border/60 overflow-y-auto">
          {rest.map((i) => <Entry key={i.id} item={i} tenantId={tenantId} />)}
        </ul>
      )}
    </Card>
  );
}

function Entry({ item, tenantId }: { item: LogItem; tenantId: string }) {
  const Icon = ICON[item.kind] ?? StickyNote;
  const derived = DERIVED.has(item.kind);

  return (
    <li className="group flex items-start gap-3 px-4 py-2.5">
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${ICON_TONE[item.kind] ?? "bg-surface-sunken text-ink-500"}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-snug text-ink-800">{item.title}</span>
        {item.detail && <span className="mt-0.5 block text-[11.5px] text-ink-500">{item.detail}</span>}
        <span className="mt-0.5 block text-[11px] text-ink-400">
          {when(item.at)}
          {item.author && ` · ${item.author}`}
          {derived && " · automatic"}
        </span>
      </span>
      {!derived && (
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <form action={toggleNotePin}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="tenantId" value={tenantId} />
            <button aria-label={item.pinned ? "Unpin" : "Pin"} className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-surface-muted hover:text-ink-700">
              {item.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
          </form>
          <form action={deleteNote}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="tenantId" value={tenantId} />
            <button aria-label="Delete entry" className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
        </span>
      )}
    </li>
  );
}
