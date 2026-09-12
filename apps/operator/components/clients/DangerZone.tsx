"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { deleteClient } from "@/lib/actions";

/**
 * The only irreversible control in the console, built to be hard to use by accident.
 *
 * ## What it says before it lets you
 *
 * The numbers are the point. "Delete this client" tells you nothing; "43 reservations, 2 properties,
 * 5 logins" tells you whether you are tidying up a smoke test or ending a hotel. They are counted
 * from the database, not estimated, and they are the same numbers the server re-reads before it
 * does anything.
 *
 * ## Typing the name
 *
 * A confirm dialog is dismissed by muscle memory; people click "Yes, delete" on things they did not
 * read. Typing the client's own name is the one confirmation that cannot be produced without having
 * looked at which client this is.
 *
 * ## And when it refuses
 *
 * A client with an issued invoice cannot be deleted at all, and the refusal names suspension
 * instead — because the usual reason somebody reaches for delete is that a hotel stopped paying,
 * and that is precisely the case where the data must be kept. They come back.
 */
export function DangerZone({
  tenantId,
  tenantName,
  counts,
  blocked,
  warning,
}: {
  tenantId: string;
  tenantName: string;
  counts: { reservations: number; properties: number; users: number; issuedInvoices: number };
  /** Set when the client may not be deleted at all — the reason, and what to do instead. */
  blocked?: { reason: string; instead: string };
  /** Set when it is allowed but consequential. */
  warning?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === tenantName.trim();

  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  return (
    <div className="mt-6 rounded-xl border border-danger-600/25 bg-danger-50/30 p-4">
      <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-danger-700">
        <AlertTriangle className="h-4 w-4" /> Remove this client
      </h3>

      {blocked ? (
        <>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-700">{blocked.reason}</p>
          <p className="mt-1.5 rounded-md bg-white/70 px-2.5 py-2 text-[12.5px] font-semibold text-ink-800">
            {blocked.instead}
          </p>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600">
            Everything this hotel owns goes with it, permanently:{" "}
            <strong className="font-semibold text-ink-900">
              {plural(counts.reservations, "reservation")} · {plural(counts.properties, "property", "properties")} ·{" "}
              {plural(counts.users, "login")}
            </strong>
            . There is no undo and no backup to restore from.
          </p>

          {warning && (
            <p className="mt-2 flex items-start gap-1.5 rounded-md bg-white/70 px-2.5 py-2 text-[12.5px] leading-snug text-ink-700">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-warning-600" />
              {warning}
            </p>
          )}

          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-3 flex h-8 items-center gap-1.5 rounded-md border border-danger-600/40 bg-white px-3 text-[12.5px] font-semibold text-danger-700 transition-colors hover:bg-danger-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove client…
            </button>
          ) : (
            <form action={deleteClient} className="mt-3 space-y-2">
              <input type="hidden" name="tenantId" value={tenantId} />
              <label className="block text-[12px] font-semibold text-ink-700">
                Type <span className="rounded bg-white px-1 font-bold text-danger-700">{tenantName}</span> to confirm
                <input
                  name="confirmation"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  className="mt-1 h-9 w-full rounded-md border border-surface-border bg-white px-2.5 text-[13px] outline-none focus:border-danger-600"
                />
              </label>
              <div className="flex gap-2">
                <button
                  disabled={!matches}
                  className="h-9 rounded-md bg-danger-600 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove permanently
                </button>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setTyped(""); }}
                  className="h-9 rounded-md px-3 text-[12.5px] font-semibold text-ink-600 hover:bg-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
