"use client";

import { useState } from "react";
import { NotebookPen, Pencil, Trash2, X } from "lucide-react";
import { addGuestNote, editGuestNote, deleteGuestNote } from "@/lib/actions-reservations";
import { relativeTime } from "@/lib/format";

export type GuestNoteRow = {
  id: string;
  authorName: string;
  body: string;
  createdIso: string;
  edited: boolean;
};

/**
 * Guest Notes (CRS-REFINEMENT-R2 §4): add, list, edit and remove free-text notes on the SHARED guest
 * record. Multiple notes per guest, each stamped with author + time. Author identity comes from the
 * server session (the form only carries the body), so a note can never be attributed to someone else.
 * Visibility scope is documented in the surrounding card: these live on the core Guest, so they surface
 * wherever the guest does — CRS today, PMS once the property runs it.
 */
export function GuestNotes({ guestId, notes }: { guestId: string; notes: GuestNoteRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div id="notes" className="space-y-4 p-4">
      {/* Composer */}
      <form action={addGuestNote} className="space-y-2">
        <input type="hidden" name="guestId" value={guestId} />
        <textarea
          name="body"
          required
          rows={2}
          placeholder="Add a note about this guest — a preference, a heads-up, a follow-up…"
          className="w-full resize-y rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600"
        />
        <div className="flex justify-end">
          <button className="flex items-center gap-1.5 rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
            <NotebookPen className="h-3.5 w-3.5" /> Add note
          </button>
        </div>
      </form>

      {/* List — newest first */}
      {notes.length === 0 ? (
        <p className="rounded-md border border-dashed border-surface-border px-3 py-4 text-center text-[12.5px] text-ink-400">
          No notes yet. The first one you add stays with this guest wherever their record appears.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-surface-border bg-surface-muted/40 p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="text-[11px] text-ink-400">
                  <span className="font-semibold text-ink-600">{n.authorName}</span>
                  <span className="tnum"> · {new Date(n.createdIso).toISOString().slice(0, 10)}</span>
                  <span className="tnum"> · {relativeTime(n.createdIso)}</span>
                  {n.edited && <span className="italic"> · edited</span>}
                </div>
                {editingId !== n.id && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(n.id)}
                      title="Edit note"
                      className="rounded p-1 text-ink-400 transition-colors hover:bg-white hover:text-brand-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <form action={deleteGuestNote}>
                      <input type="hidden" name="guestId" value={guestId} />
                      <input type="hidden" name="noteId" value={n.id} />
                      <button
                        type="submit"
                        title="Delete note"
                        className="rounded p-1 text-ink-400 transition-colors hover:bg-white hover:text-danger-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {editingId === n.id ? (
                <form action={editGuestNote} className="space-y-2">
                  <input type="hidden" name="guestId" value={guestId} />
                  <input type="hidden" name="noteId" value={n.id} />
                  <textarea
                    name="body"
                    required
                    rows={2}
                    defaultValue={n.body}
                    className="w-full resize-y rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-brand-600"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 hover:bg-surface-muted"
                    >
                      <X className="h-3.5 w-3.5" /> Cancel
                    </button>
                    <button className="rounded-md bg-brand-800 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-700">
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-800">{n.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
