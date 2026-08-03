"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { BED_SETUPS, ROOM_AMENITIES, ROOM_AMENITY_GROUPS } from "@revio/core";
import { AmenityIcon } from "@revio/ui/amenity-icon";
import { saveRoomType, type ActionResult } from "@/lib/actions-rates";
import { Modal, Field, inputCls } from "@/components/ui/Modal";

type RoomType = {
  id: string; name: string; code: string; unitKind: string;
  totalRooms: number; maxGuests: number; description: string | null; active: boolean;
  sizeSqm: number | null; bedSetup: string | null; amenities: string[];
};

/** Create/edit a room type from the CRS — the same shared record RevioLink edits. A CRS-only hotel
 *  has no other place to define what it sells. */
export function RoomTypeDialog({ roomType }: { roomType?: RoomType }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveRoomType, null);
  const isEdit = !!roomType;

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      {isEdit ? (
        <button onClick={() => setOpen(true)} aria-label="Edit room type" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-brand-600">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Add Room Type
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={isEdit ? `Edit ${roomType!.name}` : "Add Room Type"}>
        <form action={formAction} className="space-y-3.5">
          {isEdit && <input type="hidden" name="id" value={roomType!.id} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input name="name" defaultValue={roomType?.name} required className={inputCls} placeholder="Deluxe Double Room" /></Field>
            <Field label="Code" hint="Short internal reference"><input name="code" defaultValue={roomType?.code} required className={inputCls} placeholder="DDR" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
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
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="active" defaultChecked={roomType?.active ?? true} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Active (sellable)
          </label>

          {/*
            Everything below is what a GUEST reads on the booking page, and every field is optional.
            A hotel can create a room type and start selling in the fields above; this half is the
            part they improve later, which is why it is separated rather than mixed into the
            commercial fields.
          */}
          <div className="space-y-3.5 rounded-lg border border-surface-border bg-surface-muted/40 p-3.5">
            <div>
              <div className="text-[12.5px] font-bold text-ink-900">What guests see</div>
              <p className="mt-0.5 text-[11.5px] text-ink-500">
                All optional. A room with none of this still sells — it just says less on your booking page.
              </p>
            </div>

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
                Toggle chips with icons, not a column of tick boxes.

                Thirty-five checkboxes is a wall of near-identical rows, and a hotel filling one in
                for the fourth room type is reading every label again to find the two that changed.
                An icon gives each option a shape you can aim at, and a chip that visibly fills in
                shows what is on without tracing a line back to a small square. The real <input> is
                still there under `sr-only` — the form posts the same field, and the checkbox stays
                keyboard-reachable and readable by a screen reader.
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

          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create room type"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
