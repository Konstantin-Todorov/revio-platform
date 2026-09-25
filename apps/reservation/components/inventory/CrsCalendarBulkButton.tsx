"use client";

import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { inventory as inventoryDict } from "@/lib/i18n/inventory";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { CrsBulkPanel } from "@/components/rates/CrsBulkPanel";

type Opt = { id: string; name: string; code?: string | null };
type PlanOpt = {
  id: string; name: string; code?: string | null; priceLogic: string; parentName: string | null;
  active?: boolean;
  /** Which rooms the plan is linked to — the bulk selector is a room-first tree. */
  roomTypeIds: string[];
};

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
  const s = translate(inventoryDict, useLocale());
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="ml-auto rounded-md border border-surface-border bg-white px-2 py-1 text-[11px] font-semibold text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-700"
      >
        {s.bulkEdit}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={s.bulkEditTitle(roomTypeName)}>
        <CrsBulkPanel compact roomTypes={roomTypes} ratePlans={ratePlans} today={today} preselectRoomTypeIds={[roomTypeId]} />
      </Modal>
    </>
  );
}
