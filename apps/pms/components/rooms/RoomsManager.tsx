"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Wand2, ChevronDown, SlidersHorizontal, Link2, TriangleAlert, History } from "lucide-react";
import { StatusPill } from "@/components/ui/primitives";
import { HK_TONE, type HkStatus } from "@/lib/hk-meta";
import { fill } from "@revio/ui/i18n";

/** Strings only (no functions cross to a client component); `{room}`/`{rooms}` are filled here. */
export type RoomsManagerStrings = {
  blocked: string; blockedBody: string; over: string; addRooms: string; noRooms: string;
  historyAria: string; historyTitle: string; editAria: string; deleteAria: string; deleteConfirm: string;
  roomName: string; floor: string; floorPlaceholder: string; roomPlaceholder: string; features: string;
  featureLabels: Record<string, string>; connecting: string; connectingNote: string; saveAttributes: string;
  cancel: string; connected: string; adding: string; addOne: string; prefix: string; none: string;
  start: string; howMany: string; generating: string; generate: string; generateNote: string;
};
import { createUnit, generateUnits, deleteUnit, updateUnit } from "@/lib/actions-units";

import { SubmitButton } from "@revio/ui/submit-button";
type Unit = { id: string; label: string; floor: string | null; hkStatus: HkStatus; features: string[]; connectingUnitIds: string[] };
/** `summary` ("12 rooms created · physical cap 12") is worded on the server — its plural depends on the count. */
type RoomType = { id: string; name: string; code: string; totalRooms: number; unitKind: string; units: Unit[]; summary: string };

const inputCls =
  "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600";

const FEATURES = ["quiet", "accessible", "view", "smoking"] as const;

function AttributesForm({ unit, allUnits, onDone, t }: { unit: Unit; allUnits: { id: string; label: string }[]; onDone: () => void; t: RoomsManagerStrings }) {
  const labelById = new Map(allUnits.map((u) => [u.id, u.label]));
  return (
    <form action={updateUnit} onSubmit={onDone} className="space-y-3 border-t border-surface-border bg-surface-muted px-3 py-3">
      <input type="hidden" name="unitId" value={unit.id} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-ink-600">{t.roomName}</span>
          <input name="label" defaultValue={unit.label} className={`${inputCls} w-28`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-ink-600">{t.floor}</span>
          <input name="floor" defaultValue={unit.floor ?? ""} placeholder={t.floorPlaceholder} className={`${inputCls} w-28`} />
        </label>
      </div>
      <div>
        <span className="text-[11px] font-semibold text-ink-600">{t.features}</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {FEATURES.map((f) => (
            <label key={f} className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-2 py-1 text-[12px] text-ink-700">
              <input type="checkbox" name="features" value={f} defaultChecked={unit.features.includes(f)} className="accent-accent-600" />
              {t.featureLabels[f] ?? f}
            </label>
          ))}
        </div>
      </div>
      <div>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-600"><Link2 className="h-3 w-3" /> {t.connecting}</span>
        <select multiple name="connecting" defaultValue={unit.connectingUnitIds} className="mt-1 h-24 w-full rounded-md border border-surface-border bg-white px-2 py-1 text-[12.5px] outline-none focus:border-accent-600">
          {allUnits.filter((u) => u.id !== unit.id).map((u) => (
            <option key={u.id} value={u.id}>{u.label}</option>
          ))}
        </select>
        <p className="mt-1 text-[10.5px] text-ink-400">{t.connectingNote}</p>
      </div>
      <div className="flex items-center gap-2">
        <button className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12.5px] font-semibold text-white hover:bg-accent-500">{t.saveAttributes}</button>
        <button type="button" onClick={onDone} className="text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">{t.cancel}</button>
        {unit.connectingUnitIds.length > 0 && (
          <span className="ml-auto text-[11px] text-ink-400">{fill(t.connected, { rooms: unit.connectingUnitIds.map((id) => labelById.get(id) ?? "?").join(", ") })}</span>
        )}
      </div>
    </form>
  );
}

