import "server-only";
import { prisma } from "./db";
import { recordSync } from "./mutation-helpers";
import { todayInTz, addDaysYmd, utcDay } from "./format";

/**
 * Take a unit out of order: set its housekeeping status and write the OOO `RoomInventoryPeriod` so the
 * shared availability waterfall drops the room on every channel. Idempotent (won't duplicate the period).
 * Shared by the housekeeping board and maintenance tasks — the ONE cross-product write.
 */
export async function takeUnitOoo(tenantId: string, propertyId: string, unit: { id: string; label: string; roomTypeId: string }, note: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return;
  await prisma.unit.update({ where: { id: unit.id }, data: { hkStatus: "out_of_order" } });
  const existing = await prisma.roomInventoryPeriod.count({ where: { unitId: unit.id } });
  if (existing === 0) {
    const today = todayInTz(property.timezone);
    const to = addDaysYmd(today, property.syncHorizonDays);
    await prisma.roomInventoryPeriod.create({
      data: { tenantId, propertyId, roomTypeId: unit.roomTypeId, kind: "out_of_order", dateFrom: utcDay(today), dateTo: utcDay(to), rooms: 1, unitId: unit.id, note },
    });
    await recordSync(propertyId, tenantId, `Unit ${unit.label} out of order`, "1 room off sale until back in service · sent to channels on next sync");
  }
}

/** Return a unit to service: delete its OOO periods (restores the waterfall) and set the new hk status. */
export async function clearUnitOoo(tenantId: string, propertyId: string, unit: { id: string; label: string }, newStatus: string) {
  const removed = await prisma.roomInventoryPeriod.deleteMany({ where: { unitId: unit.id } });
  await prisma.unit.update({ where: { id: unit.id }, data: { hkStatus: newStatus } });
  if (removed.count > 0) await recordSync(propertyId, tenantId, `Unit ${unit.label} back in service`, "1 room returned to sale · sent to channels on next sync");
}
