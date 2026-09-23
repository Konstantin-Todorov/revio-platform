import "server-only";
import { stayScope } from "@revio/connectivity";
import { recordSync } from "./mutation-helpers";
import { addDaysYmd } from "./format";
import { takeUnitOutOfOrder, returnUnitToService } from "./unit-ooo";

/**
 * Take a unit out of order and tell the channels. The database half is `takeUnitOutOfOrder` in
 * `./unit-ooo` — transactional and race-safe, see there.
 *
 * ⚠️ "Shared by the housekeeping board and maintenance tasks" was written above this function long
 * before it was true. Until 2026-09-23 only maintenance called it; the housekeeping board carried an
 * inline copy that had lost the duplicate check and the date-scoped push. It calls this now.
 */
export async function takeUnitOoo(tenantId: string, propertyId: string, unit: { id: string; label: string; roomTypeId: string }, note: string) {
  const taken = await takeUnitOutOfOrder(tenantId, propertyId, unit, note);
  if (!taken?.created) return;
  // Boundary rule: channels see the availability effect, never the operational cause.
  await recordSync(propertyId, tenantId, `Availability reduced — ${taken.roomTypeName}`, "1 room off sale until back in service",
    stayScope([{ roomTypeId: taken.roomTypeId, checkIn: taken.from, checkOut: addDaysYmd(taken.to, 1) }]));
}

/** Return a unit to service: delete its OOO periods (restores the waterfall), set the new status, push the freed dates. */
export async function clearUnitOoo(tenantId: string, propertyId: string, unit: { id: string; label: string }, newStatus: string) {
  const back = await returnUnitToService(tenantId, unit, newStatus);
  if (back.removed.length === 0) return;
  await recordSync(propertyId, tenantId, `Availability restored — ${back.roomTypeName}`, "1 room returned to sale",
    stayScope(back.removed.map((p) => ({ roomTypeId: p.roomTypeId, checkIn: p.dateFrom, checkOut: addDaysYmd(p.dateTo.toISOString().slice(0, 10), 1) }))));
}
