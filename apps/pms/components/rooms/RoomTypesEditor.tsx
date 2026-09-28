"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@revio/ui/action-form";
import { SubmitButton } from "@revio/ui/submit-button";
import { addRoomType, removeRoomType, updateRoomType, type RoomTypeResult } from "@/lib/actions-roomtypes";

export type RoomTypesEditorStrings = {
  title: string;
  lead: string;
  name: string;
  namePlaceholder: string;
  count: string;
  guests: string;
  save: string;
  saving: string;
  add: string;
  adding: string;
  remove: string;
  /** Already filled per row — a client component takes no functions. */
  removeConfirm: Record<string, string>;
  removeNote: string;
  inactive: string;
  saved: string;
};

type Row = { id: string; name: string; totalRooms: number; maxGuests: number; active: boolean };

const input =
  "h-9 w-full rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100";

/**
 * The room types a RevioPMS-only hotel sells — a small table it can edit in place.
 *
 * Shaped like a spreadsheet row per type (name · rooms · guests · save) because that is what the
 * thing is: three numbers about a kind of room. The physical doors below hang off these rows.
 */
export function RoomTypesEditor({ rows, t }: { rows: Row[]; t: RoomTypesEditorStrings }) {
  return (
    <section className="mb-5 rounded-xl border border-surface-border bg-white p-4 sm:p-5">
      <h2 className="text-[14px] font-semibold text-ink-900">{t.title}</h2>
      <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-ink-500">{t.lead}</p>
      <div className="mt-3 hidden grid-cols-[1fr_6rem_6rem_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400 sm:grid">
        <span>{t.name}</span><span>{t.count}</span><span>{t.guests}</span><span />
      </div>
      <ul className="mt-1 space-y-2">
        {rows.map((r) => <TypeRow key={r.id} row={r} t={t} />)}
      </ul>
      <AddRow t={t} />
    </section>
  );
}

function TypeRow({ row, t }: { row: Row; t: RoomTypesEditorStrings }) {
  const [state, action] = useActionState<RoomTypeResult | null, FormData>(updateRoomType, null);
  const [confirming, setConfirming] = useState(false);
  return (
    <li>
      <ActionForm action={action} state={state} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_6rem_6rem_auto]">
        <input type="hidden" name="id" value={row.id} />
        <label className="col-span-2 sm:col-span-1">
          <span className="sr-only sm:hidden">{t.name}</span>
          <span className="mb-1 block text-[11px] font-semibold text-ink-500 sm:hidden">{t.name}</span>
          <input name="name" defaultValue={row.name} required className={input} />
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold text-ink-500 sm:hidden">{t.count}</span>
          <input name="totalRooms" type="number" min={1} defaultValue={row.totalRooms} required className={input} aria-label={t.count} />
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold text-ink-500 sm:hidden">{t.guests}</span>
          <input name="maxGuests" type="number" min={1} defaultValue={row.maxGuests} required className={input} aria-label={t.guests} />
        </label>
        <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
          <SubmitButton pendingLabel={t.saving} className="inline-flex h-9 items-center rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white hover:bg-brand-700">
            {t.save}
          </SubmitButton>
          <button type="button" onClick={() => setConfirming(true)} className="h-9 rounded-md px-2 text-[12.5px] font-semibold text-danger-600 hover:bg-danger-50">
            {t.remove}
          </button>
          {!row.active && <span className="text-[11.5px] text-ink-400">{t.inactive}</span>}
        </div>
      </ActionForm>
      {state?.error && <p role="alert" className="mt-1 text-[12.5px] text-danger-600">{state.error}</p>}
      {state?.ok && <p className="mt-1 text-[12px] text-success-700">{t.saved}</p>}
      {confirming && (
        <form action={removeRoomType} className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-[12.5px] text-danger-700">
          <input type="hidden" name="id" value={row.id} />
          <span className="font-semibold">{t.removeConfirm[row.id]}</span>
          <span className="text-danger-700">{t.removeNote}</span>
          <SubmitButton pendingLabel={t.saving} className="ml-auto h-8 rounded-md bg-danger-600 px-3 font-semibold text-white hover:bg-danger-500">
            {t.remove}
          </SubmitButton>
          <button type="button" onClick={() => setConfirming(false)} className="h-8 rounded-md px-2 font-semibold text-ink-600 hover:bg-white">×</button>
        </form>
      )}
    </li>
  );
}

function AddRow({ t }: { t: RoomTypesEditorStrings }) {
  const [state, action] = useActionState<RoomTypeResult | null, FormData>(addRoomType, null);
  return (
    <div className="mt-3 border-t border-surface-border pt-3">
      <ActionForm action={action} state={state} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_6rem_6rem_auto]">
        <input name="name" placeholder={t.namePlaceholder} required aria-label={t.name} className={`${input} col-span-2 sm:col-span-1`} />
        <input name="totalRooms" type="number" min={1} placeholder={t.count} required aria-label={t.count} className={input} />
        <input name="maxGuests" type="number" min={1} placeholder={t.guests} required aria-label={t.guests} className={input} />
        <SubmitButton pendingLabel={t.adding} className="col-span-2 inline-flex h-9 items-center justify-center rounded-md border border-surface-border px-3 text-[12.5px] font-semibold text-ink-700 hover:bg-surface-muted sm:col-span-1">
          {t.add}
        </SubmitButton>
      </ActionForm>
      {state?.error && <p role="alert" className="mt-1 text-[12.5px] text-danger-600">{state.error}</p>}
    </div>
  );
}
