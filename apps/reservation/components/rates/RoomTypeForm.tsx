"use client";

import { useActionState, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { BED_SETUPS, ROOM_AMENITIES, ROOM_AMENITY_GROUPS } from "@revio/core";
import { AmenityIcon } from "@revio/ui/amenity-icon";
import { Card, CardHeader } from "@revio/ui/primitives";
import { saveRoomType, type ActionResult } from "@/lib/actions-rates";
import { Field, inputCls } from "@/components/ui/Modal";

export type RoomTypeValues = {
  id: string; name: string; code: string; unitKind: string;
  totalRooms: number; maxGuests: number; defaultOccupancy: number | null; description: string | null; active: boolean;
  sizeSqm: number | null; bedSetup: string | null; amenities: string[];
};

/**
 * The fields of a room type — one set, used by the "Add room type" dialog and by the room's own page,
 * so the two can never ask different questions. Split in two halves on purpose: what the hotel SELLS
 * (the basics) and what a GUEST READS (all optional, improved later).
 */
export function RoomTypeBasicsFields({ roomType }: { roomType?: RoomTypeValues }) {
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name"><input name="name" defaultValue={roomType?.name} required className={inputCls} placeholder="Deluxe Double Room" /></Field>
        <Field label="Code" hint="Short internal reference"><input name="code" defaultValue={roomType?.code} required className={inputCls} placeholder="DDR" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Unit kind">
          <select name="unitKind" defaultValue={roomType?.unitKind ?? "room"} className={inputCls}>
            <option value="room">Room</option>
            <option value="apartment">Apartment</option>
            <option value="bed">Bed (hostel)</option>
          </select>
        </Field>
        <Field label="Physical count" hint="The cap & safety net"><input name="totalRooms" type="number" min={0} defaultValue={roomType?.totalRooms ?? 0} className={inputCls} /></Field>
        <Field label="Max guests"><input name="maxGuests" type="number" min={1} defaultValue={roomType?.maxGuests ?? 2} className={inputCls} /></Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Normally sold to" hint="Guests in a typical booking — the party size a per-person price is quoted at. Blank uses the max.">
          <input name="defaultOccupancy" type="number" min={1} defaultValue={roomType?.defaultOccupancy ?? ""} className={inputCls} placeholder="—" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
        <input type="checkbox" name="active" defaultChecked={roomType?.active ?? true} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Active (sellable)
      </label>
    </div>
  );
}

export function RoomTypeGuestFields({ roomType }: { roomType?: RoomTypeValues }) {
  return (
    <div className="space-y-3.5">
      <Field label="Description" hint="A sentence or two, in your guests' own words">
        <textarea
          name="description"
          defaultValue={roomType?.description ?? ""}
          rows={3}
          className={`${inputCls} resize-y`}
          placeholder="A quiet corner room with a private balcony over the courtyard…"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Room size" hint="Square metres">
          <input name="sizeSqm" type="number" min={0} max={2000} defaultValue={roomType?.sizeSqm ?? ""} className={inputCls} placeholder="e.g. 24" />
        </Field>
        <Field label="Beds">
          <select name="bedSetup" defaultValue={roomType?.bedSetup ?? ""} className={inputCls}>
            <option value="">Not specified</option>
            {BED_SETUPS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
          </select>
        </Field>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-semibold text-ink-700">Amenities</div>
        {/*
          Toggle chips with icons, not a column of tick boxes: thirty-five checkboxes is a wall of
          near-identical rows, and a chip that visibly fills in shows what is on without tracing a
          line back to a small square. The real <input> is still there under `sr-only` — the form
          posts the same field, and it stays keyboard-reachable and readable by a screen reader.
        */}
        <div className="space-y-2.5">
          {ROOM_AMENITY_GROUPS.map((g) => (
            <div key={g.key}>
              <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-400">{g.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {ROOM_AMENITIES.filter((a) => a.group === g.key).map((a) => (
                  <label key={a.key} className="cursor-pointer">
                    <input
                      type="checkbox"
                      name="amenities"
                      value={a.key}
                      defaultChecked={roomType?.amenities?.includes(a.key) ?? false}
                      className="peer sr-only"
                    />
                    <span className="flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-2.5 py-1 text-[12px] text-ink-500 transition-colors hover:border-ink-300 peer-checked:border-product-ink peer-checked:bg-product-wash peer-checked:font-semibold peer-checked:text-product-ink peer-focus-visible:ring-2 peer-focus-visible:ring-product-ink/40">
                      <AmenityIcon name={a.icon} size={13} />
                      {a.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A room type edited on its own page: the basics and what a guest reads, as two cards of ONE form.
 * One form because `saveRoomType` writes every field at once — two forms would each post the other
 * half's defaults and quietly undo an edit made in it.
 */
export function RoomTypeEditor({ roomType }: { roomType: RoomTypeValues }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveRoomType, null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => { if (state?.ok) setSavedAt(Date.now()); }, [state]);

  return (
    <form action={formAction} onChange={() => setSavedAt(null)} className="space-y-5">
      <input type="hidden" name="id" value={roomType.id} />
      <Card>
        <CardHeader title="The basics" subtitle="What you sell and how many of it exist — the physical count is the cap every channel sells under" />
        <div className="px-5 pb-5"><RoomTypeBasicsFields roomType={roomType} /></div>
      </Card>
      <Card>
        <CardHeader title="What a guest reads" subtitle="Shown on your booking page. All optional — a room with none of this still sells, it just says less" />
        <div className="px-5 pb-5"><RoomTypeGuestFields roomType={roomType} /></div>
      </Card>

      {/* Sticky, so saving is in reach after the thirty-five amenity chips. */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 rounded-lg border border-surface-border bg-white/95 px-4 py-3 shadow-card backdrop-blur">
        {state?.error && <p className="mr-auto text-[12.5px] font-medium text-danger-600">{state.error}</p>}
        {savedAt && !state?.error && (
          <p className="mr-auto inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-success-600"><Check className="h-4 w-4" /> Saved</p>
        )}
        <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