export function RoomsManager({ roomTypes, allUnits, blocked, t, statuses }: { roomTypes: RoomType[]; allUnits: { id: string; label: string }[]; blocked?: string; t: RoomsManagerStrings; statuses: Record<HkStatus, string> }) {
  const [openAdd, setOpenAdd] = useState<string | null>(null);
  const [openEdit, setOpenEdit] = useState<string | null>(null);
  const labelById = new Map(allUnits.map((u) => [u.id, u.label]));

  return (
    <div className="space-y-4">
      {blocked && (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning-500/50 bg-warning-50 p-3.5 text-[13px] text-ink-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          <span><span className="font-semibold text-warning-700">{fill(t.blocked, { room: blocked })}</span> {t.blockedBody}</span>
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
                  {rt.summary}
                  {over && <span className="ml-1 font-semibold text-warning-600">{t.over}</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenAdd(isOpen ? null : rt.id)}
                className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
              >
                <Plus className="h-3.5 w-3.5" /> {t.addRooms}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Units */}
            {created === 0 ? (
              <div className="px-4 py-5 text-center text-[12.5px] text-ink-400">{t.noRooms}</div>
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
                            <StatusPill tone={HK_TONE[u.hkStatus]}>{statuses[u.hkStatus]}</StatusPill>
                          </div>
                          {u.floor && <div className="mt-0.5 text-[10.5px] text-ink-400">{u.floor}</div>}
                          {(u.features.length > 0 || u.connectingUnitIds.length > 0) && (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {u.features.map((f) => (
                                <span key={f} className="rounded bg-accent-50 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-accent-700">{t.featureLabels[f] ?? f}</span>
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
                            aria-label={fill(t.historyAria, { room: u.label })}
                            title={t.historyTitle}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-surface-muted hover:text-ink-600"
                          >
                            <History className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setOpenEdit(editing ? null : u.id)}
                            aria-label={fill(t.editAria, { room: u.label })}
                            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${editing ? "bg-accent-50 text-accent-600" : "text-ink-300 hover:bg-surface-muted hover:text-ink-600"}`}
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                          </button>
                          <form action={deleteUnit}>
                            <input type="hidden" name="unitId" value={u.id} />
                            <button
                              type="submit"
                              aria-label={fill(t.deleteAria, { room: u.label })}
                              onClick={(e) => { if (!confirm(fill(t.deleteConfirm, { room: u.label }))) e.preventDefault(); }}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-danger-50 hover:text-danger-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </form>
                        </div>
                      </div>
                      {editing && <AttributesForm unit={u} allUnits={allUnits} onDone={() => setOpenEdit(null)} t={t} />}
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
                    <span className="text-[11px] font-semibold text-ink-600">{t.roomName}</span>
                    <input name="label" required placeholder={t.roomPlaceholder} className={`${inputCls} w-32`} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-ink-600">{t.floor}</span>
                    <input name="floor" placeholder={t.floorPlaceholder} className={`${inputCls} w-32`} />
                  </label>
                  <SubmitButton className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-500" pendingLabel={t.adding}>
                    <Plus className="h-3.5 w-3.5" /> {t.addOne}
                  </SubmitButton>
                </form>

                {/* Bulk */}
                <form action={generateUnits} className="flex flex-wrap items-end gap-2 border-t border-surface-border pt-3">
                  <input type="hidden" name="roomTypeId" value={rt.id} />
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-ink-600">{t.prefix}</span>
                    <input name="prefix" placeholder={t.none} className={`${inputCls} w-24`} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-ink-600">{t.start}</span>
                    <input name="start" type="number" min={1} defaultValue={101} className={`${inputCls} w-20`} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-ink-600">{t.howMany}</span>
                    <input name="count" type="number" min={1} max={200} defaultValue={10} className={`${inputCls} w-20`} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-ink-600">{t.floor}</span>
                    <input name="floor" placeholder={t.floorPlaceholder} className={`${inputCls} w-28`} />
                  </label>
                  <SubmitButton className="inline-flex h-9 items-center gap-1.5 rounded-md border border-accent-500 px-3 text-[12.5px] font-semibold text-accent-600 transition-colors hover:bg-accent-50" pendingLabel={t.generating}>
                    <Wand2 className="h-3.5 w-3.5" /> {t.generate}
                  </SubmitButton>
                </form>
                <p className="text-[11px] text-ink-400">{t.generateNote}</p>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
