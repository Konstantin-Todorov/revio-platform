"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { updateMapping, type ActionResult } from "@/lib/actions-config";
import { Modal, Field, inputCls } from "@/components/ui/Modal";

type Mapping = {
  id: string;
  roomTypeName: string;
  ratePlanName: string;
  externalRoomId: string | null;
  externalRateId: string | null;
};

export function MappingEditDialog({ mapping, channelName }: { mapping: Mapping; channelName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(updateMapping, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Edit mapping" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-brand-600">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit mapping">
        <p className="mb-3 text-[12.5px] text-ink-500">
          Link <span className="font-semibold text-ink-800">{mapping.roomTypeName} · {mapping.ratePlanName}</span> to its
          IDs in <span className="font-semibold text-ink-800">{channelName}</span>. Both IDs filled ⇒ status becomes complete.
        </p>
        <form action={formAction} className="space-y-3.5">
          <input type="hidden" name="id" value={mapping.id} />
          <Field label="External Room ID" hint="The channel's own id for this room type">
            <input name="externalRoomId" defaultValue={mapping.externalRoomId ?? ""} className={inputCls} placeholder="e.g. 88291" />
          </Field>
          <Field label="External Rate ID" hint="The channel's own id for this rate plan">
            <input name="externalRateId" defaultValue={mapping.externalRateId ?? ""} className={inputCls} placeholder="e.g. 4471299" />
          </Field>
          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? "Saving…" : "Save mapping"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
