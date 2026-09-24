"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Wand2, ChevronDown, SlidersHorizontal, Link2, TriangleAlert, History, Layers } from "lucide-react";
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
import { createUnit, generateUnits, deleteUnit, updateUnit, setUnitsFloor } from "@/lib/actions-units";

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
          <input name="floor" list="revio-floors" defaultValue={unit.floor ?? ""} placeholder={t.floorPlaceholder} className={`${inputCls} w-28`} />
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
 * Floors, made visible.
 *
 * A floor is not its own record — it is what the rooms on it say — so until now the screen had no
 * place that showed floors at all, and the only way to give a room one was its own edit panel. The
 * founder could not find how to add a floor, which is the whole finding: a thing that exists only
 * inside forty edit panels does not exist for the person looking. This card lists each floor with
 * its rooms, the rooms with none, and one form to put many rooms on a floor at once.
 */
function FloorsPanel({ units, t }: { units: (Unit & { typeName: string })[]; t: RoomsStrings["floors"] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const byFloor = new Map<string, (Unit & { typeName: string })[]>();
  for (const u of units) {
    const k = u.floor ?? "";
    byFloor.set(k, [...(byFloor.get(k) ?? []), u]);
  }
  const floors = [...byFloor.keys()].filter((k) => k !== "").sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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
        {floors.map((f) => {
          const rooms = byFloor.get(f)!;
          return (
            <li key={f} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
              <span className="w-28 shrink-0 text-[13px] font-semibold text-ink-900">{floorName(f, t)}</span>
              <span className="w-16 shrink-0 text-[11.5px] text-ink-400">{count(rooms.length)}</span>
              <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                {rooms.map((u) => (
                  <span key={u.id} className="rounded bg-surface-muted px-1.5 py-0.5 text-[11.5px] font-semibold text-ink-700">{u.label}</span>
                ))}
              </span>
            </li>
          );
        })}
        {unassigned.length > 0 && (
          <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-warning-50/50 px-4 py-2.5">
            <span className="w-28 shrink-0 text-[13px] font-semibold text-warning-700">{t.noFloor}</span>
            <span className="w-16 shrink-0 text-[11.5px] text-ink-400">{count(unassigned.length)}</span>
            <span className="flex min-w-0 flex-1 flex-wrap gap-1">
              {unassigned.map((u) => (
                <span key={u.id} className="rounded bg-white px-1.5 py-0.5 text-[11.5px] font-semibold text-ink-700">{u.label}</span>
              ))}
            </span>
          </li>
        )}
      </ul>

      {/* Always rendered: every "Floor" field on this screen suggests the floors that already exist, so
          "1", "Floor 1" and "1st" do not become three floors. */}
      <datalist id="revio-floors">
        {floors.map((f) => <option key={f} value={f}>{floorName(f, t)}</option>)}
      </datalist>

      {open && (
        <form
          action={async (fd) => { await setUnitsFloor(fd); setPicked(new Set()); }}
          className="space-y-3 border-t border-surface-border bg-surface-muted px-4 py-3"
        >
          <label className="flex max-w-sm flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-600">{t.whichFloor}</span>
            <input name="floor" list="revio-floors" placeholder={t.whichFloorPlaceholder} className={`${inputCls} w-full`} />
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

export function RoomsManager({ roomTypes, allUnits, blocked, t, statuses }: { roomTypes: RoomType[]; allUnits: { id: string; label: string }[]; blocked?: string; t: RoomsManagerStrings; statuses: Record<HkStatus, string> }) {
  const [openAdd, setOpenAdd] = useState<string | null>(null);
  const [openEdit, setOpenEdit] = useState<string | null>(null);
  const labelById = new Map(allUnits.map((u) => [u.id, u.label]));
  const allUnitsFull = roomTypes.flatMap((rt) => rt.units.map((u) => ({ ...u, typeName: rt.name })));

  return (
    <div className="space-y-4">
      {blocked && (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning-500/50 bg-warning-50 p-3.5 text-[13px] text-ink-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          <span><span className="font-semibold text-warning-700">{fill(t.blocked, { room: blocked })}</span> {t.blockedBody}</span>
        </div>
      )}
      {allUnitsFull.length > 0 && <FloorsPanel units={allUnitsFull} t={t.floors} />}
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
                    <input name="floor" list="revio-floors" placeholder={t.floorPlaceholder} className={`${inputCls} w-32`} />
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
                    <input name="floor" list="revio-floors" placeholder={t.floorPlaceholder} className={`${inputCls} w-28`} />
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
