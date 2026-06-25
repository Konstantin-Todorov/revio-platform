"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { applyBulkUpdate, type ActionResult } from "@/lib/actions-calendar";
import { Field, inputCls } from "@/components/ui/Modal";

type Opt = { id: string; name: string; code: string };
const DOW = [["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]];

export function BulkUpdateForm({ roomTypes, today }: { roomTypes: Opt[]; today: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(applyBulkUpdate, null);
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  return (
    <form action={formAction} className="rounded-lg border border-surface-border bg-white p-5 shadow-card">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="From"><input name="dateFrom" type="date" defaultValue={today} className={inputCls} required /></Field>
            <Field label="To"><input name="dateTo" type="date" defaultValue={in30} className={inputCls} required /></Field>
          </div>

          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">Days of week</span>
            <div className="flex flex-wrap gap-1.5">
              {DOW.map(([v, label]) => (
                <label key={v} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-medium text-ink-600 hover:bg-surface-muted">
                  <input type="checkbox" name="daysOfWeek" value={v} className="h-3.5 w-3.5 rounded border-surface-border text-brand-600" />
                  {label}
                </label>
              ))}
            </div>
            <span className="mt-1 block text-[11px] text-ink-400">Leave all unchecked to apply to every day.</span>
          </div>

          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">Room types</span>
            <div className="grid grid-cols-2 gap-1.5">
              {roomTypes.map((rt) => (
                <label key={rt.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-surface-border px-2.5 py-1.5 text-[12.5px] font-medium text-ink-600 hover:bg-surface-muted">
                  <input type="checkbox" name="roomTypeIds" value={rt.id} defaultChecked className="h-3.5 w-3.5 rounded border-surface-border text-brand-600" />
                  {rt.name}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Field label="Update type">
            <select name="updateType" defaultValue="rate_set" className={inputCls}>
              <optgroup label="Rate">
                <option value="rate_set">Set exact price (€)</option>
                <option value="rate_inc_pct">Increase by %</option>
                <option value="rate_dec_pct">Decrease by %</option>
                <option value="rate_inc_amt">Increase by amount (€)</option>
                <option value="rate_dec_amt">Decrease by amount (€)</option>
              </optgroup>
              <optgroup label="Availability & restrictions">
                <option value="availability_set">Set availability</option>
                <option value="minlos_set">Set Min LOS</option>
                <option value="stopsell_on">Stop sell — ON</option>
                <option value="stopsell_off">Stop sell — OFF</option>
              </optgroup>
            </select>
          </Field>
          <Field label="Value" hint="Price in €, percent, or a whole number. Ignored for stop-sell on/off.">
            <input name="value" type="number" step="0.01" defaultValue={130} className={inputCls} />
          </Field>

          <div className="rounded-md bg-surface-muted p-3 text-[12px] text-ink-500">
            Bulk changes are applied to the <span className="font-semibold text-ink-700">Standard Rate</span> /
            availability and propagate to derived rates automatically. Each run is one Audit entry + one push.
          </div>

          {state?.ok && (
            <div className="flex items-center gap-2 rounded-md bg-success-50 px-3 py-2.5 text-[13px] font-semibold text-success-600">
              <CheckCircle2 className="h-4 w-4" /> Applied to {state.affected} cells and pushed to channels.
            </div>
          )}
          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

          <button type="submit" disabled={pending} className="w-full rounded-md bg-brand-800 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
            {pending ? "Applying…" : "Preview & apply"}
          </button>
        </div>
      </div>
    </form>
  );
}
