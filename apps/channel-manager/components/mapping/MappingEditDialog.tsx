"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { updateStreamMapping, type ActionResult } from "@/lib/actions-config";
import { Modal, Field, inputCls } from "@/components/ui/Modal";

export function MappingEditDialog({
  kind, id, label, externalId, channelName,
}: {
  kind: "room" | "rate";
  id: string;
  label: string;
  externalId: string | null;
  channelName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(updateStreamMapping, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  const idLabel = kind === "room" ? "External Room ID" : "External Rate ID";
  const noun = kind === "room" ? "room type" : "rate plan";

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Edit mapping" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-brand-600">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Map ${noun}`}>
        <p className="mb-3 text-[12.5px] text-ink-500">
          Link <span className="font-semibold text-ink-800">{label}</span> to its id in{" "}
          <span className="font-semibold text-ink-800">{channelName}</span>. A filled id ⇒ status becomes complete.
        </p>
        <form action={formAction} className="space-y-3.5">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <Field label={idLabel} hint={`The channel's own id for this ${noun}`}>
            <input name="externalId" defaultValue={externalId ?? ""} className={inputCls} placeholder="e.g. 88291" />
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
