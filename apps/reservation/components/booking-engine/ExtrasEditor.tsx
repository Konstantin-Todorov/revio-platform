"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveBookingExtra, retireBookingExtra, type LookResult } from "@/lib/actions-booking-engine";

export interface EditableExtra {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  basis: string;
  directSellable: boolean;
}

/**
 * What the hotel sells alongside the room.
 *
 * The same catalogue RevioPMS posts at the front desk — one list, so a breakfast the desk charges
 * €12 for is never €10 on the booking page. This editor exists because a hotel on RevioCRS alone has
 * no PMS screen to reach it, and should not have to buy a second product to sell breakfast.
 *
 * **"Sell on my booking page" is the opt-in, and it is off by default.** A hotel's catalogue holds
 * staff-only lines — a corkage fee, a lost-key charge — and the safe default for "who can see this"
 * is nobody new.
 */
export function ExtrasEditor({ extras, currency }: { extras: EditableExtra[]; currency: string }) {
  const [state, formAction, pending] = useActionState<LookResult | null, FormData>(saveBookingExtra, null);
  const [adding, setAdding] = useState(false);

  const money = (minor: number) =>
    (minor / 100).toLocaleString(undefined, { style: "currency", currency });

  return (
    <div className="space-y-3">
      {extras.length === 0 && !adding && (
        <p className="text-[12.5px] text-ink-500">
          Nothing yet. Breakfast, parking, an airport transfer, a late checkout — anything you already
          charge for is worth offering while a guest is booking.
        </p>
      )}

      {extras.length > 0 && (
        <ul className="divide-y divide-surface-border rounded-md border border-surface-border">
          {extras.map((e) => (
            <li key={e.id} className="px-3.5 py-2.5">
              <ExtraRow extra={e} money={money} formAction={formAction} pending={pending} currency={currency} />
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form action={formAction} className="rounded-md border border-surface-border bg-surface-muted/40 p-3.5">
          <ExtraFields currency={currency} />
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)}
                    className="rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-600">
              Cancel
            </button>
            <button type="submit" disabled={pending}
                    className="rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-60">
              {pending ? "Saving…" : "Add extra"}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
          <Plus className="h-3.5 w-3.5" /> Add an extra
        </button>
      )}

      {state?.error && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-[12px] font-medium text-danger-600">{state.error}</p>
      )}
    </div>
  );
}

/** One catalogue line: readable at a glance, editable in place. */
function ExtraRow({
  extra, money, formAction, pending, currency,
}: {
  extra: EditableExtra;
  money: (m: number) => string;
  formAction: (fd: FormData) => void;
  pending: boolean;
  currency: string;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <form action={formAction}>
        <input type="hidden" name="id" value={extra.id} />
        <ExtraFields currency={currency} extra={extra} />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)}
                  className="rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-600">
            Cancel
          </button>
          <button type="submit" disabled={pending}
                  className="rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-60">
            Save
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={() => setOpen(true)} className="min-w-0 text-left">
        <span className="text-[13px] font-semibold text-ink-900">{extra.name}</span>
        <span className="ml-2 text-[12.5px] text-ink-500">
          {money(extra.priceMinor)}
          {extra.basis === "per_night" ? " a night" : " per stay"}
        </span>
        {extra.description && (
          <span className="mt-0.5 block text-[12px] text-ink-400">{extra.description}</span>
        )}
      </button>
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            extra.directSellable ? "bg-success-50 text-success-600" : "bg-surface-muted text-ink-500"
          }`}
        >
          {extra.directSellable ? "On your page" : "Staff only"}
        </span>
        <form action={retireBookingExtra.bind(null, extra.id)}>
          <button type="submit" aria-label={`Retire ${extra.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-danger-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

const INPUT =
  "h-9 w-full rounded-md border border-surface-border bg-white px-3 text-[13px] text-ink-900 outline-none focus:border-brand-600";

function ExtraFields({ currency, extra }: { currency: string; extra?: EditableExtra }) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_8rem_9rem]">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-700">Name</span>
          <input name="name" defaultValue={extra?.name} required placeholder="Breakfast" className={INPUT} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-700">Price ({currency})</span>
          <input name="price" defaultValue={extra ? (extra.priceMinor / 100).toFixed(2) : ""}
                 inputMode="decimal" required placeholder="12.00" className={INPUT} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-700">Charged</span>
          <select name="basis" defaultValue={extra?.basis ?? "per_stay"} className={INPUT}>
            <option value="per_stay">Once per stay</option>
            <option value="per_night">Per night</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-[11.5px] font-semibold text-ink-700">
          One line for guests <span className="font-normal text-ink-400">· optional</span>
        </span>
        <input name="description" defaultValue={extra?.description ?? ""}
               placeholder="Served 7–10:30 in the courtyard" className={INPUT} />
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-ink-700">
        <input type="checkbox" name="directSellable" defaultChecked={extra?.directSellable ?? false}
               className="h-4 w-4 rounded border-surface-border text-brand-600" />
        Sell this on my booking page
      </label>
    </div>
  );
}
