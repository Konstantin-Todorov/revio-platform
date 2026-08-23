"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X, LogIn, LogOut, Receipt, PlusCircle, ArrowUpRight, Pin, AlertTriangle } from "lucide-react";
import type { TapeBar } from "@/lib/tape-chart";

/**
 * Manage a stay without leaving the calendar (§2.6).
 *
 * The grid is a place you work from, not a signpost. Clicking a bar used to navigate away, so
 * checking one guest in meant losing the view of the whole week and finding your way back — which
 * is why people end up keeping two tabs open.
 *
 * It shows the facts a receptionist needs to decide, and the actions that follow from them. Deep
 * folio work still opens the folio: a modal that grew a full billing screen inside it would be a
 * second folio screen, and two places to post a charge is how they drift.
 */

export interface StayModalProps {
  bar: TapeBar;
  onClose: () => void;
  money: (minor: number, currency: string) => string;
}

export function StayModal({ bar, onClose, money }: StayModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Escape closes, and focus starts inside the dialog. Both are the difference between a dialog
    // and a div that looks like one — a keyboard user must be able to leave without a mouse.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const crossType = bar.bookedRoomTypeName !== bar.accommodatedRoomTypeName;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Manage stay — ${bar.guestName}`}
      onClick={onClose}
    >
      {/* Stop a click inside the panel closing it; only the backdrop dismisses. */}
      <div
        className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-surface-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold text-ink-900">{bar.guestName}</h2>
            <p className="mt-0.5 text-[12px] text-ink-500">
              Room {bar.unitLabel} · {bar.stayFrom} → {bar.stayTo} · {bar.nights} night{bar.nights === 1 ? "" : "s"}
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-400 transition-colors hover:bg-surface-muted hover:text-ink-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5 px-4 py-3">
          <Row label="Status" value={bar.arrived ? "In house" : "Not arrived — room held"} />

          {/* One record, two facts (§2.7). Shown together or not at all: "upgraded to a Deluxe"
              loses what was sold, and the room type alone loses where they are sleeping. */}
          {crossType ? (
            <div className="rounded-md bg-brand-50 px-2.5 py-2 text-[12px] text-brand-800">
              <div className="font-semibold">Accommodated in a different room type</div>
              <div className="mt-0.5">
                Booked <span className="font-semibold">{bar.bookedRoomTypeName}</span> · staying in{" "}
                <span className="font-semibold">{bar.accommodatedRoomTypeName}</span>. The booking is unchanged.
              </div>
            </div>
          ) : (
            <Row label="Room type" value={bar.bookedRoomTypeName} />
          )}

          {bar.balanceMinor != null && (
            <Row
              label="Folio balance"
              value={money(bar.balanceMinor, bar.currency)}
              tone={bar.balanceMinor === 0 ? "ok" : "owing"}
            />
          )}

          {bar.pinned && (
            <p className="flex items-start gap-1.5 text-[11.5px] text-ink-500">
              <Pin className="mt-0.5 h-3 w-3 shrink-0" />
              A person chose this room, so it will not be re-assigned automatically.
            </p>
          )}

          {bar.status === "overstayed" && (
            <p className="flex items-start gap-1.5 rounded-md bg-danger-50 px-2.5 py-2 text-[12px] text-danger-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Past its departure date and still in house. This distorts occupancy until it is resolved.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-surface-border bg-surface-muted px-4 py-3">
          {!bar.arrived && (
            <Action href={`/checkin/${bar.reservationId}`} icon={LogIn} label="Check in" primary />
          )}
          {bar.arrived && (
            <Action href={`/folio/${bar.reservationId}`} icon={LogOut} label="Check out" primary />
          )}
          <Action href={`/folio/${bar.reservationId}`} icon={Receipt} label="Folio" />
          {bar.arrived && <Action href={`/minibar/${bar.reservationId}`} icon={PlusCircle} label="Post charge" />}
          <Action href={`/reservation/${bar.reservationId}`} icon={ArrowUpRight} label="Full view" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "ok" | "owing" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] text-ink-500">{label}</span>
      <span
        className={`text-[13px] font-semibold ${
          tone === "owing" ? "text-danger-600" : tone === "ok" ? "text-success-600" : "text-ink-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Action({
  href, icon: Icon, label, primary,
}: {
  href: string;
  icon: typeof LogIn;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] font-semibold transition-colors ${
        primary
          ? "bg-brand-800 text-white hover:bg-brand-700"
          : "border border-surface-border text-ink-700 hover:bg-white"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}
