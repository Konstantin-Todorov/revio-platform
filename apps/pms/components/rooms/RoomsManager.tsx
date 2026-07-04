"use client";

import { useState } from "react";
import { Plus, Trash2, Wand2, ChevronDown } from "lucide-react";
import { StatusPill } from "@/components/ui/primitives";
import { HK_LABEL, HK_TONE, type HkStatus } from "@/lib/hk-meta";
import { createUnit, generateUnits, deleteUnit } from "@/lib/actions-units";

type Unit = { id: string; label: string; floor: string | null; hkStatus: HkStatus };
type RoomType = { id: string; name: string; code: string; totalRooms: number; unitKind: string; units: Unit[] };

const inputCls =
  "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600";

export function RoomsManager({ roomTypes }: { roomTypes: RoomType[] }) {
  const [openAdd, setOpenAdd] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {roomTypes.map((rt) => {
        const created = rt.units.length;
        const over = created > rt.totalRooms;
        const isOpen = openAdd === rt.id;
        return (
          <section key={rt.id} className="rounded-lg border border-surface-border bg-white shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
              <div>
                <h2 className="text-[14px] font-bold tracking-tight text-ink-900">{rt.name}</h2>
                <p className="mt-0.5 text-[11.5px] text-ink-500">
                  {created} {rt.unitKind === "bed" ? "bed" : "room"}{created === 1 ? "" : "s"} created ·
                  physical cap {rt.totalRooms}
                  {over && <span className="ml-1 font-semibold text-warning-600">· over physical count</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenAdd(isOpen ? null : rt.id)}
                className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
              >
                <Plus className="h-3.5 w-3.5" /> Add rooms
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Units */}
            {created === 0 ? (
              <div className="px-4 py-5 text-center text-[12.5px] text-ink-400">No rooms yet — use “Add rooms”.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
                {rt.units.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-2 rounded-md border border-surface-border px-2.5 py-2">
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-bold text-ink-900">{u.label}</div>
                      <div className="mt-0.5"><StatusPill tone={HK_TONE[u.hkStatus]}>{HK_LABEL[u.hkStatus]}</StatusPill></div>
                      {u.floor && <div className="mt-0.5 text-[10.5px] text-ink-400">{u.floor}</div>}
                    </div>
                    <form action={deleteUnit}>
                      <input type="hidden" name="unitId" value={u.id} />
                      <button
                        type="submit"
                        aria-label={`Delete room ${u.label}`}
                        onClick={(e) => { if (!confirm(`Delete room ${u.label}? This also returns it to sale if it was out of order.`)) e.preventDefault(); }}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-danger-50 hover:text-danger-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            {/* Add / Generate */}
            {isOpen && (
              <div className="space-y-3 border-t border-surface-border bg-surface-muted px-4 py-3">
                {/* Single */}
                <form action={createUnit} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="roomTypeId" value={rt.id} />
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-ink-600">Room number / name</span>
                    <input name="label" required placeholder="e.g. 101" className={`${inputCls} w-32`} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-ink-600">Floor / zone</span>
                    <input name="floor" placeholder="Floor 1" className={`${inputCls} w-32`} />
                  </label>
                  <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-500">
                    <Plus className="h-3.5 w-3.5" /> Add one
                  </button>
                </form>

                {/* Bulk */}
                <form action={generateUnits} className="flex flex-wrap items-end gap-2 border-t border-surface-border pt-3">
                  <input type="hidden" name="roomTypeId" value={rt.id} />
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-ink-600">Prefix</span>
                    <input name="prefix" placeholder="(none)" className={`${inputCls} w-24`} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-ink-600">Start #</span>
                    <input name="start" type="number" defaultValue={101} className={`${inputCls} w-20`} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-ink-600">How many</span>
                    <input name="count" type="number" min={1} max={200} defaultValue={10} className={`${inputCls} w-20`} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-ink-600">Floor / zone</span>
                    <input name="floor" placeholder="Floor 1" className={`${inputCls} w-28`} />
                  </label>
                  <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-accent-500 px-3 text-[12.5px] font-semibold text-accent-600 transition-colors hover:bg-accent-50">
                    <Wand2 className="h-3.5 w-3.5" /> Generate
                  </button>
                </form>
                <p className="text-[11px] text-ink-400">Generate makes numbered rooms (e.g. prefix “A”, start 101, 10 rooms → A101…A110).</p>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
