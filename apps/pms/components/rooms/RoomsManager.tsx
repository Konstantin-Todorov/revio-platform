"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Wand2, ChevronDown, SlidersHorizontal, Link2, TriangleAlert, History, Layers, Pencil, X } from "lucide-react";
import { StatusPill } from "@/components/ui/primitives";
import { HK_TONE, type HkStatus } from "@/lib/hk-meta";
import { fill } from "@revio/ui/i18n";
import type { RoomsStrings } from "@/lib/i18n/rooms";

/** Strings only (no functions cross to a client component); `{room}`/`{rooms}` are filled here. */
export type RoomsManagerStrings = {
  blocked: string; blockedBody: string; over: string; addRooms: string; noRooms: string;
  historyAria: string; historyTitle: string; editAria: string; deleteAria: string; deleteConfirm: string;
  roomName: string; floor: string; floorPlaceholder: string; roomPlaceholder: string; features: string;
  featureLabels: Record<string, string>; connecting: string; connectingNote: string; saveAttributes: string;
  cancel: string; connected: string; adding: string; addOne: string; prefix: string; none: string;
  start: string; howMany: string; generating: string; generate: string; generateNote: string;
  floors: RoomsStrings["floors"];
};
import { createUnit, generateUnits, deleteUnit, updateUnit, setUnitsFloor, removeFloor, renameFloor, reorderFloors } from "@/lib/actions-units";
import { SortableList } from "@revio/ui/sortable";

import { SubmitButton } from "@revio/ui/submit-button";
type Unit = { id: string; label: string; floor: string | null; hkStatus: HkStatus; features: string[]; connectingUnitIds: string[] };
/** `summary` ("12 rooms created · physical cap 12") is worded on the server — its plural depends on the count. */
type RoomType = { id: string; name: string; code: string; totalRooms: number; unitKind: string; units: Unit[]; summary: string };

const inputCls =
  "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600";

const FEATURES = ["quiet", "accessible", "view", "smoking"] as const;

