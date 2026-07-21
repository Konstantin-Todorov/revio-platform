"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { CrsBulkPanel } from "@/components/rates/CrsBulkPanel";

type Opt = { id: string; name: string };
type PlanOpt = { id: string; name: string; priceLogic: string; parentName: string | null };

/**
 * CRS-REFINEMENT-R2 §5.2: the per-row "Bulk edit" opens the bulk tool in a modal OVER the Inventory
 * Calendar — pre-scoped to this room type, the user stays on the calendar after applying. Reuses the
 * shared CrsBulkPanel (one engine, two entry points), matching the RevioLink behaviour.
 */
export function CrsCalendarBulkButton({
  roomTypeId, roomTypeName, roomTypes, ratePlans, today,
}: {
  roomTypeId: string;
  roomTypeName: string;
  roomTypes: Opt[];
  ratePlans: PlanOpt[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="ml-auto rounded-md border border-surface-border bg-white px-2 py-1 text-[11px] font-semibold text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-700"
      >
        Bulk edit
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Bulk edit · ${roomTypeName}`}>
        <CrsBulkPanel compact roomTypes={roomTypes} ratePlans={ratePlans} today={today} preselectRoomTypeIds={[roomTypeId]} />
      </Modal>
    </>
  );
}
