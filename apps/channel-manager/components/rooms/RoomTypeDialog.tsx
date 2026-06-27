"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { saveRoomType, type ActionResult } from "@/lib/actions";
import { Modal, Field, inputCls } from "@/components/ui/Modal";

type RoomType = {
  id: string; name: string; code: string; unitKind: string;
  totalRooms: number; maxGuests: number; description: string | null; active: boolean;
};

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
            <Field label="Total Rooms" hint="Physical count (safety-net)"><input name="totalRooms" type="number" min={0} defaultValue={roomType?.totalRooms ?? 0} className={inputCls} /></Field>
            <Field label="Max guests"><input name="maxGuests" type="number" min={1} defaultValue={roomType?.maxGuests ?? 2} className={inputCls} /></Field>
          </div>
          <Field label="Description"><input name="description" defaultValue={roomType?.description ?? ""} className={inputCls} placeholder="Optional" /></Field>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="active" defaultChecked={roomType?.active ?? true} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Active (sellable)
          </label>

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