function AttributesForm({ unit, allUnits, floors, onDone, t }: { unit: Unit; allUnits: { id: string; label: string }[]; floors: string[]; onDone: () => void; t: RoomsManagerStrings }) {
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
          <FloorSelect floors={floors} defaultValue={unit.floor ?? ""} t={t.floors} className="w-40" />
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

/** "Floor 1" for a bare number; a named floor ("Ground", "Annex") as the hotel typed it. */
function floorName(floor: string, t: RoomsStrings["floors"]): string {
  return /^\d+$/.test(floor) ? fill(t.numbered, { floor }) : floor;
}


/**
 * The one way to choose a floor, everywhere on this screen: the floors that exist, "No floor", and
 * "+ Add a floor…" — which swaps the list for a box to name a new one. A free-text field let "1",
 * "Floor 1" and "1st" become three floors; a list cannot.
 */
function FloorSelect({
  floors, defaultValue = "", t, className = "",
}: { floors: string[]; defaultValue?: string; t: RoomsStrings["floors"]; className?: string }) {
  const [adding, setAdding] = useState(false);
  if (adding) {
    return (
      <span className={`flex flex-col gap-0.5 ${className}`}>
        <input name="floor" autoFocus required placeholder={t.newFloorPlaceholder} className={`${inputCls} w-full`} />
        <button type="button" onClick={() => setAdding(false)} className="self-start text-[11px] font-semibold text-accent-600 hover:underline">
          {t.backToList}
        </button>
      </span>
    );
  }
  return (
    <select
      name="floor"
      defaultValue={defaultValue}
      onChange={(e) => { if (e.target.value === "__new") setAdding(true); }}
      className={`${inputCls} ${className}`}
    >
      <option value="">{t.noFloorOption}</option>
      {floors.map((f) => <option key={f} value={f}>{floorName(f, t)}</option>)}
      <option value="__new">{t.addFloorOption}</option>
    </select>
  );
}

/** One floor's row: its rooms, and the two things you can do to a floor — rename it, or remove it. */
function FloorRow({ floor, rooms, t, count, handle }: {
  floor: string; rooms: { id: string; label: string }[]; t: RoomsStrings["floors"]; count: (n: number) => string;
  /** The drag handle — the order floors appear in everywhere: here, the calendar, the housekeeping board. */
  handle: React.ReactNode;
}) {
  const [renaming, setRenaming] = useState(false);
  const name = floorName(floor, t);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 pl-2 pr-4">
      {handle}
      {renaming ? (
        <form action={async (fd) => { await renameFloor(fd); setRenaming(false); }} className="flex w-full items-center gap-2 sm:w-auto">
          <input type="hidden" name="floor" value={floor} />
          <input name="to" defaultValue={floor} autoFocus required aria-label={fill(t.renameAria, { floor: name })} className={`${inputCls} w-40`} />
          <SubmitButton pendingLabel={t.saving} className="inline-flex h-9 items-center rounded-md bg-accent-600 px-3 text-[12.5px] font-semibold text-white hover:bg-accent-500">
            {t.renameSave}
          </SubmitButton>
          <button type="button" onClick={() => setRenaming(false)} className="text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">{t.close}</button>
        </form>
      ) : (
        <span className="w-28 shrink-0 text-[13px] font-semibold text-ink-900">{name}</span>
      )}
      <span className="w-16 shrink-0 text-[11.5px] text-ink-400">{count(rooms.length)}</span>
      {/* On a phone the rooms take their own full-width line under the name, instead of a column. */}
      <span className="order-last flex min-w-0 basis-full flex-wrap gap-1 sm:order-none sm:flex-1 sm:basis-0">
        {rooms.map((u) => (
          <span key={u.id} className="rounded bg-surface-muted px-1.5 py-0.5 text-[11.5px] font-semibold text-ink-700">{u.label}</span>
        ))}
      </span>
      {!renaming && (
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setRenaming(true)}
            aria-label={fill(t.renameAria, { floor: name })}
            title={t.rename}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-ink-700"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <form action={removeFloor}>
            <input type="hidden" name="floor" value={floor} />
            <button
              type="submit"
              aria-label={fill(t.removeAria, { floor: name })}
              title={fill(t.removeAria, { floor: name })}
              onClick={(e) => {
                if (!confirm(fill(t.removeConfirm, { floor: name, rooms: rooms.map((r) => r.label).join(", ") }))) e.preventDefault();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
            >
              <X className="h-4 w-4" />
            </button>
          </form>
        </span>
      )}
    </div>
  );
}

/**
 * Floors, made visible.
 *
 * A floor is not its own record — it is what the rooms on it say — so until now the screen had no
 * place that showed floors at all, and the only way to give a room one was its own edit panel. The
 * founder could not find how to add a floor, which is the whole finding: a thing that exists only
 * inside forty edit panels does not exist for the person looking. This card lists each floor with
 * its rooms, the rooms with none, and one form to put many rooms on a floor at once.
 */
function FloorsPanel({ units, floors, t }: { units: (Unit & { typeName: string })[]; floors: string[]; t: RoomsStrings["floors"] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const byFloor = new Map<string, (Unit & { typeName: string })[]>();
  for (const u of units) {
    const k = u.floor?.trim() ?? "";
    byFloor.set(k, [...(byFloor.get(k) ?? []), u]);
  }
  const unassigned = byFloor.get("") ?? [];
  const count = (n: number) => (n === 1 ? t.roomsOne : fill(t.roomsMany, { n }));
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <section className="rounded-lg border border-surface-border bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-[14px] font-bold tracking-tight text-ink-900">
            <Layers className="h-4 w-4 text-ink-400" /> {t.title}
          </h2>
          <p className="mt-0.5 text-[11.5px] text-ink-500">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
        >
          {open ? t.close : t.arrange}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      <ul className="divide-y divide-surface-border/70">
        {floors.length === 0 && (
          <li className="px-4 py-3 text-[12.5px] text-ink-500">{t.empty}</li>
        )}
        {floors.length > 0 && (
          <li>
            <SortableList
              items={floors.map((f) => ({ id: f }))}
              className="divide-y divide-surface-border/70"
              handleLabel={(f) => fill(t.dragAria, { floor: floorName(f.id, t) })}
              onReorder={(order) => reorderFloors(order)}
              render={(f, handle) => <FloorRow floor={f.id} rooms={byFloor.get(f.id) ?? []} t={t} count={count} handle={handle} />}
            />
          </li>
        )}
        {unassigned.length > 0 && (
          <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-warning-50/50 py-2.5 pl-11 pr-4">
            <span className="w-28 shrink-0 text-[13px] font-semibold text-warning-700">{t.noFloor}</span>
            <span className="w-16 shrink-0 text-[11.5px] text-ink-400">{count(unassigned.length)}</span>
            <span className="flex min-w-0 basis-full flex-wrap gap-1 sm:flex-1 sm:basis-0">
              {unassigned.map((u) => (
                <span key={u.id} className="rounded bg-white px-1.5 py-0.5 text-[11.5px] font-semibold text-ink-700">{u.label}</span>
              ))}
            </span>
          </li>
        )}
      </ul>


      {open && (
        <form
          action={async (fd) => { await setUnitsFloor(fd); setPicked(new Set()); }}
          className="space-y-3 border-t border-surface-border bg-surface-muted px-4 py-3"
        >
          <label className="flex max-w-sm flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-600">{t.whichFloor}</span>
            <FloorSelect floors={floors} t={t} className="w-full" />
            <span className="text-[11px] text-ink-400">{t.whichFloorHint}</span>
          </label>

          <div>
            <div className="mb-1.5 flex items-center gap-3">
              <span className="text-[11px] font-semibold text-ink-600">{t.whichRooms}</span>
              <button type="button" onClick={() => setPicked(new Set(units.map((u) => u.id)))} className="text-[11.5px] font-semibold text-accent-600 hover:underline">{t.selectAll}</button>
              <button type="button" onClick={() => setPicked(new Set())} className="text-[11.5px] font-semibold text-ink-500 hover:underline">{t.selectNone}</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {units.map((u) => {
                const on = picked.has(u.id);
                return (
                  <label
                    key={u.id}
                    title={`${u.typeName}${u.floor ? ` · ${floorName(u.floor, t)}` : ""}`}
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-semibold transition-colors ${
                      on ? "border-accent-600 bg-accent-50 text-accent-700" : "border-surface-border bg-white text-ink-700 hover:bg-surface-muted"
                    }`}
                  >
                    <input type="checkbox" name="unitIds" value={u.id} checked={on} onChange={() => toggle(u.id)} className="sr-only" />
                    {u.label}
                  </label>
                );
              })}
            </div>
          </div>

          <SubmitButton
            disabled={picked.size === 0}
            pendingLabel={t.saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-500 disabled:opacity-50"
          >
            {t.save}{picked.size > 0 ? ` · ${count(picked.size)}` : ""}
          </SubmitButton>
        </form>
      )}
    </section>
  );
}

export function RoomsManager({ roomTypes, allUnits, floorOrder, blocked, t, statuses }: { roomTypes: RoomType[]; allUnits: { id: string; label: string }[]; floorOrder: string[]; blocked?: string; t: RoomsManagerStrings; statuses: Record<HkStatus, string> }) {
  const [openAdd, setOpenAdd] = useState<string | null>(null);
  const [openEdit, setOpenEdit] = useState<string | null>(null);
  const labelById = new Map(allUnits.map((u) => [u.id, u.label]));
  const allUnitsFull = roomTypes.flatMap((rt) => rt.units.map((u) => ({ ...u, typeName: rt.name })));
  // The hotel's order, worked out on the server (`orderFloors`) — the same one the calendar uses.
  const floorList = floorOrder;

  return (
    <div className="space-y-4">
      {blocked && (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning-500/50 bg-warning-50 p-3.5 text-[13px] text-ink-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          <span><span className="font-semibold text-warning-700">{fill(t.blocked, { room: blocked })}</span> {t.blockedBody}</span>
        </div>
      )}
      {allUnitsFull.length > 0 && <FloorsPanel units={allUnitsFull} floors={floorList} t={t.floors} />}
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
                          {u.floor && <div className="mt-0.5 text-[10.5px] text-ink-400">{floorName(u.floor, t.floors)}</div>}
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
                      {editing && <AttributesForm unit={u} allUnits={allUnits} floors={floorList} onDone={() => setOpenEdit(null)} t={t} />}
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
                    <FloorSelect floors={floorList} t={t.floors} className="w-40" />
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
                    <FloorSelect floors={floorList} t={t.floors} className="w-40" />
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
