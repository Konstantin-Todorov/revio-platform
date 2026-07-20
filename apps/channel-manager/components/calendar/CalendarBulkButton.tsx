"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { BulkUpdatePanel } from "@/components/bulk/BulkUpdatePanel";

type Opt = { id: string; name: string; code: string };
type PlanOpt = { id: string; name: string; priceLogic: string; parentName: string | null };

/**
 * Spec §2.1: the per-row "Bulk edit" opens the bulk tool in a modal OVER the calendar — pre-scoped to
 * this room type, the user stays on the calendar after applying. It reuses the ONE shared bulk engine +
 * confirm→apply→result modal (BulkUpdatePanel), never a parallel implementation.
 */
export function CalendarBulkButton({
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
        <BulkUpdatePanel compact roomTypes={roomTypes} ratePlans={ratePlans} today={today} preselectRoomTypeIds={[roomTypeId]} />
      </Modal>
    </>
  );
}
