"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { saveRoomType, type ActionResult } from "@/lib/actions-rates";
import { Modal } from "@/components/ui/Modal";
import { RoomTypeBasicsFields } from "./RoomTypeForm";

/**
 * Add a room type from the CRS — the same shared record RevioLink edits. A CRS-only hotel has no other
 * place to define what it sells.
 *
 * Only the basics are asked here. Saving opens the new room's own page, where its description,
 * amenities and photos are added — a room is sellable from the basics alone, and the dialog stays
 * short enough to finish.
 */
export function RoomTypeDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveRoomType, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      if (state.id) router.push(`/rooms-rates/rooms/${state.id}`);
    }
  }, [state, router]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
        <Plus className="h-4 w-4" /> Add room type
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add room type">
        <form action={formAction} className="space-y-3.5">
          <RoomTypeBasicsFields />
          <p className="text-[11.5px] text-ink-400">Description, amenities and photos come next, on the room&rsquo;s own page.</p>
          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
              {pending ? "Saving…" : "Create room type"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
