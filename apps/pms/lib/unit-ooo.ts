import { withTenantTransaction } from "@revio/db";
import { todayInTz, addDaysYmd, utcDay } from "./format";

/**
 * A room going out of order, and coming back — the ONE write that crosses from the PMS into the
 * shared availability waterfall. The database half only; the channel push is the caller's.
 *
 * Kept free of `server-only` and of the session-bound client so `scripts/ooo-race.ts` can race the
 * same code the housekeeping board and maintenance tasks run.
 */
export interface TakenOutOfOrder {
  created: boolean;
  roomTypeId: string;
  roomTypeName: string;
  from: string;
  to: string;
}

/*
 * ⚠️ One period per broken room, and it was not until 2026-09-23.
 *
 * `scripts/ooo-race.ts` marked one room out of order twelve times at once against this function
 * before the fix: SIX periods — six rooms off sale on every channel for one broken room. That was
 * the better of two copies: it counted existing periods before creating one, but count-then-create
 * outside a transaction lets every racer count zero. The housekeeping board had its own inline copy
 * with no count at all.
 *
 * The UNIT row is the lock. It is updated FIRST, inside the transaction, so a second caller blocks
 * on it until the first commits. Under READ COMMITTED the second caller's count is a new statement
 * that starts after that commit, so it sees the period and creates nothing. No unique constraint
 * could say this as simply: a room may legitimately carry several periods of other kinds.
 *
 * It also makes the pair atomic. Before, the status and the period were separate writes: a failure
 * between them left a room reading "out of order" while every channel went on selling it.
 */
export async function takeUnitOutOfOrder(
  tenantId: string,
  propertyId: string,
  unit: { id: string; roomTypeId: string },
  note: string,
): Promise<TakenOutOfOrder | null> {
  return withTenantTransaction(tenantId, async (db) => {
    const property = await db.property.findUnique({ where: { id: propertyId } });
    if (!property) return null;
    await db.unit.update({ where: { id: unit.id }, data: { hkStatus: "out_of_order" } });
    const today = todayInTz(property.timezone);
    const to = addDaysYmd(today, property.syncHorizonDays);
    const rt = await db.roomType.findUnique({ where: { id: unit.roomTypeId }, select: { name: true } });
    const base = { roomTypeId: unit.roomTypeId, roomTypeName: rt?.name ?? "1 room", from: today, to };
    const existing = await db.roomInventoryPeriod.count({ where: { unitId: unit.id } });
    if (existing > 0) return { created: false, ...base };
    await db.roomInventoryPeriod.create({
      data: { tenantId, propertyId, roomTypeId: unit.roomTypeId, kind: "out_of_order", dateFrom: utcDay(today), dateTo: utcDay(to), rooms: 1, unitId: unit.id, note },
    });
    return { created: true, ...base };
  });
}

export interface ReturnedToService {
  /** The windows that went back on sale — read before deleting, because the push has to name them. */
  removed: { roomTypeId: string; dateFrom: Date; dateTo: Date }[];
  roomTypeName: string;
}

/*
 * The reverse, with the same lock and the same atomicity. The failure it closes was the worse of the
 * two: status set back to clean, the delete then failing, and the room off sale for ever — because
 * with the status no longer "out of order", pressing the button again did not reach the delete.
 */
export async function returnUnitToService(
  tenantId: string,
  unit: { id: string },
  newStatus: string,
): Promise<ReturnedToService> {
  return withTenantTransaction(tenantId, async (db) => {
    const u = await db.unit.update({ where: { id: unit.id }, data: { hkStatus: newStatus }, include: { roomType: { select: { name: true } } } });
    const removed = await db.roomInventoryPeriod.findMany({
      where: { unitId: unit.id },
      select: { roomTypeId: true, dateFrom: true, dateTo: true },
    });
    if (removed.length > 0) await db.roomInventoryPeriod.deleteMany({ where: { unitId: unit.id } });
    return { removed, roomTypeName: u.roomType.name };
  });
}
