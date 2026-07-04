"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { logAudit, recordSync, str, int, utcDay } from "./mutation-helpers";
import { todayInTz, addDaysYmd } from "./format";

const HK_STATUSES = ["clean", "dirty", "inspected", "out_of_order"];

async function ctx() {
  const session = await getSession();
  if (!session) throw new Error("No session");
  return session;
}

function refresh() {
  revalidatePath("/rooms");
  revalidatePath("/housekeeping");
  revalidatePath("/dashboard");
}

/** Add one physical unit under a room type. */
export async function createUnit(fd: FormData): Promise<void> {
  const session = await ctx();
  const roomTypeId = str(fd, "roomTypeId");
  const label = str(fd, "label");
  const floor = str(fd, "floor") || null;
  if (!roomTypeId || !label) return;

  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
  if (!roomType || roomType.propertyId !== session.activePropertyId) return;

  const count = await prisma.unit.count({ where: { roomTypeId } });
  await prisma.unit.create({
    data: {
      tenantId: session.tenantId,
      propertyId: session.activePropertyId,
      roomTypeId,
      label,
      unitKind: roomType.unitKind,
      floor,
      sortOrder: count,
    },
  });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "unit", field: "create", newValue: label, userId: session.userId });
  refresh();
}

/** Bulk-generate numbered units (e.g. 101…110) under a room type. */
export async function generateUnits(fd: FormData): Promise<void> {
  const session = await ctx();
  const roomTypeId = str(fd, "roomTypeId");
  const n = Math.min(200, Math.max(1, int(fd, "count", 0)));
  const start = int(fd, "start", 1);
  const prefix = str(fd, "prefix");
  const floor = str(fd, "floor") || null;
  if (!roomTypeId || n <= 0) return;

  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
  if (!roomType || roomType.propertyId !== session.activePropertyId) return;

  const existing = await prisma.unit.count({ where: { roomTypeId } });
  const data = Array.from({ length: n }, (_, i) => ({
    tenantId: session.tenantId,
    propertyId: session.activePropertyId,
    roomTypeId,
    label: `${prefix}${start + i}`,
    unitKind: roomType.unitKind,
    floor,
    sortOrder: existing + i,
  }));
  await prisma.unit.createMany({ data });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "unit", field: "generate", newValue: `${n} units`, userId: session.userId });
  refresh();
}

/** Edit a unit's label / floor / active flag. */
export async function updateUnit(fd: FormData): Promise<void> {
  const session = await ctx();
  const unitId = str(fd, "unitId");
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.propertyId !== session.activePropertyId) return;

  await prisma.unit.update({
    where: { id: unitId },
    data: {
      label: str(fd, "label") || unit.label,
      floor: str(fd, "floor") || null,
      active: fd.get("active") != null,
    },
  });
  await logAudit(unit.propertyId, session.tenantId, { entity: "unit", field: "edit", newValue: str(fd, "label"), userId: session.userId });
  refresh();
}

/** Remove a unit (cascades its OOO period, restoring the room to sale). */
export async function deleteUnit(fd: FormData): Promise<void> {
  const session = await ctx();
  const unitId = str(fd, "unitId");
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.propertyId !== session.activePropertyId) return;

  // Never delete a room with a guest in it (would cascade away the stay record).
  const occupied = await prisma.roomAssignment.count({ where: { unitId, status: "active", checkedOutAt: null } });
  if (occupied > 0) return;

  await prisma.unit.delete({ where: { id: unitId } });
  await logAudit(unit.propertyId, session.tenantId, { entity: "unit", field: "delete", oldValue: unit.label, userId: session.userId });
  refresh();
}

/**
 * Change a unit's housekeeping status. THE one cross-product write: marking a unit `out_of_order`
 * writes a RoomInventoryPeriod (kind=out_of_order, unitId set) so the shared availability waterfall
 * takes that room off sale on every channel; moving it back to any serviceable status deletes the
 * period, restoring the room. (docs/PMS-REFERENCE.md "Housekeeping status model".)
 */
export async function setUnitStatus(fd: FormData): Promise<void> {
  const session = await ctx();
  const unitId = str(fd, "unitId");
  const status = str(fd, "status");
  if (!HK_STATUSES.includes(status)) return;

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.propertyId !== session.activePropertyId) return;
  const prev = unit.hkStatus;
  if (prev === status) return;

  await prisma.unit.update({ where: { id: unitId }, data: { hkStatus: status } });

  if (status === "out_of_order" && prev !== "out_of_order") {
    const property = await prisma.property.findUnique({ where: { id: unit.propertyId } });
    const today = todayInTz(property!.timezone);
    const to = addDaysYmd(today, property!.syncHorizonDays);
    await prisma.roomInventoryPeriod.create({
      data: {
        tenantId: session.tenantId,
        propertyId: unit.propertyId,
        roomTypeId: unit.roomTypeId,
        kind: "out_of_order",
        dateFrom: utcDay(today),
        dateTo: utcDay(to),
        rooms: 1,
        unitId: unit.id,
        note: `Unit ${unit.label} out of order (PMS)`,
      },
    });
    await recordSync(unit.propertyId, session.tenantId, `Unit ${unit.label} out of order`, "1 room off sale until back in service · sent to channels on next sync");
  } else if (prev === "out_of_order" && status !== "out_of_order") {
    await prisma.roomInventoryPeriod.deleteMany({ where: { unitId: unit.id } });
    await recordSync(unit.propertyId, session.tenantId, `Unit ${unit.label} back in service`, "1 room returned to sale · sent to channels on next sync");
  }

  await logAudit(unit.propertyId, session.tenantId, { entity: "unit_status", field: unit.label, oldValue: prev, newValue: status, userId: session.userId });
  refresh();
}
