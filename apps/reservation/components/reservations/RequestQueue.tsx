"use client";

import { useState, useTransition } from "react";
import { Check, Clock, X } from "lucide-react";
import { acceptBookingRequest, declineBookingRequest } from "@/lib/actions-booking-engine";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { reservations as reservationsDict } from "@/lib/i18n/reservations";

export interface BookingRequest {
  id: string;
  guestName: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalLabel: string;
  requestedAt: string;
}

/**
 * Booking requests waiting on the hotel.
 *
 * These exist only while the hotel has not finished connecting Stripe: no card could be taken, so
 * the guest asked rather than booked. **The room is already held** — a request occupies inventory
 * from the moment it lands, so accepting changes no availability and declining is what puts a room
 * back on sale.
 *
 * It sits at the top of Reservations rather than in its own screen because a request is only urgent
 * while it is unanswered, and a queue nobody visits is a queue that ages. When the hotel connects
 * Stripe this whole card stops appearing, which is the honest signal that the setup step paid off.
 */
export function RequestQueue({ requests }: { requests: BookingRequest[] }) {
  const t = translate(reservationsDict, useLocale()).requests;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const open = requests.filter((r) => !done.has(r.id));
  if (open.length === 0) return null;

  const act = (id: string, fn: (id: string) => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn(id);
      if (!res.ok) return setError(res.error ?? t.failed);
      // Optimistically drop the row — the server has already revalidated, and leaving a row the
      // hotel just answered invites a second click on a decision that is no longer theirs to make.
      setDone((d) => new Set(d).add(id));
    });
  };

  return (
    <div className="rounded-lg border border-warning-500/40 bg-warning-50/50">
      <div className="flex items-center gap-2 border-b border-warning-500/25 px-4 py-2.5">
        <Clock className="h-4 w-4 text-warning-600" />
        <span className="text-[13px] font-bold text-ink-900">
          {t.waiting(open.length)}
        </span>
        <span className="text-[12px] text-ink-500">
          {t.held}
        </span>
      </div>

      <ul>
        {open.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-warning-500/15 px-4 py-3 last:border-0"
          >
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-ink-900">{r.guestName}</div>
              <div className="mt-0.5 text-[12.5px] text-ink-500">
                {r.roomTypeName} · {r.checkIn} → {r.checkOut} · {t.nights(r.nights)} · {r.totalLabel} · {t.asked(r.requestedAt)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => act(r.id, declineBookingRequest)}
                className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> {t.decline}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => act(r.id, acceptBookingRequest)}
                className="inline-flex items-center gap-1.5 rounded-md bg-success-600 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-success-500 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> {t.accept}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {error && (
        <p className="px-4 py-2 text-[12px] font-medium text-danger-600">{error}</p>
      )}
    </div>
  );
}
