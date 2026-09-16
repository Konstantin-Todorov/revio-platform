"use client";

import { useRef } from "react";
import Link from "next/link";
import { LogIn, LogOut, Receipt, PlusCircle, ArrowUpRight, Pin, AlertTriangle } from "lucide-react";
import { Dialog } from "@revio/ui/dialog";
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
 *
 * ## The dialog shell is `@revio/ui/dialog`, not this file
 *
 * This used to hand-roll it, and the hand-rolled version had four holes that are invisible with a
 * mouse and fatal without one: **Tab escaped the panel** into the calendar behind it, **focus went
 * nowhere on close** so the next Tab restarted from the top of the document, **the grid scrolled
 * behind the open dialog**, and the `<h2>` was never linked to the dialog — it carried an
 * `aria-label` copy of the guest's name instead, so the heading was announced twice and the
 * dates were announced as loose text. It also used `shadow-xl`, which is a Tailwind default and
 * not one of the three Revio elevations.
 */

export interface StayModalProps {
  /** `null` while the dialog animates out — see `retained` below. */
  bar: TapeBar | null;
  open: boolean;
  onClose: () => void;
  money: (minor: number, currency: string) => string;
}

export function StayModal({ bar, open, onClose, money }: StayModalProps) {
  // The call site drops the bar the instant it closes, which would unmount the panel mid-exit and
  // make the close look like a cut rather than a dismissal. Holding the last one lets the 195ms
  // exit actually play; it is never read while the dialog is open.
  const retained = useRef<TapeBar | null>(null);
  if (bar) retained.current = bar;
  const stay = bar ?? retained.current;
  if (!stay) return null;

  const crossType = stay.bookedRoomTypeName !== stay.accommodatedRoomTypeName;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={stay.guestName}
      description={`Room ${stay.unitLabel} · ${stay.stayFrom} → ${stay.stayTo} · ${stay.nights} night${
        stay.nights === 1 ? "" : "s"
      }`}
      footerAlign="start"
      footer={
        <>
          {!stay.arrived && <Action href={`/checkin/${stay.reservationId}`} icon={LogIn} label="Check in" primary />}
          {stay.arrived && <Action href={`/folio/${stay.reservationId}`} icon={LogOut} label="Check out" primary />}
          <Action href={`/folio/${stay.reservationId}`} icon={Receipt} label="Folio" />
          {stay.arrived && <Action href={`/minibar/${stay.reservationId}`} icon={PlusCircle} label="Post charge" />}
          <Action href={`/reservation/${stay.reservationId}`} icon={ArrowUpRight} label="Full view" />
        </>
      }
    >
      <div className="space-y-2.5 pb-2">
        <Row label="Status" value={stay.arrived ? "In house" : "Not arrived — room held"} />

        {/* One record, two facts (§2.7). Shown together or not at all: "upgraded to a Deluxe"
            loses what was sold, and the room type alone loses where they are sleeping. */}
        {crossType ? (
          <div className="rounded-md bg-brand-50 px-2.5 py-2 text-[12px] text-brand-800">
            <div className="font-semibold">Accommodated in a different room type</div>
            <div className="mt-0.5">
              Booked <span className="font-semibold">{stay.bookedRoomTypeName}</span> · staying in{" "}
              <span className="font-semibold">{stay.accommodatedRoomTypeName}</span>. The booking is unchanged.
            </div>
          </div>
        ) : (
          <Row label="Room type" value={stay.bookedRoomTypeName} />
        )}

        {stay.balanceMinor != null && (
          <Row
            label="Folio balance"
            value={money(stay.balanceMinor, stay.currency)}
            tone={stay.balanceMinor === 0 ? "ok" : "owing"}
          />
        )}

        {stay.pinned && (
          <p className="flex items-start gap-1.5 text-[11.5px] text-ink-500">
            <Pin className="mt-0.5 h-3 w-3 shrink-0" />
            A person chose this room, so it will not be re-assigned automatically.
          </p>
        )}

        {stay.status === "overstayed" && (
          <p className="flex items-start gap-1.5 rounded-md bg-danger-50 px-2.5 py-2 text-[12px] text-danger-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Past its departure date and still in house. This distorts occupancy until it is resolved.
          </p>
        )}
      </div>
    </Dialog>
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
