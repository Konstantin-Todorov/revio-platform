"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { applyCrsBulkUpdate, type ActionResult } from "@/lib/actions-rates";

type Opt = { id: string; name: string };
type PlanOpt = { id: string; name: string; priceLogic: string; parentName: string | null };
const DOW = [["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]] as const;

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400";

/** Bulk Rates & Availability (spec §3.7): one operation sets rate, restrictions and open/close
 * across a date range. Only MANUAL rates are price-editable; derived recalc from their parent. */
export function CrsBulkForm({ roomTypes, ratePlans, today }: { roomTypes: Opt[]; ratePlans: PlanOpt[]; today: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(applyCrsBulkUpdate, null);
  const [updateType, setUpdateType] = useState("rate_set");
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const isRate = updateType.startsWith("rate_");
  const needsValue = isRate || updateType === "minlos_set" || updateType === "availability_set";

  return (
    <form action={formAction} className="grid grid-cols-1 gap-5 p-4 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>From</label><input name="dateFrom" type="date" defaultValue={today} className={inputCls} required /></div>
          <div><label className={labelCls}>To</label><input name="dateTo" type="date" defaultValue={in30} className={inputCls} required /></div>
        </div>

        <div>
          <span className={labelCls}>Days of week (all when none picked)</span>
          <div className="flex flex-wrap gap-1.5">
            {DOW.map(([v, label]) => (
              <label key={v} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-medium text-ink-600 hover:bg-surface-muted">
                <input type="checkbox" name="daysOfWeek" value={v} className="h-3.5 w-3.5 rounded border-surface-border text-brand-600" />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className={labelCls}>Room types</span>
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
        <div>
          <label className={labelCls}>Update</label>
          <select name="updateType" value={updateType} onChange={(e) => setUpdateType(e.target.value)} className={inputCls}>
            <optgroup label="Rate (manual plans only)">
              <option value="rate_set">Set exact price (€)</option>
              <option value="rate_inc_pct">Increase by %</option>
              <option value="rate_dec_pct">Decrease by %</option>
            </optgroup>
            <optgroup label="Availability & restrictions">
              <option value="availability_set">Set rooms to sell</option>
              <option value="minlos_set">Set minimum stay</option>
              <option value="close">Close (stop sell) — dates go off sale</option>
              <option value="open">Open — dates return to sale</option>
            </optgroup>
          </select>
        </div>

        {needsValue && (
          <div>
            <label className={labelCls}>Value</label>
            <input name="value" type="number" step="0.01" defaultValue={130} className={inputCls} />
          </div>
        )}

        {isRate && (
          <div>
            <span className={labelCls}>Rate plans (manual only — derived follow their parent)</span>
            <div className="grid grid-cols-2 gap-1.5">
              {ratePlans.map((rp) =>
                rp.priceLogic === "manual" ? (
                  <label key={rp.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-surface-border px-2.5 py-1.5 text-[12.5px] font-medium text-ink-600 hover:bg-surface-muted">
                    <input type="checkbox" name="ratePlanIds" value={rp.id} defaultChecked className="h-3.5 w-3.5 rounded border-surface-border text-brand-600" />
                    {rp.name}
                  </label>
                ) : (
                  <span key={rp.id} title={`Derived from ${rp.parentName ?? "its parent"} — edit the parent`} className="flex cursor-not-allowed items-center gap-2 rounded-md border border-dashed border-surface-border px-2.5 py-1.5 text-[12.5px] text-ink-300">
                    <span className="h-3.5 w-3.5 rounded border border-surface-border bg-surface-muted" />
                    {rp.name} <span className="text-[10px] uppercase">derived</span>
                  </span>
                ),
              )}
            </div>
          </div>
        )}

        {state?.ok && (
          <p className="flex items-center gap-2 rounded-md bg-success-50 px-3 py-2 text-[12.5px] font-semibold text-success-600">
            <CheckCircle2 className="h-4 w-4" /> Applied — one audit entry, one push to the connected CM.
          </p>
        )}
        {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

        <button type="submit" disabled={pending} className="w-full rounded-md bg-brand-800 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
          {pending ? "Applying…" : "Preview & apply"}
        </button>
      </div>
    </form>
  );
}
