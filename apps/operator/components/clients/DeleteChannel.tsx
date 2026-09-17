"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

/**
 * Remove a channel — or say plainly why it cannot be removed.
 *
 * ## ⚠️ The refusal is the feature
 *
 * `Reservation.channel` is `onDelete: Cascade`, so deleting a channel deletes every booking that
 * ever arrived through it, with its guests, its folio lines and its money. Postgres does that
 * silently. A "Delete" next to a channel with 40 bookings is not a dangerous control, it is a trap.
 *
 * So when the channel has bookings there is **no delete to click at all** — the button is replaced
 * by a sentence saying what would happen and what to do instead. Disabling it and leaving a tooltip
 * would still invite the question; removing it answers the question before it is asked.
 *
 * The server re-checks the count. This is the explanation, never the enforcement.
 *
 * ## Typing the name
 *
 * The same bar as ending a client, because in a table of channels the one you are about to remove
 * and the one you meant to remove are a row apart.
 */
export function DeleteChannel({
  channelId,
  name,
  propertyName,
  reservations,
  explainRefusal,
  action,
}: {
  channelId: string;
  name: string;
  propertyName: string;
  reservations: number;
  /**
   * Whether to spell out why there is no Remove.
   *
   * ⚠️ False on a healthy channel, and that is the point. The sentence under every working row was
   * four repetitions of an apology for something nobody was trying to do — the clutter that teaches
   * people to stop reading a screen. It appears where somebody would actually be reaching for
   * delete: a disconnected channel, one pointed at a property that is gone, a suspended account.
   */
  explainRefusal?: boolean;
  action: (fd: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  if (reservations > 0) {
    if (!explainRefusal) return null;
    return (
      <span className="inline-flex max-w-sm items-start gap-1.5 text-[11.5px] leading-snug text-ink-400">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Cannot be removed — {reservations} booking{reservations === 1 ? "" : "s"} came through it and would go too.
          Disconnect instead.
        </span>
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
      >
        <Trash2 className="h-3.5 w-3.5" /> Remove
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2 rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2">
      <input type="hidden" name="channelId" value={channelId} />
      <span className="text-[12px] text-danger-700">
        Remove <span className="font-semibold">{propertyName} · {name}</span> and its mappings? Nothing is deleted on the
        channel&apos;s own side. Type <span className="font-mono font-semibold">{name}</span> to confirm.
      </span>
      <input
        name="confirmation"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={name}
        aria-label={`Type ${name} to confirm removal`}
        className="rounded-md border border-danger-600/40 bg-white px-2 py-1 text-[12px] text-ink-900 outline-none focus:border-danger-600"
      />
      <button
        type="submit"
        disabled={typed.trim().toLowerCase() !== name.trim().toLowerCase()}
        className="rounded-md bg-danger-600 px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-danger-700 disabled:opacity-40"
      >
        Remove
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setTyped(""); }}
        className="rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-ink-500 transition-colors hover:bg-white"
      >
        Cancel
      </button>
    </form>
  );
}
