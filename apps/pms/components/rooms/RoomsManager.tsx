"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Wand2, ChevronDown, SlidersHorizontal, Link2, TriangleAlert, History } from "lucide-react";
import { StatusPill } from "@/components/ui/primitives";
import { HK_LABEL, HK_TONE, type HkStatus } from "@/lib/hk-meta";
import { createUnit, generateUnits, deleteUnit, updateUnit } from "@/lib/actions-units";

type Unit = { id: string; label: string; floor: string | null; hkStatus: HkStatus; features: string[]; connectingUnitIds: string[] };
type RoomType = { id: string; name: string; code: string; totalRooms: number; unitKind: string; units: Unit[] };

const inputCls =
  "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600";

const FEATURES: { id: string; label: string }[] = [
  { id: "quiet", label: "Quiet" }, { id: "accessible", label: "Accessible" },
  { id: "view", label: "View" }, { id: "smoking", label: "Smoking" },
];

function AttributesForm({ unit, allUnits, onDone }: { unit: Unit; allUnits: { id: string; label: string }[]; onDone: () => void }) {
  const labelById = new Map(allUnits.map((u) => [u.id, u.label]));
  return (
    <form action={updateUnit} onSubmit={onDone} className="space-y-3 border-t border-surface-border bg-surface-muted px-3 py-3">
      <input type="hidden" name="unitId" value={unit.id} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-ink-600">Room number / name</span>
          <input name="label" defaultValue={unit.label} className={`${inputCls} w-28`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-ink-600">Floor / zone</span>
          <input name="floor" defaultValue={unit.floor ?? ""} placeholder="Floor 1" className={`${inputCls} w-28`} />
        </label>
      </div>
      <div>
        <span className="text-[11px] font-semibold text-ink-600">Features</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {FEATURES.map((f) => (
            <label key={f.id} className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-2 py-1 text-[12px] text-ink-700">
              <input type="checkbox" name="features" value={f.id} defaultChecked={unit.features.includes(f.id)} className="accent-accent-600" />
              {f.label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-600"><Link2 className="h-3 w-3" /> Connecting rooms</span>
        <select multiple name="connecting" defaultValue={unit.connectingUnitIds} className="mt-1 h-24 w-full rounded-md border border-surface-border bg-white px-2 py-1 text-[12.5px] outline-none focus:border-accent-600">
          {allUnits.filter((u) => u.id !== unit.id).map((u) => (
            <option key={u.id} value={u.id}>{u.label}</option>
          ))}
        </select>
        <p className="mt-1 text-[10.5px] text-ink-400">Cmd/Ctrl-click to select multiple. Links stay two-way and feed the one-room-in-progress rule + family/group assignment.</p>
      </div>
      <div className="flex items-center gap-2">
        <button className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12.5px] font-semibold text-white hover:bg-accent-500">Save attributes</button>
        <button type="button" onClick={onDone} className="text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">Cancel</button>
        {unit.connectingUnitIds.length > 0 && (
          <span className="ml-auto text-[11px] text-ink-400">Connected: {unit.connectingUnitIds.map((id) => labelById.get(id) ?? "?").join(", ")}</span>
        )}
      </div>
    </form>
  );
}

export function RoomsManager({ roomTypes, allUnits, blocked }: { roomTypes: RoomType[]; allUnits: { id: string; label: string }[]; blocked?: string }) {
  const [openAdd, setOpenAdd] = useState<string | null>(null);
  const [openEdit, setOpenEdit] = useState<string | null>(null);
  const labelById = new Map(allUnits.map((u) => [u.id, u.label]));

  return (
    <div className="space-y-4">
      {blocked && (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning-500/50 bg-warning-50 p-3.5 text-[13px] text-ink-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          <span><span className="font-semibold text-warning-700">Room {blocked} can’t be deleted.</span> It’s occupied or assigned to a current/future stay — check the guest out or reassign the stay first.</span>
        </div>
      )}
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
              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {rt.units.map((u) => {
                  const editing = openEdit === u.id;
                  return (
                    <div key={u.id} className="overflow-hidden rounded-md border border-surface-border">
                      <div className="flex items-start justify-between gap-2 px-2.5 py-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] font-bold text-ink-900">{u.label}</span>
                            <StatusPill tone={HK_TONE[u.hkStatus]}>{HK_LABEL[u.hkStatus]}</StatusPill>
                          </div>
                          {u.floor && <div className="mt-0.5 text-[10.5px] text-ink-400">{u.floor}</div>}
                          {(u.features.length > 0 || u.connectingUnitIds.length > 0) && (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {u.features.map((f) => (
                                <span key={f} className="rounded bg-accent-50 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-accent-700">{f}</span>
                              ))}
                              {u.connectingUnitIds.length > 0 && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-brand-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-brand-700">
                                  <Link2 className="h-2.5 w-2.5" /> {u.connectingUnitIds.map((id) => labelById.get(id) ?? "?").join(", ")}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Link
                            href={`/rooms/${u.id}`}
                            aria-label={`Lifecycle history for room ${u.label}`}
                            title="Room lifecycle timeline"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-surface-muted hover:text-ink-600"
                          >
                            <History className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setOpenEdit(editing ? null : u.id)}
                            aria-label={`Edit attributes for room ${u.label}`}
                            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${editing ? "bg-accent-50 text-accent-600" : "text-ink-300 hover:bg-surface-muted hover:text-ink-600"}`}
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                          </button>
                          <form action={deleteUnit}>
                            <input type="hidden" name="unitId" value={u.id} />
                            <button
                              type="submit"
                              aria-label={`Delete room ${u.label}`}
                              onClick={(e) => { if (!confirm(`Delete room ${u.label}? Blocked if it’s occupied or assigned to a stay.`)) e.preventDefault(); }}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-danger-50 hover:text-danger-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </form>
                        </div>
                      </div>
                      {editing && <AttributesForm unit={u} allUnits={allUnits} onDone={() => setOpenEdit(null)} />}
                    </div>
                  );
                })}
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
