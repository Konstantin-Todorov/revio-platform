"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "./Modal";

/**
 * Confirm-then-delete. The action runs server-side; for items with reservations or derived children
 * the server soft-deletes (deactivates) instead — so this is always safe.
 */
export function DeleteButton({
  action, id, label, note,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  label: string;
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={`Delete ${label}`} className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Delete ${label}?`}>
        <p className="text-[13px] text-ink-600">
          This removes <span className="font-semibold text-ink-900">{label}</span>. {note}
        </p>
        <form action={action} className="mt-5 flex justify-end gap-2">
          <input type="hidden" name="id" value={id} />
          <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
          <button type="submit" onClick={() => setOpen(false)} className="rounded-md bg-danger-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-danger-600">Delete</button>
        </form>
      </Modal>
    </>
  );
}
